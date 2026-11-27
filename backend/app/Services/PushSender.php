<?php

namespace App\Services;

use App\Models\Notification;
use App\Models\PushSubscription;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;
use Minishlink\WebPush\Subscription;
use Minishlink\WebPush\WebPush;

/**
 * Every bell notification is also sent to the user's phones / browsers that allowed it (Web Push),
 * unless the user turned that kind off or it is their quiet time. The bell list itself is unchanged.
 * Sending waits until the response has gone out, so saving never gets slower.
 */
class PushSender
{
    /** Kinds the user can turn on or off, in the order the settings screen shows them */
    public const CATEGORIES = [
        'approvals' => 'Approvals waiting for me, and decisions on what I sent',
        'assignments' => 'Jobs assigned to me, stage changes, due dates and SLA',
        'enquiries' => 'Enquiries handed to me and finished tender analyses',
        'mail' => 'New mail in my mail accounts',
        'security' => 'New logins and password changes',
        'other' => 'Everything else',
    ];

    /** @var array<int, Notification> */
    private static array $queue = [];

    private static bool $flushScheduled = false;

    public static function category(string $type): string
    {
        return match (true) {
            in_array($type, ['quotation_approval', 'bill_approval', 'credit_note_approval', 'performa_approval', 'approval_needed', 'leave', 'attendance', 'vendor_pending'], true),
            str_starts_with($type, 'vendor_') => 'approvals',
            in_array($type, ['job', 'job_assigned', 'stage_transition', 'auto_transition', 'due_date_overdue', 'report', 'registration'], true),
            str_starts_with($type, 'sla_') => 'assignments',
            in_array($type, ['inquiry_handover', 'tender_analysis'], true) => 'enquiries',
            in_array($type, ['new_mail', 'mail_failed'], true) => 'mail',
            $type === 'login_alert' => 'security',
            default => 'other',
        };
    }

    /** The user's settings with defaults filled in: everything on, no quiet time */
    public static function prefs(?User $user): array
    {
        $saved = is_array($user?->push_prefs) ? $user->push_prefs : [];
        $categories = [];
        foreach (array_keys(self::CATEGORIES) as $key) {
            $categories[$key] = (bool) ($saved['categories'][$key] ?? true);
        }

        return [
            'categories' => $categories,
            'quiet_from' => $saved['quiet_from'] ?? null,
            'quiet_to' => $saved['quiet_to'] ?? null,
        ];
    }

    public static function configured(): bool
    {
        return (string) config('services.webpush.public_key') !== '' && (string) config('services.webpush.private_key') !== '';
    }

    /** Called when a bell notification is made */
    public static function queue(Notification $notification): void
    {
        if (! self::configured() || ! $notification->user_id) {
            return;
        }
        self::$queue[] = $notification;
        if (self::$flushScheduled) {
            return;
        }
        self::$flushScheduled = true;
        // Web requests: after the response. Scheduled commands: when the command ends.
        app()->runningInConsole() ? app()->terminating(fn () => self::flush()) : defer(fn () => self::flush());
    }

    public static function flush(): void
    {
        $items = self::$queue;
        self::$queue = [];
        self::$flushScheduled = false;
        if (! $items) {
            return;
        }
        try {
            (new self)->send($items);
        } catch (\Throwable $e) {
            Log::warning('Push sending failed: '.$e->getMessage());
        }
    }

