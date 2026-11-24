<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MailAccount;
use App\Models\User;
use App\Services\MailComposer;
use App\Services\MailInboxWatcher;
use App\Services\MailReader;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\HeaderUtils;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Symfony\Component\Mailer\Transport\Smtp\EsmtpTransport;
use Symfony\Component\Mime\Address as MimeAddress;
use Symfony\Component\Mime\Email;
use Throwable;
use Webklex\PHPIMAP\Address;
use Webklex\PHPIMAP\Client;
use Webklex\PHPIMAP\Folder;
use Webklex\PHPIMAP\Message;

/**
 * Shared office mailbox: read it over IMAP and send over SMTP, the same way
 * Thunderbird does. Sent mail is also saved to the server's Sent folder so it
 * shows up in Thunderbird too.
 */
class MailController extends Controller
{
    private const PER_PAGE = 25;

    /** All attachments of one mail together, before encoding */
    private const MAX_ATTACHMENTS = 35 * 1024 * 1024;

    // ---------------------------------------------------------------- settings

    public function settings(): JsonResponse
    {
        $this->requireAdmin();
        $account = MailAccount::current();

        return response()->json(['data' => $account ? $account->toArray() + ['has_password' => true] : null]);
    }

    public function saveSettings(Request $request): JsonResponse
    {
        $this->requireAdmin();
        $account = MailAccount::current();

        $values = $request->validate([
            'email' => 'required|email|max:255',
            'from_name' => 'nullable|string|max:255',
            'username' => 'required|string|max:255',
            'password' => [$account ? 'nullable' : 'required', 'string', 'max:500'],
            'imap_host' => 'required|string|max:255',
            'imap_port' => 'required|integer|min:1|max:65535',
            'imap_encryption' => 'required|in:ssl,tls,none',
            'smtp_host' => 'required|string|max:255',
            'smtp_port' => 'required|integer|min:1|max:65535',
            'smtp_encryption' => 'required|in:ssl,tls,none',
            'sent_folder' => 'nullable|string|max:255',
        ]);
        $values['from_name'] = trim((string) ($values['from_name'] ?? '')) ?: 'Namotech';
        $values['sent_folder'] ??= '';
        if (blank($values['password'] ?? null)) {
            unset($values['password']); // keep the saved password
        }
        $values['updated_by'] = Auth::id();

        $candidate = ($account ?? new MailAccount())->fill($values);

        // Only save details that actually log in.
        try {
            $this->connect($candidate)->disconnect();
        } catch (Throwable $e) {
            return response()->json(['message' => 'Could not log in to the mail server: '.$e->getMessage()], 422);
        }

        if ($account && $account->email !== $candidate->email) {
            $candidate->inbox_last_uid = null;
            $candidate->inbox_uidvalidity = null;
        }
        $candidate->save();
        Cache::forget('mail_inbox_status');

        return response()->json(['data' => $candidate->toArray() + ['has_password' => true]]);
    }

    // ---------------------------------------------------------------- reading

    public function status(): JsonResponse
    {
        $this->requireMailAccess();
        $account = MailAccount::current();

        return response()->json([
            'configured' => (bool) $account,
            'email' => $account?->email,
            'can_configure' => $this->isAdmin(),
        ]);
    }

    /** Inbox unread count for the top-bar Mail button; also sends new-mail bell notifications. */
    public function unread(Request $request, MailInboxWatcher $watcher): JsonResponse
    {
        $this->requireMailAccess();
        try {
            return response()->json($watcher->status($request->boolean('fresh')));
        } catch (Throwable $e) {
            return response()->json(['configured' => true, 'unread' => null, 'error' => $e->getMessage()]);
        }
    }

    /** Admin: who can open Mail. */
    public function access(): JsonResponse
    {
        $this->requireUserAdmin();

        $users = User::query()->orderBy('firstname')->orderBy('lastname')->get()->map(fn (User $u) => [
            'id' => $u->id,
            'name' => $u->name ?: $u->username,
            'username' => $u->username,
            'email' => $u->email,
            'is_admin' => $u->isFullAdmin(),
            'is_active' => $u->is_active !== false,
            'tracker_role' => $u->tracker_role,
            'allowed_modules' => $u->allowed_modules,
        ])->values();

        return response()->json(['data' => $users]);
    }

