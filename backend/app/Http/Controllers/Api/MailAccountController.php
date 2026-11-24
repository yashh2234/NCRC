<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MailAccount;
use App\Models\MailOutbox;
use App\Models\User;
use App\Services\MailAddresses;
use App\Services\MailInboxWatcher;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Validation\ValidationException;
use Symfony\Component\Mailer\Transport\Smtp\EsmtpTransport;
use Throwable;

/** Mail accounts: admins add shared office mailboxes, everyone with Mail access can add their own. */
class MailAccountController extends Controller
{
    private const IMAP_PORTS = [993, 143];

    private const SMTP_PORTS = [465, 587, 25, 2525];

    public function index(): JsonResponse
    {
        $user = $this->user();

        return response()->json([
            'data' => MailAccount::visibleTo($user)->get()->map(fn (MailAccount $a) => [
                'id' => $a->id,
                'email' => $a->email,
                'from_name' => $a->from_name,
                'shared' => $a->isShared(),
                'can_manage' => $a->canBeManagedBy($user),
                'default_bcc' => $a->default_bcc,
                'unread' => Cache::get(MailInboxWatcher::cacheKey($a))['unread'] ?? null,
            ])->values(),
            'can_share' => $user->isFullAdmin(),
            'default_bcc' => MailAccount::DEFAULT_BCC,
        ]);
    }

    public function show(MailAccount $account): JsonResponse
    {
        $this->requireManage($account);

        return response()->json(['data' => $this->settings($account)]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $this->user();
        $values = $this->validated($request, null, $user);
        $values['owner_id'] = $request->boolean('shared') && $user->isFullAdmin() ? null : $user->id;
        if (MailAccount::visibleTo($user)->whereRaw('lower(email) = ?', [strtolower($values['email'])])->exists()) {
            throw ValidationException::withMessages(['email' => 'This account is already added.']);
        }
        $account = (new MailAccount())->fill($values);
        $this->checkLogin($account);
        $account->save();

        return response()->json(['data' => $this->settings($account)], 201);
    }

    public function update(Request $request, MailAccount $account): JsonResponse
    {
        $this->requireManage($account);
        $user = $this->user();
        $emailBefore = $account->email;
        $account->fill($this->validated($request, $account, $user));
        $taken = MailAccount::visibleTo($user)->whereKeyNot($account->id)->whereRaw('lower(email) = ?', [strtolower($account->email)])->exists();
        if ($taken) {
            throw ValidationException::withMessages(['email' => 'This account is already added.']);
        }
        $this->checkLogin($account);
        if ($emailBefore !== $account->email) {
            $account->forceFill(['inbox_last_uid' => null, 'inbox_uidvalidity' => null]);
        }
        $account->save();
        Cache::forget(MailInboxWatcher::cacheKey($account));

        return response()->json(['data' => $this->settings($account)]);
    }

    /** Takes the account out of the app; the mails stay on the mail server. */
    public function destroy(MailAccount $account): JsonResponse
    {
        $this->requireManage($account);
        abort_if(MailOutbox::query()->where('mail_account_id', $account->id)->whereIn('status', ['queued', 'sending'])->exists(), 422, 'A mail is still being sent from this account. Try again in a minute.');
        Cache::forget(MailInboxWatcher::cacheKey($account));
        $account->delete();

        return response()->json(['message' => 'Removed']);
    }

    private function settings(MailAccount $account): array
    {
        return $account->only(['id', 'email', 'from_name', 'username', 'imap_host', 'imap_port', 'imap_encryption', 'smtp_host', 'smtp_port', 'smtp_encryption', 'sent_folder', 'default_bcc'])
            + ['shared' => $account->isShared(), 'has_password' => true];
    }

    private function validated(Request $request, ?MailAccount $account, User $user): array
    {
        $values = $request->validate([
            'email' => 'required|email|max:255',
            'from_name' => 'nullable|string|max:255',
            'username' => 'nullable|string|max:255',
            'password' => [$account ? 'nullable' : 'required', 'string', 'max:500'],
            'imap_host' => ['required', 'string', 'max:255', 'regex:/^[A-Za-z0-9.-]+$/'],
            'imap_port' => ['required', 'integer', 'in:'.implode(',', self::IMAP_PORTS)],
            'imap_encryption' => 'required|in:ssl,tls,none',
            'smtp_host' => ['required', 'string', 'max:255', 'regex:/^[A-Za-z0-9.-]+$/'],
            'smtp_port' => ['required', 'integer', 'in:'.implode(',', self::SMTP_PORTS)],
            'smtp_encryption' => 'required|in:ssl,tls,none',
            'sent_folder' => 'nullable|string|max:255',
            'default_bcc' => 'nullable|string|max:1000',
        ], [
            'imap_host.regex' => 'Enter only the incoming server name, like mail.namotech.in',
            'smtp_host.regex' => 'Enter only the outgoing server name, like mail.namotech.in',
            'imap_port.in' => 'The incoming port must be 993 or 143.',
            'smtp_port.in' => 'The outgoing port must be 465, 587, 25 or 2525.',
        ]);
        if ($bad = MailAddresses::invalid($values['default_bcc'] ?? '')) {
            throw ValidationException::withMessages(['default_bcc' => 'This Bcc address is not valid: '.implode(', ', $bad)]);
        }
        if (! $user->isFullAdmin()) {
            $this->requirePublicServer($values);
        }
        $password = $values['password'] ?? null;
        unset($values['password']);
        if (filled($password)) {
            // Google shows its app password in four groups; the spaces are not part of it
            $values['password'] = preg_match('/^[a-z]{4}( [a-z]{4}){3}$/', trim($password)) ? str_replace(' ', '', trim($password)) : $password;
        } elseif ($account && ($account->imap_host !== $values['imap_host'] || $account->smtp_host !== $values['smtp_host'])) {
            // A saved password is never sent to a server it was not entered for
            throw ValidationException::withMessages(['password' => 'Enter the password again when the server is changed.']);
        }

        return array_merge($values, [
            'email' => trim($values['email']),
            // Mailboxes log in with the full email address unless told otherwise
            'username' => trim((string) ($values['username'] ?? '')) ?: trim($values['email']),
            'from_name' => trim((string) ($values['from_name'] ?? '')) ?: 'Namotech',
            'sent_folder' => (string) ($values['sent_folder'] ?? ''),
            'default_bcc' => trim((string) ($values['default_bcc'] ?? '')),
            'updated_by' => $user->id,
        ]);
    }

    /** Users other than admins can only point the app to mail servers on the internet, with encryption. */
    private function requirePublicServer(array $values): void
    {
        foreach (['imap', 'smtp'] as $kind) {
            $host = $values["{$kind}_host"];
            $ips = filter_var($host, FILTER_VALIDATE_IP) ? [$host] : (gethostbynamel($host) ?: []);
            $public = array_filter($ips, fn ($ip) => filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE));
            if (! $ips || count($public) !== count($ips)) {
                throw ValidationException::withMessages(["{$kind}_host" => "The server {$host} was not found."]);
            }
            if ($values["{$kind}_encryption"] === 'none') {
                throw ValidationException::withMessages(["{$kind}_encryption" => 'Choose SSL/TLS or STARTTLS.']);
            }
        }
    }

