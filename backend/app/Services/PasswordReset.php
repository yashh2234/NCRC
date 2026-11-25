<?php

namespace App\Services;

use App\Models\LoginSession;
use App\Models\MailAccount;
use App\Models\Notification;
use App\Models\User;
use App\Models\UserActivity;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;
use RuntimeException;
use Symfony\Component\Mailer\Transport\Smtp\EsmtpTransport;
use Symfony\Component\Mailer\Transport\Smtp\Stream\SocketStream;
use Throwable;

/** Forgotten passwords: a 6-digit code goes to the user's own email address. */
class PasswordReset
{
    public const MINUTES = 15;

    private const TRIES = 5;

    /** Codes for one email address: in 15 minutes, and in a day */
    private const SENDS = 3;

    private const SENDS_A_DAY = 8;

    /** Requests from one internet address in an hour */
    private const SENDS_FROM_ONE_PLACE = 20;

    /** Says nothing about whether the address belongs to a user. */
    public function send(string $email, ?string $ip): void
    {
        $key = sha1(mb_strtolower(trim($email)));
        $limits = [["reset:{$key}", self::SENDS, 900], ["reset-day:{$key}", self::SENDS_A_DAY, 86400], ["reset-ip:{$ip}", self::SENDS_FROM_ONE_PLACE, 3600]];
        foreach ($limits as [$name, $max]) {
            abort_if(RateLimiter::tooManyAttempts($name, $max), 429, 'Too many codes were asked for. Please try again later, or ask the admin for a new password.');
        }
        foreach ($limits as [$name, , $seconds]) {
            RateLimiter::hit($name, $seconds);
        }

        $account = MailAccount::query()->whereNull('owner_id')->orderBy('id')->first();
        abort_unless($account !== null, 503, 'The software has no office mail account to send the code from. Please ask the admin for a new password.');
        $user = $this->user($email);
        if (! $user) {
            return;
        }

        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        DB::table('password_reset_tokens')->updateOrInsert(['email' => $user->email], ['token' => Hash::make($code), 'attempts' => 0, 'created_at' => now()]);
        try {
            $this->mail($account, $user, $code, $ip);
        } catch (Throwable $e) {
            Log::warning('Password reset code not sent', ['user' => $user->id, 'reason' => mb_strimwidth($e->getMessage(), 0, 300, '…')]);
            DB::table('password_reset_tokens')->where('email', $user->email)->delete();
            abort(503, 'The mail with the code could not be sent. Please try again later, or ask the admin for a new password.');
        }
    }

    public function reset(string $email, string $code, string $password, ?string $ip): void
    {
        $wrong = 'The code is wrong or no longer valid. Check the latest mail, or ask for a new code.';
        $user = $this->user($email);
        abort_unless($user !== null, 422, $wrong);

        // Every try is counted before it is looked at, so tries at the same moment cannot pass the limit
        $row = DB::table('password_reset_tokens')->where('email', $user->email);
        $counted = (clone $row)->where('attempts', '<', self::TRIES)->where('created_at', '>=', now()->subMinutes(self::MINUTES))->increment('attempts');
        $hash = $counted ? (clone $row)->value('token') : null;
        abort_unless($hash !== null && Hash::check($code, $hash), 422, $wrong);
        // Used once only
        abort_unless((clone $row)->where('token', $hash)->delete() === 1, 422, $wrong);

        $user->forceFill(['password' => Hash::make($password), 'remember_token' => null])->save();
        $user->tokens()->delete();
        LoginSession::query()->where('user_id', $user->id)->where('active', true)->update(['active' => false, 'logged_out_at' => now()]);
        app(LoginSecurity::class)->allowAgain((string) $user->email, $ip);

        UserActivity::query()->create(['user_id' => $user->id, 'action' => 'password_reset', 'module' => 'auth', 'details' => 'Password reset with a mailed code', 'ip_address' => $ip, 'created_at' => now()]);
        $this->notify($user->id, 'Your password was changed', "With a code sent to your email · IP {$ip}. If this was not you, tell the admin at once.");
        foreach (AttendanceBook::admins() as $admin) {
            if ($admin->id !== $user->id) {
                $this->notify($admin->id, "{$user->name} set a new password", "With “Forgot password” and the code sent to {$user->email} · IP {$ip}");
            }
        }
    }

    private function user(string $email): ?User
    {
        $user = User::query()->where('email', trim($email))->first();

        return $user && ($user->is_active ?? true) ? $user : null;
    }

    /** Sent directly: no Bcc, and no copy in Sent, because others read the office mailbox */
    private function mail(MailAccount $account, User $user, string $code, ?string $ip): void
    {
        $minutes = self::MINUTES;
        $name = e($user->firstname ?: $user->username);
        $html = "<p>Dear {$name},</p><p>Your code to set a new password for the Namotech software is:</p>"
            ."<p style=\"font-size:28px;font-weight:bold;letter-spacing:6px;margin:16px 0\">{$code}</p>"
            ."<p>It is valid for {$minutes} minutes and can be used once. Do not give it to anyone.</p>"
            .'<p>If you did not ask for it, ignore this mail; your password stays as it is. (Asked for from IP '.e((string) $ip).')</p>';
        $email = MailComposer::build($account, 'Your password code', $html);
        $email->to($user->email);

        $transport = new EsmtpTransport($account->smtp_host, $account->smtp_port, $account->smtp_encryption === 'ssl');
        if ($account->smtp_encryption === 'none') {
            $transport->setAutoTls(false);
        }
        $transport->setLocalDomain(MailComposer::domain($account));
        $transport->setUsername($account->username)->setPassword($account->password);
        $stream = $transport->getStream();
        if ($stream instanceof SocketStream) {
            $stream->setTimeout(30);
        }
        if ($transport->send($email) === null) {
            throw new RuntimeException('The mail was rejected.');
        }
    }

    private function notify(int $userId, string $title, string $message): void
    {
        Notification::create(['user_id' => $userId, 'type' => 'login_alert', 'title' => mb_substr($title, 0, 250), 'message' => mb_strimwidth($message, 0, 400, '…'), 'created_at' => now()]);
    }
}