    /** @param array<int, Notification> $items */
    public function send(array $items): int
    {
        $userIds = array_values(array_unique(array_map(fn (Notification $n) => (int) $n->user_id, $items)));
        $users = User::query()->whereIn('id', $userIds)->get()->keyBy('id');
        $subscriptions = PushSubscription::query()->whereIn('user_id', $userIds)->get()->groupBy('user_id');
        $unread = Notification::query()->whereIn('user_id', $userIds)->whereNull('read_at')
            ->selectRaw('user_id, count(*) as c')->groupBy('user_id')->pluck('c', 'user_id');

        $push = $this->client();
        $byEndpoint = [];
        $count = 0;
        foreach ($items as $n) {
            $user = $users->get($n->user_id);
            $subs = $subscriptions->get($n->user_id);
            if (! $user || ! $subs || ! $this->wanted($user, (string) $n->type)) {
                continue;
            }
            $payload = json_encode([
                'title' => (string) $n->title,
                'body' => (string) ($n->message ?? ''),
                'tag' => $n->type.'-'.($n->data['id'] ?? $n->data['report_id'] ?? $n->id),
                'url' => '/?nid='.$n->id.'&ntype='.rawurlencode((string) $n->type),
                'id' => $n->id,
                'type' => $n->type,
                'badge_count' => (int) ($unread[$n->user_id] ?? 0),
            ], JSON_UNESCAPED_UNICODE);
            foreach ($subs as $sub) {
                $byEndpoint[$sub->endpoint] = $sub;
                $push->queueNotification(Subscription::create([
                    'endpoint' => $sub->endpoint,
                    'publicKey' => $sub->p256dh,
                    'authToken' => $sub->auth,
                    'contentEncoding' => 'aes128gcm',
                ]), $payload, ['TTL' => 24 * 3600, 'urgency' => 'high']);
                $count++;
            }
        }

        return $this->deliver($push, $byEndpoint, $count);
    }

    /** A test message to all of one user's devices */
    public function test(User $user): int
    {
        $push = $this->client();
        $byEndpoint = [];
        $count = 0;
        foreach (PushSubscription::query()->where('user_id', $user->id)->get() as $sub) {
            $byEndpoint[$sub->endpoint] = $sub;
            $push->queueNotification(Subscription::create([
                'endpoint' => $sub->endpoint, 'publicKey' => $sub->p256dh, 'authToken' => $sub->auth, 'contentEncoding' => 'aes128gcm',
            ]), json_encode(['title' => 'Notifications are working', 'body' => 'This phone will now get NCRC notifications.', 'tag' => 'test', 'url' => '/'], JSON_UNESCAPED_UNICODE), ['TTL' => 600]);
            $count++;
        }

        return $this->deliver($push, $byEndpoint, $count);
    }

    private function deliver(WebPush $push, array $byEndpoint, int $count): int
    {
        if ($count === 0) {
            return 0;
        }
        $sent = 0;
        foreach ($push->flush() as $report) {
            $sub = $byEndpoint[$report->getEndpoint()] ?? null;
            if ($report->isSuccess()) {
                $sent++;
                $sub?->forceFill(['last_used_at' => now()])->save();
            } elseif ($report->isSubscriptionExpired()) {
                // The user removed the app or blocked notifications on that device
                $sub?->delete();
            } else {
                Log::info('Push not delivered: '.$report->getReason());
            }
        }

        return $sent;
    }

    private function wanted(User $user, string $type): bool
    {
        $prefs = self::prefs($user);
        if (! ($prefs['categories'][self::category($type)] ?? true)) {
            return false;
        }

        return ! $this->quietNow($prefs['quiet_from'], $prefs['quiet_to']);
    }

    private function quietNow(?string $from, ?string $to): bool
    {
        if (! $from || ! $to || $from === $to) {
            return false;
        }
        $now = Carbon::now(WorkCalendar::ZONE)->format('H:i');

        // 22:00 – 07:00 goes over midnight
        return $from < $to ? ($now >= $from && $now < $to) : ($now >= $from || $now < $to);
    }

    private function client(): WebPush
    {
        // PHP on Windows (local development) cannot make EC keys without an OpenSSL config file
        if (PHP_OS_FAMILY === 'Windows' && ! getenv('OPENSSL_CONF')) {
            $conf = dirname(PHP_BINARY).'/extras/ssl/openssl.cnf';
            if (is_file($conf)) {
                putenv('OPENSSL_CONF='.$conf);
            }
        }
        $push = new WebPush([
            'VAPID' => [
                'subject' => (string) config('services.webpush.subject'),
                'publicKey' => (string) config('services.webpush.public_key'),
                'privateKey' => (string) config('services.webpush.private_key'),
            ],
        ], [], new \GuzzleHttp\Client(['timeout' => 15, 'connect_timeout' => 5]));
        $push->setReuseVAPIDHeaders(true);

        return $push;
    }
}
