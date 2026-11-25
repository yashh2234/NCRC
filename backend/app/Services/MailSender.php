<?php

namespace App\Services;

use App\Models\MailAccount;
use App\Models\MailOutbox;
use App\Models\Notification;
use App\Models\Quotation;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use RuntimeException;
use Symfony\Component\Mailer\Exception\TransportExceptionInterface;
use Symfony\Component\Mailer\Transport\Smtp\EsmtpTransport;
use Symfony\Component\Mailer\Transport\Smtp\SmtpTransport;
use Symfony\Component\Mailer\Transport\Smtp\Stream\SocketStream;
use Symfony\Component\Mime\Email;
use Throwable;
use Webklex\PHPIMAP\Client;

/**
 * Sends the mails of the outbox, and saves drafts. Files are streamed, so a mail of 48 MB does not need its size
 * in memory. A mail is never sent twice by itself: only when it certainly did not go out is it tried again.
 */
class MailSender
{
    /** All attachments of one mail together, before encoding */
    public const MAX_ATTACHMENTS = 35 * 1024 * 1024;

    private const MAX_ATTEMPTS = 3;

    private const UNCERTAIN = 'The connection broke while sending. It may or may not have gone out: ask the receiver before sending it again.';

    private ?Client $client = null;

    private ?int $clientFor = null;

    // ---------------------------------------------------------------- outbox

    /** Sends one queued mail; safe to call twice, only one call gets it. */
    public function run(MailOutbox $row): MailOutbox
    {
        $claimed = MailOutbox::query()->whereKey($row->id)->where('status', 'queued')
            ->update(['status' => 'sending', 'attempts' => $row->attempts + 1, 'updated_at' => now()]);
        $row->refresh();
        if (! $claimed) {
            return $row;
        }

        $temporary = [];
        try {
            $account = MailAccount::find($row->mail_account_id) ?? throw new RuntimeException('The mail account was removed.');
            $payload = $this->payload($row);

            // Until the mail itself is handed over nothing can have gone out: connection trouble is tried again
            try {
                $email = $this->compose($account, $payload, $temporary);
                $to = MailAddresses::parse($payload['to']);
                $cc = MailAddresses::without(MailAddresses::parse($payload['cc']), $to);
                $bcc = MailAddresses::without(MailAddresses::parse($payload['bcc']), $to, $cc);
                $email->to(...$to)->cc(...$cc)->bcc(...$bcc);
                $transport = $this->transport($account);
                $transport->start();
            } catch (Throwable $e) {
                if (! $e instanceof MailSendProblem && ! str_contains($e->getMessage(), 'authenticate') && $row->attempts < self::MAX_ATTEMPTS) {
                    $row->update(['status' => 'queued', 'error' => $this->short($e)]);

                    return $row;
                }

                return $this->fail($row, $account, $payload, $this->short($e));
            }

            try {
                $transport->send($email);
            } catch (Throwable $e) {
                // A code is the server's own refusal; without one the line broke and it is not known what happened
                $refused = $e instanceof TransportExceptionInterface && $e->getCode() >= 400;

                return $this->fail($row, $account, $payload, $refused ? 'The mail server did not accept it: '.$this->short($e) : self::UNCERTAIN);
            }
            $row->update(['status' => 'sent', 'error' => null]);
            $this->markQuotationSent((int) ($payload['quotation_id'] ?? 0));

            // The mail is out: nothing below may make it look as if sending failed
            $this->after($row, $account, $payload, $email, $bcc);
            $this->clean($row);
        } catch (Throwable $e) {
            report($e);
            if ($row->fresh()?->status === 'sending') {
                return $this->fail($row, $account ?? null, $payload ?? null, $this->short($e));
            }
        } finally {
            array_map('unlink', array_filter($temporary, 'is_file'));
        }

        return $row->refresh();
    }

    /** For the scheduler: what the browser did not finish (closed tab, lost connection) */
    public function runWaiting(): int
    {
        $done = 0;
        foreach (MailOutbox::query()->where('status', 'queued')->where('updated_at', '<', now()->subSeconds(45))->orderBy('id')->limit(5)->get() as $row) {
            $done += $this->run($row)->status === 'sent' ? 1 : 0;
        }
        foreach (MailOutbox::query()->where('status', 'sending')->where('updated_at', '<', now()->subMinutes(20))->get() as $row) {
            $this->fail($row, MailAccount::find($row->mail_account_id), $this->payloadOrNull($row), self::UNCERTAIN);
        }
        foreach (MailOutbox::query()->where('status', 'failed')->where('in_drafts', false)->where('created_at', '>', now()->subDays(2))->limit(5)->get() as $row) {
            $account = MailAccount::find($row->mail_account_id);
            $payload = $this->payloadOrNull($row);
            if ($account && $payload) {
                $this->toDrafts($row, $account, $payload);
            }
        }
        foreach (MailOutbox::query()->where('created_at', '<', now()->subDays(7))->get() as $old) {
            $this->clean($old);
            $old->delete();
        }

        return $done;
    }

