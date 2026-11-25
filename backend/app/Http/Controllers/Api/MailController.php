<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MailAccount;
use App\Models\MailOutbox;
use App\Models\User;
use App\Services\MailAddresses;
use App\Services\MailComposer;
use App\Services\MailFolders;
use App\Services\MailInboxWatcher;
use App\Services\MailReader;
use App\Services\MailSender;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\File;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\HeaderUtils;
use Symfony\Component\HttpFoundation\StreamedResponse;
use RuntimeException;
use Throwable;
use Webklex\PHPIMAP\Address;
use Webklex\PHPIMAP\Client;
use Webklex\PHPIMAP\Folder;
use Webklex\PHPIMAP\Message;

/**
 * Mail accounts (shared office mailboxes and the user's own): read over IMAP and send over SMTP, the same way
 * Thunderbird does. The account comes in the X-Mail-Account header. Sending goes through the outbox.
 */
class MailController extends Controller
{
    private const PER_PAGE = 25;

    // ---------------------------------------------------------------- reading

    /** Inbox unread count for the top-bar Mail button; also sends new-mail bell notifications. */
    public function unread(Request $request, MailInboxWatcher $watcher): JsonResponse
    {
        return response()->json($watcher->status($this->user(), $request->boolean('fresh')));
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
     * Admin: switch Mail (or the Documents button) on/off for one user. A user still on job-role defaults gets
     * those defaults written out (sent by the page) so nothing else changes for them.
     */
    public function setAccess(Request $request, User $user): JsonResponse
    {
        $this->requireUserAdmin();
        $values = $request->validate([
            'enabled' => 'required|boolean',
            'module' => ['nullable', 'in:mail,documents_site'],
            'defaults' => 'nullable|array',
            'defaults.*' => 'string',
        ]);

        $modules = $user->allowed_modules ?? array_values(array_intersect(User::FEATURE_KEYS, $values['defaults'] ?? []));
        $module = $values['module'] ?? 'mail';
        $modules = array_values(array_diff($modules, [$module]));
        if ($values['enabled']) {
            $modules[] = $module;
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
                'role' => MailFolders::role($folder->path),
                'unread' => $counts['unseen'],
                'total' => $counts['messages'],
            ];
        }
        usort($folders, fn ($a, $b) => [MailFolders::order($a['role']), $a['path']] <=> [MailFolders::order($b['role']), $b['path']]);

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
        $trash = MailFolders::find($client, 'trash');
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
            $to = MailFolders::find($client, $to) ?? MailFolders::create($client, $to === 'archive' ? 'Archive' : 'Junk');
        } else {
            $this->folder($client, $to);
        }
        abort_if($to === $from, 422, 'The mail is already in that folder.');

        $this->reader($client, $from)->move($uid, $to);

