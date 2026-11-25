<?php

namespace App\Services;

use App\Models\FailedLogin;
use App\Models\LoginSession;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Support\Facades\RateLimiter;
use Laravel\Sanctum\PersonalAccessToken;

/** Failed logins, logins from a new device, and signing a user out from elsewhere. */
class LoginSecurity
{
    /** Wrong passwords for one email from one address before it has to wait */
    private const TRIES = 8;

    private const WAIT_SECONDS = 900;

    /** Wrong passwords within the waiting time that the admins are told about */
    private const ALERT_AT = 5;

    /** Seconds to wait, 0 when a try is allowed */
    public function wait(string $email, ?string $ip): int
    {
        return RateLimiter::tooManyAttempts($this->key($email, $ip), self::TRIES) ? RateLimiter::availableIn($this->key($email, $ip)) : 0;
    }

    public function failed(string $email, ?User $user, ?string $ip, ?string $agent): void
    {
        RateLimiter::hit($this->key($email, $ip), self::WAIT_SECONDS);
        FailedLogin::create(['email' => mb_substr($email, 0, 255), 'user_id' => $user?->id, 'ip_address' => $ip, 'user_agent' => mb_substr((string) $agent, 0, 255), 'created_at' => now()]);

        $recent = FailedLogin::query()->where('email', $email)->where('created_at', '>=', now()->subSeconds(self::WAIT_SECONDS))->count();
        if ($user && $recent === self::ALERT_AT) {
            $this->alertAdmins('Wrong passwords for '.$user->name, self::ALERT_AT." wrong passwords in the last 15 minutes for {$email} · IP {$ip}");
        }
    }

    /** After a login: tells the user and the admins when this device was not used before. */
    public function loggedIn(User $user, LoginSession $session): void
    {
        $this->allowAgain((string) $user->email, $session->ip_address);
        if (! $session->device_id) {
            return;
        }
        $earlier = LoginSession::query()->where('user_id', $user->id)->whereNotNull('device_id')->where('id', '!=', $session->id);
        // The first device that is known of says nothing
        if (! (clone $earlier)->exists() || (clone $earlier)->where('device_id', $session->device_id)->exists()) {
            return;
        }
        $text = self::device($session->user_agent).' · IP '.$session->ip_address;
        $this->notify($user->id, 'Login from a new device', "{$text}. If this was not you, change your password and tell the admin.");
        $this->alertAdmins("{$user->name} logged in from a new device", $text, $user->id);
    }

    public function allowAgain(string $email, ?string $ip): void
    {
        RateLimiter::clear($this->key($email, $ip));
    }

    public function signOut(LoginSession $session): void
    {
        PersonalAccessToken::query()->whereKey($session->personal_access_token_id)->delete();
        $session->forceFill(['logged_out_at' => $session->logged_out_at ?? now(), 'active' => false])->save();
    }

    /** "Chrome on Windows" */
    public static function device(?string $agent): string
    {
        $agent = (string) $agent;
        $browser = match (true) {
            str_contains($agent, 'Edg') => 'Edge',
            str_contains($agent, 'OPR') => 'Opera',
            str_contains($agent, 'SamsungBrowser') => 'Samsung Internet',
            str_contains($agent, 'Chrome') || str_contains($agent, 'CriOS') => 'Chrome',
            str_contains($agent, 'Firefox') || str_contains($agent, 'FxiOS') => 'Firefox',
            str_contains($agent, 'Safari') => 'Safari',
            default => 'Unknown browser',
        };
        $system = match (true) {
            str_contains($agent, 'Android') => 'Android',
            str_contains($agent, 'iPhone') || str_contains($agent, 'iPad') => 'iPhone / iPad',
            str_contains($agent, 'Windows') => 'Windows',
            str_contains($agent, 'Mac OS') => 'Mac',
            str_contains($agent, 'Linux') => 'Linux',
            default => 'unknown system',
        };

        return "{$browser} on {$system}";
    }

    private function alertAdmins(string $title, string $message, ?int $except = null): void
    {
        foreach (AttendanceBook::admins() as $admin) {
            if ($admin->id !== $except) {
                $this->notify($admin->id, $title, $message);
            }
        }
    }

    private function notify(int $userId, string $title, string $message): void
    {
        Notification::create(['user_id' => $userId, 'type' => 'login_alert', 'title' => mb_substr($title, 0, 250), 'message' => mb_strimwidth($message, 0, 400, '…'), 'created_at' => now()]);
    }

    private function key(string $email, ?string $ip): string
    {
        return 'login:'.sha1(mb_strtolower($email).'|'.$ip);
    }
}
