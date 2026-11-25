<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AiProvider;
use App\Models\User;
use App\Services\AiRouter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Validation\Rule;

/** Administration: keys and order of the free AI services. Keys never leave the server again once saved. */
class AiProviderController extends Controller
{
    public function index(): JsonResponse
    {
        $this->requireAdmin();

        return $this->list();
    }

    /** Saves all services in the order given. An empty key keeps the saved one. */
    public function update(Request $request): JsonResponse
    {
        $this->requireAdmin();
        $rows = $request->validate([
            'providers' => ['required', 'array', 'max:10'],
            'providers.*.provider' => ['required', 'distinct', Rule::in(array_keys(AiProvider::PROVIDERS))],
            'providers.*.api_key' => ['nullable', 'string', 'max:500'],
            'providers.*.remove_key' => ['nullable', 'boolean'],
            'providers.*.model' => ['nullable', 'string', 'max:150', 'regex:#^[\w.:/-]+$#'],
            'providers.*.enabled' => ['required', 'boolean'],
        ], ['providers.*.model.regex' => 'The model name can only have letters, numbers and . : / - _'])['providers'];

        foreach ($rows as $i => $row) {
            $provider = AiProvider::firstOrNew(['provider' => $row['provider']]);
            $key = trim((string) ($row['api_key'] ?? ''));
            $model = trim((string) ($row['model'] ?? '')) ?: null;
            if ($key !== '' || ! empty($row['remove_key']) || $model !== $provider->model) {
                // A new key or model starts fresh
                $provider->fill(['paused_until' => null, 'last_error' => null]);
                Cache::forget('ai_models_'.$row['provider'].'_all');
            }
            if (! empty($row['remove_key'])) {
                $provider->api_key = null;
            }
            if ($key !== '') {
                $provider->api_key = $key;
            }
            $provider->fill(['model' => $model, 'enabled' => $row['enabled'], 'sort_order' => $i, 'updated_by' => Auth::id()])->save();
        }

        return $this->list();
    }

    /** One small question to see whether the key works */
    public function test(string $provider, AiRouter $ai): JsonResponse
    {
        $this->requireAdmin();
        $row = AiProvider::query()->where('provider', $provider)->first();
        abort_unless($row && $row->key() !== '', 422, 'Save a key first.');
        $answer = $ai->ask($row, 'Answer with this JSON object only: {"ok": true}');

        return response()->json(['ok' => $answer !== null, 'data' => $row->fresh()->toApi()]);
    }

    private function list(): JsonResponse
    {
        return response()->json(['data' => AiProvider::ordered()->map(fn (AiProvider $p) => $p->toApi())]);
    }

    private function requireAdmin(): void
    {
        $user = Auth::user();
        abort_unless($user instanceof User && $user->isFullAdmin(), 403, 'Only an administrator can change the AI keys.');
    }
}
