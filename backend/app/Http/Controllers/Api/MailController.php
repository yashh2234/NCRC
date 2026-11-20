<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MailAccount;
use App\Models\User;
use App\Services\MailInboxWatcher;
use Illuminate\Support\Facades\Cache;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Symfony\Component\Mailer\Mailer;
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
        $values['from_name'] ??= '';
        $values['sent_folder'] ??= '';
        if (blank($values['password'] ?? null)) {
            unset($values['password']); // keep the saved password
        }
        $values['updated_by'] = auth()->id();

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
            'data' => collect($messages)->map(fn (Message $m) => $this->summary($m))->values(),
            'total' => $total,
            'page' => $page,
            'per_page' => self::PER_PAGE,
        ]);
    }

    public function show(Request $request, int $uid): JsonResponse
    {
        $folder = $this->folder($this->client(), $request->input('folder', 'INBOX'));
        $message = $folder->query()->setFetchBody(true)->leaveUnread()->getMessageByUid($uid);
        $message->setFlag('Seen');

        $attachments = [];
        foreach ($message->getAttachments()->values() as $index => $attachment) {
            $attachments[] = [
                'index' => $index,
                'name' => MailInboxWatcher::decodeHeader($attachment->name) ?: 'attachment-'.($index + 1),
                'size' => (int) $attachment->size,
                'type' => $attachment->content_type,
            ];
        }

        return response()->json(['data' => $this->summary($message) + [
            'seen' => true,
            'to' => $this->addresses($message->getTo()->all()),
            'cc' => $this->addresses($message->getCc()->all()),
            'reply_to' => $this->addresses($message->getReplyTo()->all()),
            'html' => $message->hasHTMLBody() ? $message->getHTMLBody() : null,
            'text' => $message->getTextBody(),
            'attachments' => $attachments,
        ]]);
    }

    public function attachment(Request $request, int $uid, int $index): Response
    {
        $folder = $this->folder($this->client(), $request->input('folder', 'INBOX'));
        $message = $folder->query()->setFetchBody(true)->leaveUnread()->getMessageByUid($uid);
        $attachment = $message->getAttachments()->values()->get($index);
        abort_unless($attachment, 404, 'Attachment not found');

        $name = MailInboxWatcher::decodeHeader($attachment->name) ?: 'attachment-'.($index + 1);

        return response($attachment->content, 200, [
            'Content-Type' => $attachment->content_type ?: 'application/octet-stream',
            'Content-Disposition' => 'attachment; filename="'.addcslashes($name, '"\\').'"',
        ]);
    }

    public function destroy(Request $request, int $uid): JsonResponse
    {
        $client = $this->client();
        $path = $request->input('folder', 'INBOX');
        $message = $this->folder($client, $path)->query()->leaveUnread()->getMessageByUid($uid);

        $trash = $this->findFolder($client, 'trash');
        if ($trash && $trash !== $path) {
            $message->move($trash, true);
        } else {
            $message->delete(true);
        }

        return response()->json(['message' => 'Deleted']);
    }

    /** Read / unread and star, like Thunderbird's M and S keys. */
    public function flags(Request $request, int $uid): JsonResponse
    {
        $values = $request->validate(['seen' => 'sometimes|boolean', 'flagged' => 'sometimes|boolean']);
        $message = $this->folder($this->client(), $request->input('folder', 'INBOX'))->query()->leaveUnread()->getMessageByUid($uid);

        foreach (['seen' => 'Seen', 'flagged' => 'Flagged'] as $key => $flag) {
            if (array_key_exists($key, $values)) {
                $values[$key] ? $message->setFlag($flag) : $message->unsetFlag($flag);
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

        $this->folder($client, $from)->query()->leaveUnread()->getMessageByUid($uid)->move($to, true);

        return response()->json(['message' => 'Moved', 'folder' => $to]);
    }

    // ---------------------------------------------------------------- sending

    public function send(Request $request): JsonResponse
    {
        $this->requireMailAccess();
        $account = $this->account();

        $original = null;
        $request->validate([
            'to' => 'required|string|max:2000',
            'cc' => 'nullable|string|max:2000',
            'bcc' => 'nullable|string|max:2000',
            'subject' => 'nullable|string|max:500',
            'body' => 'nullable|string|max:200000',
            'reply_uid' => 'nullable|integer',
            'reply_folder' => 'nullable|string',
            'attachments' => 'nullable|array|max:10',
            'attachments.*' => 'file|max:20480',
        ]);

        $to = $this->parseAddressList($request->input('to'));
        $cc = $this->parseAddressList($request->input('cc', ''));
        $bcc = $this->parseAddressList($request->input('bcc', ''));
        if (! $to) {
            return response()->json(['message' => 'Enter at least one valid email address in To.', 'errors' => ['to' => ['Enter a valid email address.']]], 422);
        }

        $body = (string) $request->input('body', '');
        $email = (new Email())
            ->from(new MimeAddress($account->email, $account->from_name ?: ''))
            ->to(...$to)
            ->subject((string) $request->input('subject', ''))
            ->text($body)
            ->html('<div style="font-family:Arial,sans-serif;font-size:14px;white-space:pre-wrap">'.nl2br(e($body), false).'</div>');
        if ($cc) {
            $email->cc(...$cc);
        }
        if ($bcc) {
            $email->bcc(...$bcc);
        }
        foreach ($request->file('attachments', []) as $file) {
            $email->attachFromPath($file->getRealPath(), $file->getClientOriginalName(), $file->getClientMimeType());
        }

        if ($request->filled('reply_uid')) {
            try {
                $original = $this->folder($this->client(), $request->input('reply_folder', 'INBOX'))
                    ->query()->leaveUnread()->getMessageByUid((int) $request->input('reply_uid'));
                $messageId = trim((string) $original->message_id, '<> ');
                if ($messageId !== '') {
                    $email->getHeaders()->addIdHeader('In-Reply-To', $messageId);
                    $email->getHeaders()->addIdHeader('References', $messageId);
                }
            } catch (Throwable) {
                // Threading headers are a nicety; send anyway.
            }
        }

        try {
            $transport = new EsmtpTransport($account->smtp_host, $account->smtp_port, $account->smtp_encryption === 'ssl');
            if ($account->smtp_encryption === 'none') {
                $transport->setAutoTls(false);
            }
            $transport->setUsername($account->username);
            $transport->setPassword($account->password);
            (new Mailer($transport))->send($email);
        } catch (Throwable $e) {
            return response()->json(['message' => 'The mail server did not accept the message: '.$e->getMessage()], 502);
        }

        try {
            $original?->setFlag('Answered');
        } catch (Throwable) {
        }

        // Keep a copy in Sent so it also appears in Thunderbird.
        try {
            $client = $this->client();
            $sent = $account->sent_folder ?: $this->findFolder($client, 'sent');
            if ($sent) {
                $this->folder($client, $sent)->appendMessage($email->toString(), ['\\Seen']);
            }
        } catch (Throwable) {
            // The mail went out; a missing Sent copy is not worth failing the request.
        }

        return response()->json(['message' => 'Sent']);
    }

    // ---------------------------------------------------------------- helpers

    private function isAdmin(): bool
    {
        $user = auth()->user();

        return $user instanceof User && $user->isFullAdmin();
    }

    private function requireAdmin(): void
    {
        abort_unless($this->isAdmin(), 403, 'Only an administrator can change the mail settings.');
    }

    private function requireUserAdmin(): void
    {
        $user = auth()->user();
        abort_unless($user instanceof User && $user->canManageUsers(), 403, 'Only an administrator can change who can open Mail.');
    }

    private function requireMailAccess(): void
    {
        $user = auth()->user();
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

    /** "a@x.com, Name <b@y.com>; c@z.com" => list of valid addresses. */
    private function parseAddressList(?string $input): array
    {
        $out = [];
        foreach (preg_split('/[,;]+/', (string) $input) as $part) {
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