    /**
     * Admin: switch Mail on/off for one user. A user still on job-role defaults gets
     * those defaults written out (sent by the page) so nothing else changes for them.
     */
    public function setAccess(Request $request, User $user): JsonResponse
    {
        $this->requireUserAdmin();
        $values = $request->validate([
            'enabled' => 'required|boolean',
            'defaults' => 'nullable|array',
            'defaults.*' => 'string',
        ]);

        $modules = $user->allowed_modules ?? array_values(array_intersect(User::FEATURE_KEYS, $values['defaults'] ?? []));
        $modules = array_values(array_diff($modules, ['mail']));
        if ($values['enabled']) {
            $modules[] = 'mail';
        }
        $user->forceFill(['allowed_modules' => $modules])->save();

        return response()->json(['data' => ['id' => $user->id, 'allowed_modules' => $modules]]);
    }

    public function folders(): JsonResponse
    {
        $client = $this->client();

        $folders = [];
        foreach ($client->getFolders(false) as $folder) {
            /** @var Folder $folder */
            $counts = ['messages' => null, 'unseen' => null];
            try {
                $counts = $folder->status() + $counts;
            } catch (Throwable) {
                // Some servers refuse STATUS on special folders; show the folder without counts.
            }
            $folders[] = [
                'path' => $folder->path,
                'name' => $folder->name,
                'depth' => $folder->delimiter ? substr_count($folder->path, $folder->delimiter) : 0,
                'role' => $this->folderRole($folder->path),
                'unread' => $counts['unseen'],
                'total' => $counts['messages'],
            ];
        }
        usort($folders, fn ($a, $b) => [$this->roleOrder($a['role']), $a['path']] <=> [$this->roleOrder($b['role']), $b['path']]);

        return response()->json(['data' => $folders]);
    }

    public function messages(Request $request): JsonResponse
    {
        $request->validate(['folder' => 'nullable|string', 'page' => 'nullable|integer|min:1', 'search' => 'nullable|string|max:200', 'filter' => 'nullable|in:unread,starred']);
        $folder = $this->folder($this->client(), $request->input('folder', 'INBOX'));
        $page = (int) $request->input('page', 1);

        $query = $folder->query()->setFetchOrder('desc')->setFetchBody(false)->leaveUnread();
        $search = trim((string) $request->input('search', ''));
        $filter = $request->input('filter');
        if ($search !== '') $query->whereText($search);
        if ($filter === 'unread') $query->whereUnseen();
        if ($filter === 'starred') $query->where('FLAGGED');
        if ($search === '' && ! $filter) $query->whereAll();

        $total = $query->count();
        $messages = $total > 0 ? $query->limit(self::PER_PAGE, $page)->get() : collect();

        return response()->json([
            // Newest first, like Thunderbird sorted by date (the IMAP library hands each page back oldest-first).
            'data' => collect($messages)->map(fn (Message $m) => $this->summary($m))
                ->sortBy([
                    fn ($a, $b) => strtotime($b['date'] ?? '1970-01-01') <=> strtotime($a['date'] ?? '1970-01-01'),
                    fn ($a, $b) => $b['uid'] <=> $a['uid'],
                ])->values(),
            'total' => $total,
            'page' => $page,
            'per_page' => self::PER_PAGE,
        ]);
    }

    public function show(Request $request, int $uid): JsonResponse
    {
        $client = $this->client();
        $path = $request->input('folder', 'INBOX');
        $message = $this->message($client, $path, $uid);
        $reader = $this->reader($client, $path);
        $content = $reader->content($uid);
        $reader->flag($uid, 'Seen', true);

        return response()->json(['data' => ['seen' => true] + $this->summary($message) + [
            'to' => $this->addresses($message->getTo()->all()),
            'cc' => $this->addresses($message->getCc()->all()),
            'bcc' => $this->addresses($message->getBcc()->all()),
            'reply_to' => $this->addresses($message->getReplyTo()->all()),
            'html' => $content['html'],
            'text' => $content['text'],
            'attachments' => $content['attachments'],
        ]], 200, [], JSON_INVALID_UTF8_SUBSTITUTE);
    }

