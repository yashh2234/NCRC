<?php

namespace App\Services;

use App\Models\Inquiry;
use App\Models\InquiryActivity;
use App\Models\Notification;
use App\Models\User;
use App\Models\WhatsappMessage;
use App\Models\WhatsappSetting;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

/** WhatsApp messages of allowed senders → inquiries. Unclear ones are saved too, marked "Needs check". */
class WhatsappInquiries
{
    private const MAX_ATTEMPTS = 5;

    private const UNKNOWN_CLIENT = 'Client not known (WhatsApp)';

    public function __construct(private InquiryReader $reader) {}

    /** Keeps the messages of one webhook call. @return int how many are new */
    public function keep(array $payload, WhatsappSetting $setting): int
    {
        $new = 0;
        foreach ((array) ($payload['entry'] ?? []) as $entry) {
            foreach ((array) ($entry['changes'] ?? []) as $change) {
                $value = (array) ($change['value'] ?? []);
                if (($change['field'] ?? '') !== 'messages' || empty($value['messages'])) {
                    continue;
                }
                $phoneId = (string) ($value['metadata']['phone_number_id'] ?? '');
                if (filled($setting->phone_number_id) && $phoneId !== $setting->phone_number_id) {
                    $setting->problem('A message came for another WhatsApp number and was ignored.');

                    continue;
                }
                foreach ((array) $value['messages'] as $message) {
                    $new += $this->keepOne((array) $message, $setting) ? 1 : 0;
                }
            }
        }

        return $new;
    }

    private function keepOne(array $message, WhatsappSetting $setting): bool
    {
        $id = (string) ($message['id'] ?? '');
        $from = (string) ($message['from'] ?? '');
        $body = $this->text($message);
        if ($id === '' || strlen($id) > 190 || $body === null) {
            return false;
        }
        $user = $setting->userFor($from);
        if (! $user) {
            // Nothing a stranger writes is kept
            $setting->problem('A message from a number that is not allowed (…'.substr($from, -4).') was ignored.');

            return false;
        }

        try {
            WhatsappMessage::create(['wamid' => $id, 'sender' => substr($from, 0, 30), 'user_id' => $user->id, 'body' => mb_substr($body, 0, 6000)]);
        } catch (UniqueConstraintViolationException) {
            return false; // Meta sends a message again when an answer gets lost
        }
        $setting->fill(['last_message_at' => now()])->save();

        return true;
    }

    /** What was written; null for things that are no message (reactions, system notes) */
    private function text(array $message): ?string
    {
        $type = (string) ($message['type'] ?? '');
        if ($type === 'text') {
            $text = trim((string) ($message['text']['body'] ?? ''));

            return $text === '' ? null : $text;
        }
        if (in_array($type, ['image', 'video', 'document', 'audio', 'sticker', 'location', 'contacts'], true)) {
            if ($type === 'sticker') {
                return null;
            }
            $caption = trim((string) ($message[$type]['caption'] ?? ''));

            return trim($caption."\n[A WhatsApp {$type} was sent with this; it is only in WhatsApp]");
        }

        return null;
    }

    /** Turns the waiting messages into inquiries. */
    public function process(): int
    {
        $done = 0;
        // One at a time: two runs must not give out the same inquiry number
        $lock = Cache::lock('whatsapp_inquiries', 280);
        if (! $lock->get()) {
            return 0;
        }
        try {
            foreach (WhatsappMessage::query()->where('status', 'pending')->orderBy('id')->limit(5)->get() as $message) {
                $done += $this->save($message) ? 1 : 0;
            }
        } finally {
            $lock->release();
        }

        return $done;
    }

    private function save(WhatsappMessage $message): bool
    {
        $message->increment('attempts');
        try {
            $user = User::findOrFail($message->user_id);
            $read = $this->reader->read($message->body, config('inquiry.work_categories', []), $user);
            $form = $read['form'];
            $unclear = $read['method'] === 'rules' || $read['warnings'] || $form['client_name'] === '';
            $notes = $form['notes'];
            if ($unclear && ! str_contains($notes, 'Message: ')) {
                $notes = trim($notes."\n\nMessage: ".$message->body);
            }
            $how = match ($read['method']) {
                'ai' => 'Received on WhatsApp, read by '.$read['provider'].'.',
                'format' => 'Received on WhatsApp.',
                default => 'Received on WhatsApp, read without AI.',
            };

            $inquiry = DB::transaction(function () use ($form, $notes, $unclear, $how, $read, $user, $message): Inquiry {
                $inquiry = Inquiry::create([
                    'client_name' => $form['client_name'] !== '' ? $form['client_name'] : self::UNKNOWN_CLIENT,
                    'mobile_no' => $form['mobile_no'] ?: null,
                    'source_location' => $form['location'] ?: null,
                    'budget' => $form['budget'] ?: null,
                    'work_categories' => $form['work_categories'],
                    'notes' => $notes ?: null,
                    'assigned_to' => $form['assigned_to'],
                    'next_follow_up' => $form['next_follow_up'],
                    'inquiry_no' => Inquiry::generateInquiryNo(),
                    'status' => 'new',
                    'inquiry_type' => 'whatsapp',
                    'priority' => 'normal',
                    'received_date' => now('Asia/Kolkata')->toDateString(),
                    'needs_check' => (bool) $unclear,
                    'created_by' => $user->id,
                ]);
                InquiryActivity::create([
                    'inquiry_id' => $inquiry->id,
                    'user_id' => $user->id,
                    'status' => 'new',
                    'assigned_to' => $inquiry->assigned_to,
                    'next_follow_up' => $form['next_follow_up'],
                    'remark' => trim($how.' '.implode(' ', $read['warnings'])),
                    'created_at' => now(),
                ]);
                $message->update(['status' => 'saved', 'error' => null, 'inquiry_id' => $inquiry->id]);

                return $inquiry;
            });
        } catch (Throwable $e) {
            Log::error('WhatsApp inquiry could not be saved', ['message' => $message->id, 'error' => $e->getMessage()]);
            $failed = $message->attempts >= self::MAX_ATTEMPTS;
            $message->update(['error' => mb_substr($e->getMessage(), 0, 250)] + ($failed ? ['status' => 'failed'] : []));
            if ($failed) {
                $this->notify($message->user_id, 'A WhatsApp inquiry could not be saved', mb_strimwidth($message->body, 0, 200, '…'));
            }

            return false;
        }

        $this->notify($user->id, "Inquiry {$inquiry->inquiry_no} saved from WhatsApp".($unclear ? ' · Needs check' : ''), $inquiry->client_name, $inquiry->id);
        if ((int) $inquiry->assigned_to !== (int) $user->id) {
            $this->notify($inquiry->assigned_to, "Inquiry {$inquiry->inquiry_no} handed over to you", "{$user->name} handed over the inquiry from {$inquiry->client_name}.", $inquiry->id);
        }

        return true;
    }

    private function notify(?int $userId, string $title, string $text, ?int $inquiryId = null): void
    {
        if (! $userId) {
            return;
        }
        Notification::create([
            'user_id' => $userId, 'type' => 'inquiry_whatsapp', 'title' => $title, 'message' => $text,
            'data' => $inquiryId ? ['inquiry_id' => $inquiryId] : [], 'created_at' => now(),
        ]);
    }
}
