<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PushSubscription;
use App\Services\PushSender;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Phone / browser notifications: the devices of the user, and which kinds they want */
class PushController extends Controller
{
    public function config(Request $request): JsonResponse
    {
        return response()->json([
            'public_key' => PushSender::configured() ? (string) config('services.webpush.public_key') : null,
            'prefs' => PushSender::prefs($request->user()),
            'categories' => collect(PushSender::CATEGORIES)->map(fn ($label, $key) => ['key' => $key, 'label' => $label])->values(),
            'devices' => PushSubscription::query()->where('user_id', $request->user()->id)->count(),
        ]);
    }

    public function subscribe(Request $request): JsonResponse
    {
        $values = $request->validate([
            'endpoint' => ['required', 'string', 'url', 'max:700', 'starts_with:https://'],
            'keys.p256dh' => ['required', 'string', 'max:255'],
            'keys.auth' => ['required', 'string', 'max:255'],
        ]);
        // The same device signed in as someone else now belongs to that user
        PushSubscription::query()->updateOrCreate(
            ['endpoint_hash' => hash('sha256', $values['endpoint'])],
            [
                'user_id' => $request->user()->id,
                'endpoint' => $values['endpoint'],
                'p256dh' => $values['keys']['p256dh'],
                'auth' => $values['keys']['auth'],
                'device' => mb_substr((string) $request->userAgent(), 0, 255),
            ],
        );

        return response()->json(['message' => 'Notifications are on for this device']);
    }

    public function unsubscribe(Request $request): JsonResponse
    {
        $endpoint = (string) $request->input('endpoint', '');
        PushSubscription::query()->where('user_id', $request->user()->id)
            ->where('endpoint_hash', hash('sha256', $endpoint))->delete();

        return response()->json(['message' => 'Notifications are off for this device']);
    }

    public function savePrefs(Request $request): JsonResponse
    {
        $keys = array_keys(PushSender::CATEGORIES);
        $values = $request->validate([
            'categories' => ['required', 'array'],
            'categories.*' => ['boolean'],
            'quiet_from' => ['nullable', 'date_format:H:i'],
            'quiet_to' => ['nullable', 'date_format:H:i'],
        ]);
        $user = $request->user();
        $user->forceFill(['push_prefs' => [
            'categories' => collect($values['categories'])->only($keys)->map(fn ($v) => (bool) $v)->all(),
            'quiet_from' => $values['quiet_from'] ?? null,
            'quiet_to' => $values['quiet_to'] ?? null,
        ]])->save();

        return response()->json(['prefs' => PushSender::prefs($user->fresh())]);
    }

    public function test(Request $request, PushSender $sender): JsonResponse
    {
        abort_unless(PushSender::configured(), 422, 'Phone notifications are not set up on the server yet.');
        $sent = $sender->test($request->user());
        abort_if($sent === 0, 422, 'No device of yours could be reached. Turn notifications on again on this phone.');

        return response()->json(['message' => "Sent to {$sent} device".($sent === 1 ? '' : 's').'.']);
    }
}