    /** Not sent: kept in Drafts, and the sender is told why. */
    private function fail(MailOutbox $row, ?MailAccount $account, ?array $payload, string $reason): MailOutbox
    {
        $row->update(['status' => 'failed', 'error' => mb_substr($reason, 0, 480)]);
        if ($account && $payload) {
            $this->toDrafts($row, $account, $payload);
        }
        Log::warning('Mail not sent', ['outbox' => $row->id, 'reason' => $reason]);
        Notification::create([
            'user_id' => $row->user_id, 'type' => 'mail_failed',
            'title' => 'Mail not sent: '.mb_strimwidth($row->subject ?: '(no subject)', 0, 120, '…'),
            'message' => $reason.($row->in_drafts ? ' It is in Drafts.' : ''), 'data' => ['mail' => true], 'created_at' => now(),
        ]);

        return $row;
    }

    /** A quotation that was still a draft is Sent once its mail is out. */
    private function markQuotationSent(int $id): void
    {
        if (! $id) {
            return;
        }
        try {
            Quotation::query()->whereKey($id)->where('status', 'draft')
                ->update(['status' => 'sent', 'sent_via' => 'email', 'sent_at' => now()]);
        } catch (Throwable $e) {
            report($e);
        }
    }

    private function toDrafts(MailOutbox $row, MailAccount $account, array $payload): void
    {
        try {
            $this->saveDraft($account, $payload);
            $row->update(['in_drafts' => true]);
            $this->clean($row);
        } catch (Throwable $e) {
            // Kept on the server; the scheduler tries again
            Log::warning('Unsent mail could not be put in Drafts', ['outbox' => $row->id, 'error' => $e->getMessage()]);
        }
    }

    private function after(MailOutbox $row, MailAccount $account, array $payload, Email $email, array $bcc): void
    {
        try {
            if ($payload['reply_uid']) {
                (new MailReader($this->client($account), $payload['reply_folder'] ?: 'INBOX'))->flag($payload['reply_uid'], 'Answered', true);
            }
        } catch (Throwable) {
        }
        // Keep a copy in Sent so it also appears in Thunderbird
        try {
            if ($account->savesSentItself()) {
                $row->update(['in_sent' => true]);
            } elseif ($sent = $account->sent_folder ?: MailFolders::find($this->client($account), 'sent')) {
                $this->store($this->client($account), $sent, $email, $bcc, '\\Seen');
                $row->update(['in_sent' => true]);
            }
        } catch (Throwable $e) {
            Log::warning('Sent copy not saved', ['outbox' => $row->id, 'error' => $e->getMessage()]);
        }
        try {
            if ($payload['draft_uid'] && ($drafts = MailFolders::find($this->client($account), 'drafts'))) {
                (new MailReader($this->client($account), $drafts))->delete($payload['draft_uid']);
            }
        } catch (Throwable) {
        }
    }

    private function payload(MailOutbox $row): array
    {
        $payload = json_decode((string) @file_get_contents($row->dir().'/payload.json'), true);

        return is_array($payload) ? $payload : throw new MailSendProblem('The text of the mail was not found on the server.');
    }

    private function payloadOrNull(MailOutbox $row): ?array
    {
        try {
            return $this->payload($row);
        } catch (Throwable) {
            return null;
        }
    }

    public function clean(MailOutbox $row): void
    {
        if ($row->id) {
            File::deleteDirectory($row->dir());
        }
    }

    // ---------------------------------------------------------------- drafts

    /** @return array{uid: ?int, folder: string} */
    public function saveDraft(MailAccount $account, array $payload): array
    {
        $temporary = [];
        try {
            $client = $this->client($account);
            $path = MailFolders::find($client, 'drafts') ?? MailFolders::create($client, 'Drafts');
            $email = $this->compose($account, $payload, $temporary);
            $email->to(...MailAddresses::parse($payload['to']))->cc(...MailAddresses::parse($payload['cc']));
            $messageId = $email->getHeaders()->get('Message-ID')?->getBodyAsString() ?? '';
            $uid = $this->store($client, $path, $email, MailAddresses::parse($payload['bcc']), '\\Seen \\Draft');

            $reader = new MailReader($client, $path);
            $uid ??= $reader->findByMessageId($messageId);
            if ($payload['draft_uid'] && $payload['draft_uid'] !== $uid) {
                $reader->delete($payload['draft_uid']);
            }

            return ['uid' => $uid, 'folder' => $path];
        } finally {
            array_map('unlink', array_filter($temporary, 'is_file'));
        }
    }

    /** Writes the finished mail to a file and streams that to the folder. */
    private function store(Client $client, string $folder, Email $email, array $bcc, string $flags): ?int
    {
        MailFolders::open($client, $folder);
        $path = tempnam(sys_get_temp_dir(), 'mail');
        try {
            $handle = fopen($path, 'wb');
            // Symfony leaves Bcc out of the finished mail; our own copy keeps it
            if ($bcc) {
                fwrite($handle, 'Bcc: '.MailAddresses::header($bcc)."\r\n");
            }
            foreach ($email->toIterable() as $chunk) {
                fwrite($handle, $chunk);
            }
            fclose($handle);

            return (new MailReader($client, $folder))->append($folder, $path, $flags);
        } finally {
            @unlink($path);
        }
    }