        return response()->json(['message' => 'Moved', 'folder' => $to]);
    }

    // ---------------------------------------------------------------- sending

    /** Takes the mail into the outbox, which is quick; the browser then asks for it to be sent (or the scheduler does). */
    public function send(Request $request): JsonResponse
    {
        $user = $this->user();
        $account = $this->account();
        $payload = $this->payload($request, $account);

        if (! MailAddresses::parse($payload['to'])) {
            return response()->json(['message' => 'Enter at least one valid email address in To.', 'errors' => ['to' => ['Enter a valid email address.']]], 422);
        }
        foreach (['to', 'cc', 'bcc'] as $field) {
            if ($bad = MailAddresses::invalid($payload[$field])) {
                return response()->json(['message' => 'This email address is not valid: '.implode(', ', $bad)], 422);
            }
        }

        $row = MailOutbox::create(['user_id' => $user->id, 'mail_account_id' => $account->id, 'subject' => mb_substr($payload['subject'], 0, 490), 'status' => 'preparing']);
        try {
            File::ensureDirectoryExists($row->dir(), 0700);
            foreach ($payload['files'] as $i => $file) {
                $path = $row->dir()."/{$i}.bin";
                if (! move_uploaded_file($file['path'], $path) && ! copy($file['path'], $path)) {
                    throw new RuntimeException('The attachment could not be stored.');
                }
                $payload['files'][$i]['path'] = $path;
            }
            if (file_put_contents($row->dir().'/payload.json', json_encode($payload, JSON_THROW_ON_ERROR | JSON_INVALID_UTF8_SUBSTITUTE)) === false) {
                throw new RuntimeException('The mail could not be stored.');
            }
        } catch (Throwable $e) {
            report($e);
            File::deleteDirectory($row->dir());
            $row->delete();

            return response()->json(['message' => 'The mail could not be taken for sending (the server may be out of space). Nothing was sent.'], 500);
        }
        $row->update(['status' => 'queued']);

        return response()->json(['data' => $row->toApi()], 202);
    }

    /** Sends a mail of the outbox now; goes on when the browser is closed. */
    public function runOutbox(MailOutbox $outbox, MailSender $sender): JsonResponse
    {
        abort_unless($outbox->user_id === (int) $this->user()->id, 404);
        $this->allowBigMail();

        return response()->json(['data' => $sender->run($outbox)->toApi()]);
    }

    public function outbox(MailOutbox $outbox): JsonResponse
    {
        abort_unless($outbox->user_id === (int) $this->user()->id, 404);

        return response()->json(['data' => $outbox->toApi()]);
    }

    /** Saves the compose window in the Drafts folder, in place of the draft it was opened from. */
    public function saveDraft(Request $request, MailSender $sender): JsonResponse
    {
        $this->user();
        $account = $this->account();
        $payload = $this->payload($request, $account);
        $this->allowBigMail();

        try {
            $saved = $sender->saveDraft($account, $payload);
            $attachments = $saved['uid'] ? $this->reader($this->client(), $saved['folder'])->content($saved['uid'])['attachments'] : [];
        } catch (Throwable $e) {
            return response()->json(['message' => 'The draft could not be saved: '.$e->getMessage()], 502);
        }

        return response()->json(['data' => $saved + ['attachments' => $attachments]]);
    }

    private function allowBigMail(): void
    {
        ini_set('memory_limit', '512M');
        set_time_limit(900);
        ignore_user_abort(true);
    }

    /** What was written, checked, as MailSender takes it */
    private function payload(Request $request, MailAccount $account): array
    {
        $request->validate([
            'to' => 'nullable|string|max:5000',
            'cc' => 'nullable|string|max:5000',
            'bcc' => 'nullable|string|max:5000',
            'subject' => 'nullable|string|max:500',
            'html' => 'nullable|string|max:20000000',
            'body' => 'nullable|string|max:200000',
            'reply_uid' => 'nullable|integer',
            'reply_folder' => 'nullable|string|max:255',
            'draft_uid' => 'nullable|integer',
            'quotation_id' => 'nullable|integer',
            'attachments' => 'nullable|array|max:20',
            'attachments.*' => 'file|max:20480',
            'keep' => 'nullable|array|max:50',
            'keep.*.folder' => 'required|string|max:255',
            'keep.*.uid' => 'required|integer',
            'keep.*.part' => ['required', 'string', 'regex:/^\d+(\.\d+)*$/'],
        ], [
            'html.max' => 'The text with its pictures is too large. Attach the pictures as files instead.',
            'attachments.max' => 'At most 20 new files at a time. Save the draft and add the rest.',
            'attachments.*.max' => 'A file is larger than 20 MB.',
            'attachments.*.uploaded' => 'A file could not be uploaded (maximum 20 MB each).',
        ]);

        $files = [];
        foreach ($request->file('attachments', []) as $file) {
            $files[] = [
                'path' => $file->getRealPath(),
                'name' => str_replace(["\r", "\n", '/', '\\'], ' ', $file->getClientOriginalName()),
                'type' => preg_match('#^[\w.+-]+/[\w.+-]+$#', (string) $file->getClientMimeType()) ? $file->getClientMimeType() : 'application/octet-stream',
            ];
        }
        abort_if(array_sum(array_map(fn ($f) => filesize($f['path']), $files)) > MailSender::MAX_ATTACHMENTS, 422, 'The attachments are too large together (maximum 35 MB).');

        $html = (string) $request->input('html', '');

        return [
            'to' => (string) $request->input('to', ''),
            'cc' => (string) $request->input('cc', ''),
            'bcc' => (string) $request->input('bcc', ''),
            'subject' => (string) $request->input('subject', ''),
            'html' => $html !== '' ? $html : MailComposer::fromPlainText((string) $request->input('body', '')),
            'reply_uid' => $request->integer('reply_uid') ?: null,
            'reply_folder' => (string) $request->input('reply_folder', ''),
            'draft_uid' => $request->integer('draft_uid') ?: null,
            'quotation_id' => $request->integer('quotation_id') ?: null,
            'keep' => array_map(fn ($k) => ['folder' => $k['folder'], 'uid' => (int) $k['uid'], 'part' => $k['part']], array_values($request->input('keep', []))),
            'files' => $files,
        ];
    }

    // ---------------------------------------------------------------- helpers

    private function requireUserAdmin(): void
    {
        $user = Auth::user();
        abort_unless($user instanceof User && $user->canManageUsers(), 403, 'Only an administrator can change who can open Mail.');
    }

    private function user(): User
    {
        $user = Auth::user();
        abort_unless(
            $user instanceof User && ($user->isFullAdmin() || in_array('mail', $user->allowed_modules ?? [], true)),
            403,
            'You do not have access to Mail.',
        );

        return $user;
    }

    /** The account chosen in the page, if the user may open it */
    private function account(): MailAccount
    {
        $user = $this->user();
        $id = (int) request()->header('X-Mail-Account');
        // A wrong account must never be used silently: the mail would go out from another address
        $account = $id ? MailAccount::visibleTo($user)->whereKey($id)->first() : MailAccount::forUser($user);
        abort_unless($account, $id ? 404 : 409, $id ? 'This mail account was removed. Choose another one.' : 'No mail account has been added yet.');

        return $account;
    }

    private function client(): Client
    {
        try {
            return MailInboxWatcher::connect($this->account());
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

    private function folder(Client $client, string $path): Folder
    {
        $folder = $client->getFolderByPath($path, false, true);
        abort_unless($folder, 404, 'Folder not found');

        return $folder;
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
}
