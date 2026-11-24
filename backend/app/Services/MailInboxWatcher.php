<?php

namespace App\Services;

use App\Models\MailAccount;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Throwable;
use Webklex\PHPIMAP\Address;
use Webklex\PHPIMAP\Client;
use Webklex\PHPIMAP\ClientManager;
use Webklex\PHPIMAP\Message;

/**
 * Watches the Inbox of every mail account: reports the unread count and sends a bell notification when
 * new mail arrives: for a shared account to everyone with Mail access, for an own account to its owner. Used by the top-bar poll and
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

    public static function cacheKey(MailAccount $account): string
    {
        return 'mail_inbox_status_'.$account->id;
    }

    /**
     * Unread count of all the user's accounts together.
     *
     * @return array{configured: bool, unread: ?int}
     */
    public function status(User $user, bool $fresh = false): array
    {
        $accounts = MailAccount::visibleTo($user)->get();
        $counts = $accounts->map(fn (MailAccount $a) => $this->unread($a, $fresh))->filter(fn ($n) => $n !== null);

        return ['configured' => $accounts->isNotEmpty(), 'unread' => $counts->isEmpty() ? null : (int) $counts->sum()];
    }

    /** Checks every account, for the scheduler. @return array<string, ?int> email => unread */
    public function checkAll(): array
    {
        return MailAccount::query()->orderBy('id')->get()->mapWithKeys(fn (MailAccount $a) => ["{$a->id} {$a->email}" => $this->unread($a, true)])->all();
    }

    /**
     * Unread count of one Inbox, kept for 60 seconds so many open tabs cost one server login per minute. An account
     * that cannot be reached is left alone for 5 minutes, so it does not slow the others down; null = not known.
     */
    private function unread(MailAccount $account, bool $fresh): ?int
    {
        $key = self::cacheKey($account);
        $known = Cache::get($key);
        if (is_array($known) && (! $fresh || $known['unread'] === null)) {
            return $known['unread'];
        }
        try {
            $unread = $this->check($account);
        } catch (Throwable $e) {
            Log::info('Mail account could not be checked', ['account' => $account->id, 'error' => $e->getMessage()]);
            $unread = null;
        }
        Cache::put($key, ['unread' => $unread], $unread === null ? 300 : 60);

        return $unread;
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

            $lock = Cache::lock('mail_inbox_announce_'.$account->id, 30);
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

        $recipients = $account->isShared() ? $this->recipients() : collect([$account->owner_id]);
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
                'title' => 'New mail from '.$this->sender($m).(MailAccount::query()->count() > 1 ? " ({$account->email})" : ''),
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