    // ---------------------------------------------------------------- building

    /**
     * The mail as written, with new files and the attachments kept from another mail (forward, draft).
     *
     * @param  list<string>  $temporary  files to delete afterwards
     */
    private function compose(MailAccount $account, array $payload, array &$temporary): Email
    {
        $email = MailComposer::build($account, $payload['subject'], $payload['html']);

        $bytes = 0;
        foreach ($payload['files'] as $file) {
            if (! is_file($file['path'])) {
                throw new MailSendProblem("The attachment {$file['name']} was not found on the server. Attach it again.");
            }
            $bytes += filesize($file['path']);
            $email->attachFromPath($file['path'], $file['name'], $file['type']);
        }
        foreach ($payload['keep'] as $keep) {
            $client = $this->client($account);
            MailFolders::open($client, $keep['folder']);
            $reader = new MailReader($client, $keep['folder']);
            $attachment = $reader->attachment((int) $keep['uid'], $keep['part'])
                ?? throw new MailSendProblem('An attachment of the original mail is no longer there. Remove it and try again.');
            $bytes += $attachment['bytes'];
            if ($bytes > self::MAX_ATTACHMENTS) {
                break;
            }
            $path = tempnam(sys_get_temp_dir(), 'mail');
            $temporary[] = $path;
            $handle = fopen($path, 'wb');
            $reader->stream((int) $keep['uid'], $keep['part'], function (string $data) use ($handle): void {
                fwrite($handle, $data);
            }, $attachment['encoding']);
            fclose($handle);
            // A forwarded mail (.eml) travels as a plain file: message/rfc822 may not be base64
            $type = preg_match('#^[\w.+-]+/[\w.+-]+$#', $attachment['type']) && ! str_starts_with($attachment['type'], 'message/') ? $attachment['type'] : 'application/octet-stream';
            $email->attachFromPath($path, $attachment['name'], $type);
        }
        if ($bytes > self::MAX_ATTACHMENTS) {
            throw new MailSendProblem('The attachments are too large together (maximum 35 MB).');
        }
        $this->addThreadHeaders($account, $email, $payload);

        return $email;
    }

    /** In-Reply-To / References, so the reply lands in the same conversation; a draft keeps the ones it was saved with. */
    private function addThreadHeaders(MailAccount $account, Email $email, array $payload): void
    {
        if (! $payload['reply_uid'] && ! $payload['draft_uid']) {
            return;
        }
        try {
            $client = $this->client($account);
            $ids = fn (?string $value): array => preg_match_all('/<([^<>\s]+)>/', (string) $value, $m) ? $m[1] : [];
            if ($payload['reply_uid']) {
                $h = (new MailReader($client, $payload['reply_folder'] ?: 'INBOX'))->headers($payload['reply_uid'], ['Message-ID', 'References']);
                $replyTo = $ids($h['message-id'] ?? null);
                $references = [...$ids($h['references'] ?? null), ...$replyTo];
            } else {
                $drafts = MailFolders::find($client, 'drafts') ?? '';
                $h = (new MailReader($client, $drafts))->headers($payload['draft_uid'], ['In-Reply-To', 'References']);
                $replyTo = $ids($h['in-reply-to'] ?? null);
                $references = $ids($h['references'] ?? null);
            }
            if ($replyTo) {
                $email->getHeaders()->addTextHeader('In-Reply-To', '<'.$replyTo[0].'>');
            }
            if ($references) {
                $email->getHeaders()->addTextHeader('References', implode(' ', array_map(fn ($id) => "<{$id}>", array_slice(array_unique($references), -20))));
            }
        } catch (Throwable) {
            // Threading headers are a nicety; send anyway
        }
    }

    // ---------------------------------------------------------------- servers

    protected function client(MailAccount $account): Client
    {
        if (! $this->client || $this->clientFor !== $account->id || ! $this->client->isConnected()) {
            $this->client = MailInboxWatcher::connect($account);
            $this->clientFor = $account->id;
        }

        return $this->client;
    }

    protected function transport(MailAccount $account): SmtpTransport
    {
        $transport = new EsmtpTransport($account->smtp_host, $account->smtp_port, $account->smtp_encryption === 'ssl');
        if ($account->smtp_encryption === 'none') {
            $transport->setAutoTls(false);
        }
        $transport->setLocalDomain(MailComposer::domain($account));
        $transport->setUsername($account->username);
        $transport->setPassword($account->password);
        // The server checks a big mail for viruses before it answers
        $stream = $transport->getStream();
        if ($stream instanceof SocketStream) {
            $stream->setTimeout(300);
        }

        return $transport;
    }

    private function short(Throwable $e): string
    {
        return mb_strimwidth(trim((string) preg_replace('/\s+/', ' ', $e->getMessage())), 0, 300, '…') ?: 'Unknown error';
    }
}