    /** Sent in small pieces, so a big attachment does not fill the memory. */
    public function attachment(Request $request, int $uid, string $part): StreamedResponse
    {
        $reader = $this->reader($this->client(), $request->input('folder', 'INBOX'));
        $attachment = $reader->attachment($uid, $part);
        abort_unless($attachment, 404, 'Attachment not found');
        set_time_limit(300);

        $name = str_replace(['/', '\\'], '-', $attachment['name']);
        $ascii = trim((string) preg_replace('/[^\x20-\x24\x26-\x7e]+/', '_', $name)) ?: 'attachment';

        return response()->stream(function () use ($reader, $uid, $part, $attachment): void {
            $reader->stream($uid, $part, function (string $bytes): void {
                echo $bytes;
                if (ob_get_level() > 0) {
                    ob_flush();
                }
                flush();
            }, $attachment['encoding']);
        }, 200, [
            'Content-Type' => preg_match('#^[\w.+-]+/[\w.+-]+$#', $attachment['type']) ? $attachment['type'] : 'application/octet-stream',
            'Content-Disposition' => HeaderUtils::makeDisposition('attachment', $name, $ascii),
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    public function destroy(Request $request, int $uid): JsonResponse
    {
        $client = $this->client();
        $path = $request->input('folder', 'INBOX');
        $trash = $this->findFolder($client, 'trash');
        $reader = $this->reader($client, $path);

        if ($trash && $trash !== $path) {
            $reader->move($uid, $trash);
        } else {
            $reader->delete($uid);
        }

        return response()->json(['message' => 'Deleted']);
    }

    /** Read / unread and star, like Thunderbird's M and S keys. */
    public function flags(Request $request, int $uid): JsonResponse
    {
        $values = $request->validate(['seen' => 'sometimes|boolean', 'flagged' => 'sometimes|boolean']);
        $reader = $this->reader($this->client(), $request->input('folder', 'INBOX'));

        foreach (['seen' => 'Seen', 'flagged' => 'Flagged'] as $key => $flag) {
            if (array_key_exists($key, $values)) {
                $reader->flag($uid, $flag, (bool) $values[$key]);
            }
        }

        return response()->json(['message' => 'Updated']);
    }

    /** Move to Archive / Junk (created if missing) or to a given folder path. */
    public function move(Request $request, int $uid): JsonResponse
    {
        $request->validate(['to' => 'required|string|max:255']);
        $client = $this->client();
        $from = $request->input('folder', 'INBOX');
        $to = $request->input('to');

        if (in_array($to, ['archive', 'junk'], true)) {
            $to = $this->findFolder($client, $to) ?? $this->createFolder($client, $to === 'archive' ? 'Archive' : 'Junk');
        } else {
            $this->folder($client, $to);
        }
        abort_if($to === $from, 422, 'The mail is already in that folder.');

        $this->reader($client, $from)->move($uid, $to);

        return response()->json(['message' => 'Moved', 'folder' => $to]);
    }

    // ---------------------------------------------------------------- sending

    public function send(Request $request): JsonResponse
    {
        $this->requireMailAccess();
        $account = $this->account();
        $this->validateCompose($request);

        $to = $this->parseAddressList($request->input('to'));
        $cc = $this->parseAddressList($request->input('cc'));
        $bcc = $this->parseAddressList($request->input('bcc'));
        if (! $to) {
            return response()->json(['message' => 'Enter at least one valid email address in To.', 'errors' => ['to' => ['Enter a valid email address.']]], 422);
        }
        foreach (['to' => $to, 'cc' => $cc, 'bcc' => $bcc] as $field => $list) {
            if ($bad = $this->invalidAddresses($request->input($field))) {
                return response()->json(['message' => 'This email address is not valid: '.implode(', ', $bad)], 422);
            }
        }

        $client = $this->client();
        [$email, $temporary] = $this->compose($request, $account, $client);
        try {
            $email->to(...$to)->cc(...$cc)->bcc(...$bcc);

            try {
                $transport = new EsmtpTransport($account->smtp_host, $account->smtp_port, $account->smtp_encryption === 'ssl');
                if ($account->smtp_encryption === 'none') {
                    $transport->setAutoTls(false);
                }
                $transport->setLocalDomain(MailComposer::domain($account));
                $transport->setUsername($account->username);
                $transport->setPassword($account->password);
                $transport->send($email);
            } catch (Throwable $e) {
                return response()->json(['message' => 'The mail server did not accept the message: '.$e->getMessage()], 502);
            }

            // The mail is out: nothing below may make it look as if sending failed.
            try {
                if ($request->filled('reply_uid')) {
                    $this->reader($client, $request->input('reply_folder') ?: 'INBOX')->flag((int) $request->input('reply_uid'), 'Answered', true);
                }
            } catch (Throwable) {
            }
            // Keep a copy in Sent so it also appears in Thunderbird.
            $saved = true;
            try {
                $sent = $account->sent_folder ?: $this->findFolder($client, 'sent');
                if ($sent) {
                    $this->folder($client, $sent)->appendMessage($email->toString(), ['\\Seen']);
                }
            } catch (Throwable) {
                $saved = false;
            }
            try {
                if ($request->filled('draft_uid') && ($drafts = $this->findFolder($client, 'drafts'))) {
                    $this->reader($client, $drafts)->delete((int) $request->input('draft_uid'));
                }
            } catch (Throwable) {
            }
        } finally {
            array_map('unlink', array_filter($temporary, 'is_file'));
        }

        return response()->json(['message' => 'Sent', 'saved' => $saved]);
    }

    /** Saves the compose window in the Drafts folder, in place of the draft it was opened from. */
    public function saveDraft(Request $request): JsonResponse
    {
        $this->requireMailAccess();
        $account = $this->account();
        $this->validateCompose($request);

        $client = $this->client();
        $path = $this->findFolder($client, 'drafts') ?? $this->createFolder($client, 'Drafts');
        [$email, $temporary] = $this->compose($request, $account, $client);
        try {
            $email->to(...$this->parseAddressList($request->input('to')))->cc(...$this->parseAddressList($request->input('cc')));
            $bcc = $this->parseAddressList($request->input('bcc'));
            $messageId = $email->getHeaders()->get('Message-ID')?->getBodyAsString() ?? '';
            // Symfony leaves Bcc out of the finished mail; a draft has to keep it
            $source = ($bcc ? 'Bcc: '.implode(', ', array_map(fn (MimeAddress $a) => $a->getName() === '' ? $a->getAddress() : $a->toString(), $bcc))."\r\n" : '').$email->toString();
            $this->folder($client, $path)->appendMessage($source, ['\\Seen', '\\Draft']);

            $reader = $this->reader($client, $path);
            $uid = $reader->findByMessageId($messageId);
            if ($request->filled('draft_uid') && (int) $request->input('draft_uid') !== $uid) {
                $reader->delete((int) $request->input('draft_uid'));
            }
        } finally {
            array_map('unlink', array_filter($temporary, 'is_file'));
        }

        return response()->json(['data' => [
            'uid' => $uid,
            'folder' => $path,
            'attachments' => $uid ? $reader->content($uid)['attachments'] : [],
        ]]);
    }

    private function validateCompose(Request $request): void
    {
        // Forwarding can carry a mail of 48 MB
        ini_set('memory_limit', '512M');
        set_time_limit(300);

        $request->validate([
            'to' => 'nullable|string|max:5000',
            'cc' => 'nullable|string|max:5000',
            'bcc' => 'nullable|string|max:5000',
            'subject' => 'nullable|string|max:500',
            'html' => 'nullable|string|max:15000000',
            'body' => 'nullable|string|max:200000',
            'reply_uid' => 'nullable|integer',
            'reply_folder' => 'nullable|string',
            'draft_uid' => 'nullable|integer',
            'attachments' => 'nullable|array|max:20',
            'attachments.*' => 'file|max:20480',
            'keep' => 'nullable|array|max:50',
            'keep.*.folder' => 'required|string|max:255',
            'keep.*.uid' => 'required|integer',
            'keep.*.part' => ['required', 'string', 'regex:/^\d+(\.\d+)*$/'],
        ]);
    }

    /**
     * The mail as written, with new files and the attachments kept from another mail (forward, draft).
     *
     * @return array{0: Email, 1: list<string>} the mail and the temporary files to delete afterwards
     */
    private function compose(Request $request, MailAccount $account, Client $client): array
    {
        $html = (string) $request->input('html', '');
        if ($html === '') {
            $html = MailComposer::fromPlainText((string) $request->input('body', ''));
        }
        $email = MailComposer::build($account, (string) $request->input('subject', ''), $html);

        $bytes = 0;
        $temporary = [];
        try {
            foreach ($request->file('attachments', []) as $file) {
                $bytes += $file->getSize();
                $email->attachFromPath($file->getRealPath(), $file->getClientOriginalName(), $file->getClientMimeType());
            }
            foreach ($request->input('keep', []) as $keep) {
                $reader = $this->reader($client, $keep['folder']);
                $attachment = $reader->attachment((int) $keep['uid'], $keep['part']);
                abort_unless($attachment, 422, 'An attachment of the original mail is no longer there. Remove it and try again.');
                $bytes += $attachment['bytes'];
                abort_if($bytes > self::MAX_ATTACHMENTS, 422, 'The attachments are too large together (maximum 35 MB).');

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
            abort_if($bytes > self::MAX_ATTACHMENTS, 422, 'The attachments are too large together (maximum 35 MB).');
            $this->addThreadHeaders($request, $email, $client);
        } catch (Throwable $e) {
            array_map('unlink', array_filter($temporary, 'is_file'));
            throw $e;
        }

        return [$email, $temporary];
    }

    /** In-Reply-To / References, so the reply lands in the same conversation; a draft keeps the ones it was saved with. */
    private function addThreadHeaders(Request $request, Email $email, Client $client): void
    {
        try {
            $ids = fn (?string $value): array => preg_match_all('/<([^<>\s]+)>/', (string) $value, $m) ? $m[1] : [];
            if ($request->filled('reply_uid')) {
                $h = $this->reader($client, $request->input('reply_folder') ?: 'INBOX')->headers((int) $request->input('reply_uid'), ['Message-ID', 'References']);
                $replyTo = $ids($h['message-id'] ?? null);
                $references = [...$ids($h['references'] ?? null), ...$replyTo];
            } elseif ($request->filled('draft_uid') && ($drafts = $this->findFolder($client, 'drafts'))) {
                $h = $this->reader($client, $drafts)->headers((int) $request->input('draft_uid'), ['In-Reply-To', 'References']);
                $replyTo = $ids($h['in-reply-to'] ?? null);
                $references = $ids($h['references'] ?? null);
            } else {
                return;
            }
            if ($replyTo) {
                $email->getHeaders()->addTextHeader('In-Reply-To', '<'.$replyTo[0].'>');
            }
            if ($references) {
                $email->getHeaders()->addTextHeader('References', implode(' ', array_map(fn ($id) => "<{$id}>", array_slice(array_unique($references), -20))));
            }
        } catch (Throwable) {
            // Threading headers are a nicety; send anyway.
        }
    }

    // ---------------------------------------------------------------- helpers

    private function isAdmin(): bool
    {
        $user = Auth::user();

        return $user instanceof User && $user->isFullAdmin();
    }

    private function requireAdmin(): void
    {
        abort_unless($this->isAdmin(), 403, 'Only an administrator can change the mail settings.');
    }

    private function requireUserAdmin(): void
    {
        $user = Auth::user();
        abort_unless($user instanceof User && $user->canManageUsers(), 403, 'Only an administrator can change who can open Mail.');
    }

    private function requireMailAccess(): void
    {
        $user = Auth::user();
        abort_unless(
            $user instanceof User && ($user->isFullAdmin() || in_array('mail', $user->allowed_modules ?? [], true)),
            403,
            'You do not have access to Mail.',
        );
    }

    private function account(): MailAccount
    {
        $account = MailAccount::current();
        abort_unless($account, 409, 'The office mailbox has not been set up yet.');

        return $account;
    }

    private function client(): Client
    {
        $this->requireMailAccess();
        try {
            return $this->connect($this->account());
        } catch (Throwable $e) {
            abort(response()->json(['message' => 'Could not connect to the mail server: '.$e->getMessage()], 502));
        }
    }

    /** Headers and flags of one mail, without downloading it. */
    private function message(Client $client, string $path, int $uid): Message
    {
        return $this->folder($client, $path)->query()->setFetchBody(false)->leaveUnread()->getMessageByUid($uid);
    }

    private function reader(Client $client, string $path): MailReader
    {
        $this->folder($client, $path);

        return new MailReader($client, $path);
    }

    private function connect(MailAccount $account): Client
    {
        return MailInboxWatcher::connect($account);
    }

    private function folder(Client $client, string $path): Folder
    {
        $folder = $client->getFolderByPath($path, false, true);
        abort_unless($folder, 404, 'Folder not found');

        return $folder;
    }

    /** First folder whose name looks like the given role (sent / trash / ...). */
    private function findFolder(Client $client, string $role): ?string
    {
        foreach ($client->getFolders(false) as $folder) {
            if ($this->folderRole($folder->path) === $role) {
                return $folder->path;
            }
        }

        return null;
    }

    private function createFolder(Client $client, string $name): string
    {
        // cPanel/Dovecot keeps folders under "INBOX." — follow whatever the server already uses.
        /** @var Folder|null $sample */
        $sample = collect($client->getFolders(false))->first(fn (Folder $f) => $f->path !== 'INBOX');
        $path = $sample && str_starts_with($sample->path, 'INBOX'.$sample->delimiter)
            ? 'INBOX'.$sample->delimiter.$name
            : $name;
        $client->createFolder($path, false);

        return $path;
    }

    private function folderRole(string $path): string
    {
        $name = strtolower($path);

        return match (true) {
            $name === 'inbox' => 'inbox',
            (bool) preg_match('/\bsent\b|sent items|sent mail/', $name) => 'sent',
            (bool) preg_match('/draft/', $name) => 'drafts',
            (bool) preg_match('/junk|spam/', $name) => 'junk',
            (bool) preg_match('/trash|deleted|bin\b/', $name) => 'trash',
            (bool) preg_match('/archive/', $name) => 'archive',
            default => 'other',
        };
    }

    private function roleOrder(string $role): int
    {
        return ['inbox' => 0, 'sent' => 1, 'drafts' => 2, 'archive' => 3, 'junk' => 4, 'trash' => 5][$role] ?? 6;
    }

    private function summary(Message $message): array
    {
        $from = $message->getFrom()->first();
        $date = null;
        try {
            $date = $message->getDate()->toDate()->toIso8601String();
        } catch (Throwable) {
        }

        $to = $message->getTo()->first();
        $flags = $message->getFlags();
        $contentType = '';
        try {
            $contentType = strtolower((string) $message->getHeader()?->get('content_type'));
        } catch (Throwable) {
        }

        return [
            'uid' => (int) $message->getUid(),
            'subject' => MailInboxWatcher::decodeHeader((string) $message->getSubject()) ?: '(no subject)',
            'from' => $from instanceof Address ? ['name' => MailInboxWatcher::decodeHeader($from->personal), 'email' => $from->mail] : null,
            'to_first' => $to instanceof Address ? ['name' => MailInboxWatcher::decodeHeader($to->personal), 'email' => $to->mail] : null,
            'date' => $date,
            'seen' => $flags->has('seen'),
            'flagged' => $flags->has('flagged'),
            'answered' => $flags->has('answered'),
            // multipart/mixed is how mail carries attachments; good enough for the paperclip column
            'has_attachment' => str_contains($contentType, 'multipart/mixed'),
        ];
    }

    /** @param array<int, mixed> $list */
    private function addresses(array $list): array
    {
        return array_values(array_map(
            fn (Address $a) => ['name' => MailInboxWatcher::decodeHeader($a->personal), 'email' => $a->mail],
            array_filter($list, fn ($a) => $a instanceof Address),
        ));
    }

    /** Parts of an address list that are not valid addresses, so nobody is silently left out. */
    private function invalidAddresses(?string $input): array
    {
        $parts = array_filter(array_map('trim', $this->splitAddressList($input)), fn ($p) => $p !== '');

        return array_values(array_filter($parts, fn ($p) => ! $this->parseAddressList($p)));
    }

    /** Splits at , and ; but not inside "quoted, names". */
    private function splitAddressList(?string $input): array
    {
        return preg_split('/[,;]+(?=(?:[^"]*"[^"]*")*[^"]*$)/', (string) $input) ?: [];
    }

    /** "a@x.com, Name <b@y.com>; c@z.com" => list of valid addresses. */
    private function parseAddressList(?string $input): array
    {
        $out = [];
        foreach ($this->splitAddressList($input) as $part) {
            $part = trim($part);
            if ($part === '') {
                continue;
            }
            if (preg_match('/^(.*)<([^>]+)>$/', $part, $m)) {
                $name = trim($m[1], " \"'");
                $mail = trim($m[2]);
            } else {
                $name = '';
                $mail = $part;
            }
            if (filter_var($mail, FILTER_VALIDATE_EMAIL)) {
                $out[] = new MimeAddress($mail, $name);
            }
        }

        return $out;
    }
}
