<?php

namespace App\Services;

use App\Models\AiProvider;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Asks the free AI services one after another until one answers. A service that is full (429) or failing is
 * rested for a while, so the next question goes straight to the one that works.
 */
class AiRouter
{
    private const GEMINI = 'https://generativelanguage.googleapis.com/v1beta/models/';

    private const GROQ = 'https://api.groq.com/openai/v1/';

    private const OPENROUTER = 'https://openrouter.ai/api/v1/';

    private const TIMEOUT = 25;

    /**
     * @param  string[]  $order  services to ask in this order instead of the one in the settings
     * @return array{data: array, provider: string}|null the answered JSON, null when no service could answer
     */
    public function json(string $prompt, array $order = []): ?array
    {
        $providers = AiProvider::ordered();
        if ($order) {
            $providers = $providers->sortBy(fn (AiProvider $p) => ($i = array_search($p->provider, $order, true)) === false ? 99 : $i);
        }
        foreach ($providers as $provider) {
            if (! $provider->enabled || $provider->key() === '' || $provider->isPaused()) {
                continue;
            }
            $data = $this->ask($provider, $prompt);
            if ($data !== null) {
                return ['data' => $data, 'provider' => $provider->label()];
            }
        }

        return null;
    }

    /** Asks one service and notes on it how that went. */
    public function ask(AiProvider $provider, string $prompt): ?array
    {
        $error = 'No model is available for this key.';
        $pause = null;
        foreach ($this->models($provider) as $model) {
            try {
                $response = $this->send($provider, $model, $prompt);
            } catch (ConnectionException) {
                [$error, $pause] = ['It did not answer in time.', now()->addMinutes(2)];

                break;
            }

            if ($response->successful()) {
                $data = $this->decode($this->text($provider, $response));
                if ($data !== null) {
                    $provider->fill(['paused_until' => null, 'last_error' => null, 'last_ok_at' => now()])->save();

                    return $data;
                }
                $error = 'It gave an answer that could not be read.';

                continue;
            }

            $status = $response->status();
            $message = (string) ($response->json('error.message') ?? '');
            Log::warning('Free AI request failed', ['provider' => $provider->provider, 'model' => $model, 'status' => $status, 'message' => mb_strimwidth($message, 0, 300, '…')]);

            if ($status === 429) {
                // The limit can be per model: try this service's other model before moving on
                [$error, $pause] = ['The free limit is used up for now.', $this->pauseUntil($response, $message)];

                continue;
            }
            if (in_array($status, [401, 402, 403], true) || ($status === 400 && stripos($message, 'api key') !== false)) {
                $error = $status === 402 ? 'The account has no credit left.' : 'The API key is not accepted.';
                $pause = now()->addMinutes(30);

                break;
            }
            if ($status >= 500) {
                [$error, $pause] = ['It is busy right now.', now()->addMinutes(2)];

                continue;
            }
            // Model withdrawn or renamed: look the list up again next time and try another
            Cache::forget($this->modelCacheKey($provider));
            $error = "The model {$model} is not available.";
        }

        $provider->fill(['paused_until' => $pause, 'last_error' => mb_strimwidth($error, 0, 490, '…')])->save();

        return null;
    }

    /** Models to try, best first. A model typed in the settings is the only one used. */
    private function models(AiProvider $provider): array
    {
        if (filled($provider->model)) {
            return [$provider->model];
        }

        return match ($provider->provider) {
            'gemini' => ['gemini-flash-lite-latest', 'gemini-flash-latest'],
            // OpenRouter's own choice among the models that are free at the moment
            'openrouter' => ['openrouter/free'],
            'groq' => $this->groqModels($provider),
            default => [],
        };
    }

    /** Groq withdraws models often, so they are chosen from its live list instead of being fixed here. */
    private function groqModels(AiProvider $provider): array
    {
        $ids = Cache::get($this->modelCacheKey($provider));
        if (! is_array($ids)) {
            try {
                $response = Http::withToken($provider->key())->timeout(10)->acceptJson()->get(self::GROQ.'models');
            } catch (ConnectionException) {
                return [];
            }
            if (! $response->successful()) {
                // Let the question itself report the wrong key / limit
                return ['openai/gpt-oss-20b'];
            }
            $ids = collect($response->json('data') ?? [])
                ->filter(fn ($m) => ($m['active'] ?? true) && is_string($m['id'] ?? null))
                ->pluck('id')
                // Speech, safety and agent models cannot fill a form
                ->reject(fn (string $id) => preg_match('/whisper|tts|orpheus|guard|compound|playai|embed|allam/i', $id))
                ->sortBy(fn (string $id) => match (true) {
                    str_contains($id, 'gpt-oss-20b') => 0,
                    str_contains($id, 'gpt-oss') => 1,
                    str_contains($id, 'llama') => 2,
                    default => 3,
                })->values()->take(3)->all();
            if ($ids) {
                Cache::put($this->modelCacheKey($provider), $ids, now()->addHours(12));
            }
        }

        return $ids;
    }

    private function modelCacheKey(AiProvider $provider): string
    {
        return 'ai_models_'.$provider->provider;
    }

    private function send(AiProvider $provider, string $model, string $prompt): Response
    {
        if ($provider->provider === 'gemini') {
            return Http::withHeaders(['x-goog-api-key' => $provider->key()])->timeout(self::TIMEOUT)->acceptJson()
                ->post(self::GEMINI.rawurlencode($model).':generateContent', [
                    'contents' => [['role' => 'user', 'parts' => [['text' => $prompt]]]],
                    'generationConfig' => ['responseMimeType' => 'application/json', 'temperature' => 0, 'maxOutputTokens' => 4096],
                ]);
        }

        $body = [
            'model' => $model,
            'messages' => [['role' => 'user', 'content' => $prompt]],
            'temperature' => 0,
            'max_tokens' => 4096,
        ];
        if ($provider->provider === 'groq') {
            $body['response_format'] = ['type' => 'json_object'];
        }

        return Http::withToken($provider->key())->timeout(self::TIMEOUT)->acceptJson()
            ->post(($provider->provider === 'groq' ? self::GROQ : self::OPENROUTER).'chat/completions', $body);
    }

    private function text(AiProvider $provider, Response $response): string
    {
        return $provider->provider === 'gemini'
            ? collect($response->json('candidates.0.content.parts') ?? [])->reject(fn ($p) => $p['thought'] ?? false)->pluck('text')->filter()->implode('')
            : (string) $response->json('choices.0.message.content');
    }

    private function decode(string $text): ?array
    {
        $start = strpos($text, '{');
        $end = strrpos($text, '}');
        $data = $start === false || $end === false ? null : json_decode(substr($text, $start, $end - $start + 1), true);

        return is_array($data) ? $data : null;
    }

    /** How long a full service rests: what it asks for, else an hour for a daily limit and a minute for the others */
    private function pauseUntil(Response $response, string $message): Carbon
    {
        $wait = $response->header('Retry-After');
        $seconds = is_numeric($wait) ? (int) $wait : null;
        if ($seconds === null && preg_match('/(?:retry|try again) in (?:(\d+)h)?(?:(\d+)m)?([\d.]+)s/i', $message, $m)) {
            $seconds = (int) $m[1] * 3600 + (int) $m[2] * 60 + (int) ceil((float) $m[3]);
        }
        $seconds ??= preg_match('/per[ -]?day|daily|PerDay/i', $message) ? 3600 : 60;

        return now()->addSeconds(min(max($seconds, 30), 86400));
    }
}
