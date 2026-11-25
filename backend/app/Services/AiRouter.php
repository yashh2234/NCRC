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

    /** When the question must be answered by (see the deadline option) */
    private ?float $endsAt = null;

    private string $usedModel = '';

    /**
     * Options: only (services that may be asked), large (long answers: big models), timeout (seconds for one try),
     * deadline (seconds for all tries), max_tokens, groq_max_tokens, temperature, accept (is the answer usable?).
     *
     * @param  string|callable(AiProvider): string  $prompt
     * @param  string[]  $order  services to ask in this order instead of the one in the settings
     * @return array{data: array, provider: string, model: string}|null the answered JSON, null when no service could answer
     */
    public function json(string|callable $prompt, array $order = [], array $options = []): ?array
    {
        $this->endsAt = isset($options['deadline']) ? microtime(true) + $options['deadline'] : null;
        $providers = AiProvider::ordered();
        if ($order) {
            $providers = $providers->sortBy(fn (AiProvider $p) => ($i = array_search($p->provider, $order, true)) === false ? 99 : $i);
        }
        foreach ($providers as $provider) {
            if (! $provider->enabled || $provider->key() === '' || $provider->isPaused() || ! in_array($provider->provider, $options['only'] ?? [$provider->provider], true)) {
                continue;
            }
            $data = $this->ask($provider, is_string($prompt) ? $prompt : $prompt($provider), $options);
            if ($data !== null) {
                return ['data' => $data, 'provider' => $provider->label(), 'model' => $this->usedModel];
            }
        }

        return null;
    }

    /** Asks one service and notes on it how that went. */
    public function ask(AiProvider $provider, string $prompt, array $options = []): ?array
    {
        $error = 'No model is available for this key.';
        $pause = null;
        $large = (bool) ($options['large'] ?? false);
        foreach ($this->models($provider, $large) as $model) {
            $left = $this->endsAt === null ? PHP_INT_MAX : (int) ($this->endsAt - microtime(true));
            if ($left < 10) {
                $error = 'It did not answer in time.';

                break;
            }
            try {
                $response = $this->send($provider, $model, $prompt, ['timeout' => min($options['timeout'] ?? self::TIMEOUT, $left)] + $options);
            } catch (ConnectionException) {
                $error = 'It did not answer in time.';
                if ($large) {
                    // Writing long texts is slow on some free models; another one may be faster
                    continue;
                }
                $pause = now()->addMinutes(2);

                break;
            }

            if ($response->successful()) {
                $data = $this->decode($this->text($provider, $response));
                if ($data !== null && (! isset($options['accept']) || $options['accept']($data))) {
                    $this->usedModel = (string) ($response->json('model') ?? $model);
                    $provider->fill(['paused_until' => null, 'last_error' => null, 'last_ok_at' => now()])->save();

                    return $data;
                }
                $error = 'It gave an answer that could not be read.';
                Log::warning('Free AI answer not usable', ['provider' => $provider->provider, 'model' => $response->json('model') ?? $model, 'finish' => $response->json('choices.0.finish_reason'), 'error' => $response->json('error.message')]);

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
            if ($status === 413 || preg_match('/context length|too large|reduce the length/i', $message)) {
                $error = 'The text is too long for its free limit.';

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
    private function models(AiProvider $provider, bool $large = false): array
    {
        if (filled($provider->model)) {
            return [$provider->model];
        }

        return match ($provider->provider) {
            'gemini' => ['gemini-flash-lite-latest', 'gemini-flash-latest'],
            // OpenRouter's own choice among the models that are free at the moment
            'openrouter' => $large ? [...$this->openRouterModels($provider), 'openrouter/free'] : ['openrouter/free'],
            'groq' => $this->groqModels($provider, $large),
            default => [],
        };
    }

    /** Free models that can write long texts, from the live list (it changes often); the well-known big ones first */
    private function openRouterModels(AiProvider $provider): array
    {
        $ids = Cache::get($this->modelCacheKey($provider));
        if (is_array($ids)) {
            return $ids;
        }
        try {
            $response = Http::timeout(15)->acceptJson()->get(self::OPENROUTER.'models');
        } catch (ConnectionException) {
            return [];
        }
        $known = ['deepseek', 'qwen', 'gpt-oss-120b', 'nemotron-3-ultra', 'nemotron', 'llama-3.3', 'gemma-4-31b', 'glm', 'kimi', 'mistral', 'ling', 'ernie'];
        $ids = collect($response->json('data') ?? [])
            ->filter(fn ($m) => is_string($m['id'] ?? null) && str_ends_with($m['id'], ':free')
                && ($m['context_length'] ?? 0) >= 60000
                && (int) ($m['top_provider']['max_completion_tokens'] ?? 16000) >= 8000
                && ($m['architecture']['output_modalities'] ?? ['text']) === ['text'])
            // Small, safety, code and picture models
            ->reject(fn ($m) => preg_match('/guard|safety|embed|coder|-vl|vision|nano|[-_]\d(\.\d)?b\b/i', $m['id']))
            ->sortBy(function ($m) use ($known): array {
                $rank = collect($known)->search(fn (string $k) => str_contains($m['id'], $k));

                return [$rank === false ? 99 : $rank, -(int) ($m['created'] ?? 0)];
            })
            ->pluck('id')->values()->take(4)->all();
        if ($ids) {
            Cache::put($this->modelCacheKey($provider), $ids, now()->addHours(6));
        }

        return $ids;
    }

    /** Groq withdraws models often, so they are chosen from its live list instead of being fixed here. */
    private function groqModels(AiProvider $provider, bool $large = false): array
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
                return [$large ? 'openai/gpt-oss-120b' : 'openai/gpt-oss-20b'];
            }
            $ids = collect($response->json('data') ?? [])
                ->filter(fn ($m) => ($m['active'] ?? true) && is_string($m['id'] ?? null))
                ->pluck('id')
                // Speech, safety and agent models cannot fill a form
                ->reject(fn (string $id) => preg_match('/whisper|tts|orpheus|guard|compound|playai|embed|allam/i', $id))
                ->values()->all();
            if ($ids) {
                Cache::put($this->modelCacheKey($provider), $ids, now()->addHours(12));
            }
        }

        return collect($ids)->sortBy(fn (string $id) => match (true) {
            $large && preg_match('/120b|70b|maverick|kimi|qwen3/i', $id) === 1 => 0,
            str_contains($id, 'gpt-oss-20b') => 1,
            str_contains($id, 'gpt-oss') => 2,
            str_contains($id, 'llama') => 3,
            default => 4,
        })->values()->take(3)->all();
    }

    private function modelCacheKey(AiProvider $provider): string
    {
        return 'ai_models_'.$provider->provider.'_all';
    }

    private function send(AiProvider $provider, string $model, string $prompt, array $options = []): Response
    {
        $timeout = $options['timeout'] ?? self::TIMEOUT;
        $temperature = $options['temperature'] ?? 0;
        $tokens = $options['max_tokens'] ?? 4096;
        if ($provider->provider === 'gemini') {
            return Http::withHeaders(['x-goog-api-key' => $provider->key()])->timeout($timeout)->acceptJson()
                ->post(self::GEMINI.rawurlencode($model).':generateContent', [
                    'contents' => [['role' => 'user', 'parts' => [['text' => $prompt]]]],
                    'generationConfig' => ['responseMimeType' => 'application/json', 'temperature' => $temperature, 'maxOutputTokens' => $tokens],
                ]);
        }

        $body = [
            'model' => $model,
            'messages' => [['role' => 'user', 'content' => $prompt]],
            'temperature' => $temperature,
            'max_tokens' => $provider->provider === 'groq' ? ($options['groq_max_tokens'] ?? $tokens) : $tokens,
        ];
        if ($provider->provider === 'groq') {
            $body['response_format'] = ['type' => 'json_object'];
        }

        return Http::withToken($provider->key())->timeout($timeout)->acceptJson()
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