    /** Only save details that actually log in, for reading and for sending. */
    private function checkLogin(MailAccount $account): void
    {
        $gmail = $account->savesSentItself() ? ' Gmail needs an app password (Google Account → Security → 2-Step Verification → App passwords), not the normal one.' : '';
        try {
            MailInboxWatcher::connect($account)->disconnect();
        } catch (Throwable $e) {
            abort(response()->json(['message' => 'Could not log in to read mails: '.$e->getMessage().'.'.$gmail], 422));
        }
        try {
            $transport = new EsmtpTransport($account->smtp_host, $account->smtp_port, $account->smtp_encryption === 'ssl');
            if ($account->smtp_encryption === 'none') {
                $transport->setAutoTls(false);
            }
            $transport->setUsername($account->username);
            $transport->setPassword($account->password);
            $transport->start();
            $transport->stop();
        } catch (Throwable $e) {
            abort(response()->json(['message' => 'Reading works, but could not log in to send mails: '.$e->getMessage().$gmail], 422));
        }
    }

    private function user(): User
    {
        $user = Auth::user();
        abort_unless($user instanceof User && ($user->isFullAdmin() || in_array('mail', $user->allowed_modules ?? [], true)), 403, 'You do not have access to Mail.');

        return $user;
    }

    private function requireManage(MailAccount $account): void
    {
        $user = $this->user();
        // Another user's own account is as good as not there
        abort_unless(MailAccount::visibleTo($user)->whereKey($account->id)->exists(), 404, 'Account not found');
        abort_unless($account->canBeManagedBy($user), 403, 'Only an administrator can change a shared account.');
    }
}
