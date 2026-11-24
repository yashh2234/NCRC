<?php

namespace App\Models;

use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

/** WhatsApp inquiries: Meta app details and who may send (single row). */
class WhatsappSetting extends Model
{
    protected $fillable = ['enabled', 'app_secret', 'verify_token', 'phone_number_id', 'senders', 'verified_at', 'last_message_at', 'last_problem', 'last_problem_at', 'updated_by'];

    protected $hidden = ['app_secret', 'verify_token'];

    protected $casts = [
        'enabled' => 'boolean',
        'app_secret' => 'encrypted',
        'verify_token' => 'encrypted',
        'senders' => 'array',
        'verified_at' => 'datetime',
        'last_message_at' => 'datetime',
        'last_problem_at' => 'datetime',
    ];

    public static function current(): self
    {
        return self::query()->first() ?? self::create(['enabled' => false, 'verify_token' => Str::random(32), 'senders' => []]);
    }

    /** A saved secret, or '' when there is none or it can no longer be read (APP_KEY changed) */
    public function secret(string $key): string
    {
        try {
            return (string) $this->{$key};
        } catch (DecryptException) {
            return '';
        }
    }

    /** Full number in digits with country code, as WhatsApp sends it: 98765 43210 → 919876543210 */
    public static function digits(?string $number): string
    {
        $digits = ltrim((string) preg_replace('/\D/', '', (string) $number), '0');

        return strlen($digits) === 10 ? '91'.$digits : $digits;
    }

    /** The app user a message from this number counts for; null = not allowed */
    public function userFor(string $number): ?User
    {
        $number = self::digits($number);
        foreach ($this->senders ?? [] as $sender) {
            if ($number !== '' && self::digits($sender['number'] ?? '') === $number) {
                $user = User::find($sender['user_id'] ?? null);

                return $user && $user->is_active !== false ? $user : null;
            }
        }

        return null;
    }

    public function problem(string $text): void
    {
        $this->fill(['last_problem' => mb_substr($text, 0, 250), 'last_problem_at' => now()])->save();
    }

    public function toApi(): array
    {
        $secret = $this->secret('app_secret');

        return [
            'enabled' => (bool) $this->enabled,
            'has_secret' => $secret !== '',
            'verify_token' => $this->secret('verify_token'),
            'phone_number_id' => $this->phone_number_id ?? '',
            'senders' => array_values($this->senders ?? []),
            'verified_at' => $this->verified_at?->toIso8601String(),
            'last_message_at' => $this->last_message_at?->toIso8601String(),
            'last_problem' => $this->last_problem,
            'last_problem_at' => $this->last_problem_at?->toIso8601String(),
        ];
    }
}
