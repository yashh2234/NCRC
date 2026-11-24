<?php

namespace App\Models;

use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;

/** One free AI service with its own key; see App\Services\AiRouter. */
class AiProvider extends Model
{
    /** In the order they are tried until the admin changes it */
    public const PROVIDERS = [
        'gemini' => 'Google Gemini',
        'groq' => 'Groq',
        'openrouter' => 'OpenRouter',
    ];

    protected $fillable = ['provider', 'api_key', 'model', 'enabled', 'sort_order', 'paused_until', 'last_error', 'last_ok_at', 'updated_by'];

    protected $hidden = ['api_key'];

    protected $casts = [
        'api_key' => 'encrypted',
        'enabled' => 'boolean',
        'sort_order' => 'integer',
        'paused_until' => 'datetime',
        'last_ok_at' => 'datetime',
    ];

    /** All services in order, also those not set up yet (not saved). */
    public static function ordered(): Collection
    {
        $saved = self::query()->get()->keyBy('provider');

        return collect(array_keys(self::PROVIDERS))
            ->map(fn (string $name, int $i) => $saved->get($name) ?? new self(['provider' => $name, 'enabled' => true, 'sort_order' => $i]))
            ->sortBy('sort_order')->values();
    }

    /** The key, or '' when there is none or it can no longer be read (APP_KEY changed) */
    public function key(): string
    {
        try {
            return (string) $this->api_key;
        } catch (DecryptException) {
            return '';
        }
    }

    public function label(): string
    {
        return self::PROVIDERS[$this->provider] ?? $this->provider;
    }

    public function isPaused(): bool
    {
        return $this->paused_until !== null && $this->paused_until->isFuture();
    }

    public function toApi(): array
    {
        $key = $this->key();

        return [
            'provider' => $this->provider,
            'label' => $this->label(),
            'has_key' => $key !== '',
            'key_end' => $key === '' ? '' : substr($key, -4),
            'model' => $this->model ?? '',
            'enabled' => (bool) $this->enabled,
            'paused_until' => $this->isPaused() ? $this->paused_until->toIso8601String() : null,
            'last_error' => $this->last_error,
            'last_ok_at' => $this->last_ok_at?->toIso8601String(),
        ];
    }
}
