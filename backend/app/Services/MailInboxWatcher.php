<?php

namespace App\Services;

use App\Models\MailAccount;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Throwable;
use Webklex\PHPIMAP\Address;
use Webklex\PHPIMAP\Client;
use Webklex\PHPIMAP\ClientManager;
use Webklex\PHPIMAP\Message;

/**
 * Watches the office Inbox: reports the unread count and sends a bell notification
 * to everyone with Mail access when new mail arrives. Used by the top-bar poll and
 * by the mail:check scheduled command.
 */
class MailInboxWatcher
{
    /** More new mails than this in one check become a single summary notification. */
    private const MAX_SEPARATE = 3;

    /**
     * Decodes MIME "encoded words" left in a header, e.g. "=?UTF-8?Q?Pilot_Proposal?=",
     * including subjects split over several pieces, into readable UTF-8 text.
     */
    public static function decodeHeader(?string $value): string
    {
        $value = (string) $value;
        if (! str_contains($value, '=?')) {
            return $value;
        }
        $decoded = @iconv_mime_decode($value, ICONV_MIME_DECODE_CONTINUE_ON_ERROR, 'UTF-8');
        if ($decoded === false || $decoded === '') {
            $decoded = mb_decode_mimeheader($value);
        }

        return $decoded;
    }

    public static function connect(MailAccount $account): Client
    {
        $client = (new ClientManager(['options' => ['fetch_order' => 'desc']]))->make([
            'host' => $account->imap_host,
            'port' => $account->imap_port,
            'encryption' => $account->imap_encryption === 'none' ? false : $account->imap_encryption,
            'validate_cert' => true,
            'username' => $account->username,
            'password' => $account->password,
            'protocol' => 'imap',
            'timeout' => 20,
        ]);

        return $client->connect();
    }

    /**
     * Unread count for the Inbox, shared for 60 seconds so many open tabs cost one
     * server login per minute. Also announces new mail.
     *
     * @return array{configured: bool, unread: int}
     */
    public function status(bool $fresh = false): array
    {
        $account = MailAccount::current();
        if (! $account) {
            return ['configured' => false, 'unread' => 0];
        }

        if ($fresh) {
            Cache::forget('mail_inbox_status');
        }

        return Cache::remember('mail_inbox_status', 60, fn () => [
            'configured' => true,
            'unread' => $this->check($account),
        ]);
    }

    /** Connects, notifies about new mail, and returns the Inbox unread count. */
    public function check(MailAccount $account): int
    {
        $client = self::connect($account);
        try {
            $inbox = $client->getFolderByPath('INBOX');
            $status = $inbox->status();
            $uidNext = (int) ($status['uidnext'] ?? 0);
            $validity = (int) ($status['uidvalidity'] ?? 0);

            $lock = Cache::lock('mail_inbox_announce', 30);
            if ($uidNext > 0 && $lock->get()) {
                try {
                    $this->announce($account->fresh(), $inbox->query(), $uidNext, $validity);
                } finally {
                    $lock->release();
                }
            }

            return (int) ($status['unseen'] ?? 0);
        } finally {
            try {
                $client->disconnect();
            } catch (Throwable) {
            }
        }
    }

    private function announce(MailAccount $account, $query, int $uidNext, int $validity): void
    {
        $last = $account->inbox_last_uid;

        // First run, or the server renumbered the mailbox: start from now without a flood of old mail.
        if ($last === null || ($validity && $account->inbox_uidvalidity && $validity !== (int) $account->inbox_uidvalidity)) {
            $account->forceFill(['inbox_last_uid' => $uidNext - 1, 'inbox_uidvalidity' => $validity ?: null])->save();

            return;
        }
        if ($uidNext - 1 <= $last) {
            return;
        }

        // "UID n:*" always returns the newest mail, so filter again on our side.
        $messages = collect($query->whereUid(($last + 1).':*')->setFetchBody(false)->leaveUnread()->get())
            ->filter(fn (Message $m) => (int) $m->getUid() > $last)
            ->sortBy(fn (Message $m) => (int) $m->getUid())
            ->values();

        $account->forceFill(['inbox_last_uid' => $uidNext - 1, 'inbox_uidvalidity' => $validity ?: null])->save();

        if ($messages->isEmpty()) {
            return;
        }

        $recipients = $this->recipients();
        if ($recipients->isEmpty()) {
            return;
        }

        $notes = $messages->count() > self::MAX_SEPARATE
            ? [[
                'title' => "{$messages->count()} new mails in {$account->email}",
                'message' => 'Latest: '.$this->describe($messages->last()),
                'data' => ['mail' => true, 'count' => $messages->count()],
            ]]
            : $messages->map(fn (Message $m) => [
                'title' => 'New mail from '.$this->sender($m),
                'message' => self::decodeHeader((string) $m->getSubject()) ?: '(no subject)',
                'data' => ['mail' => true, 'uid' => (int) $m->getUid()],
            ])->all();

        $now = now();
        foreach ($recipients as $userId) {
            foreach ($notes as $note) {
                Notification::create($note + ['user_id' => $userId, 'type' => 'new_mail', 'created_at' => $now]);
            }
        }
    }

    /** IDs of active users who can open Mail. */
    private function recipients(): Collection
    {
        return User::query()
            ->where(fn ($q) => $q->whereNull('is_active')->orWhere('is_active', true))
            ->get()
            ->filter(fn (User $u) => $u->isFullAdmin() || in_array('mail', $u->allowed_modules ?? [], true))
            ->pluck('id');
    }

    private function sender(Message $m): string
    {
        $from = $m->getFrom()->first();

        return $from instanceof Address ? (self::decodeHeader($from->personal) ?: $from->mail) : 'unknown sender';
    }

    private function describe(Message $m): string
    {
        return $this->sender($m).' — '.(self::decodeHeader((string) $m->getSubject()) ?: '(no subject)');
    }
}
