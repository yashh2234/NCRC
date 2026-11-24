<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\WhatsappSetting;
use App\Services\WhatsappInquiries;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Throwable;

/**
 * WhatsApp Business (Meta Cloud API) webhook for inquiries. Public address, so every call must carry Meta's
 * signature made with our app secret, and only the allowed numbers can add anything.
 */
class WhatsappController extends Controller
{
    /** Meta checks the address once, when it is entered there. */
    public function verify(Request $request): Response
    {
        $setting = WhatsappSetting::current();
        $token = $setting->secret('verify_token');
        $given = $request->query('hub_verify_token');
        abort_unless($request->query('hub_mode') === 'subscribe' && $token !== '' && is_string($given) && hash_equals($token, $given), 403);
        $setting->fill(['verified_at' => now()])->save();

        return response((string) $request->query('hub_challenge'), 200, ['Content-Type' => 'text/plain', 'X-Content-Type-Options' => 'nosniff']);
    }

    public function receive(Request $request, WhatsappInquiries $inquiries): JsonResponse
    {
        $setting = WhatsappSetting::current();
        $secret = $setting->secret('app_secret');
        $signature = (string) $request->header('X-Hub-Signature-256');
        $expected = 'sha256='.hash_hmac('sha256', $request->getContent(), $secret);
        abort_if($secret === '' || ! hash_equals($expected, $signature), 403);

        if ($setting->enabled && $inquiries->keep($request->json()->all(), $setting) > 0) {
            // Meta wants its answer at once; reading can take the AI some seconds. The scheduler catches what this misses.
            app()->terminating(function () use ($inquiries): void {
                try {
                    $inquiries->process();
                } catch (Throwable $e) {
                    report($e);
                }
            });
        }

        return response()->json(['status' => 'ok']);
    }

    // ---------------------------------------------------------------- settings (admin)

    public function settings(): JsonResponse
    {
        $this->requireAdmin();

        return response()->json(['data' => WhatsappSetting::current()->toApi()]);
    }

    public function saveSettings(Request $request): JsonResponse
    {
        $this->requireAdmin();
        $v = $request->validate([
            'enabled' => ['required', 'boolean'],
            'app_secret' => ['nullable', 'string', 'max:200'],
            'phone_number_id' => ['nullable', 'string', 'max:50', 'regex:/^\d+$/'],
            'new_token' => ['nullable', 'boolean'],
            'senders' => ['present', 'array', 'max:20'],
            'senders.*.number' => ['required', 'string', 'max:30'],
            'senders.*.user_id' => ['required', 'integer', 'exists:users,id'],
        ], [
            'phone_number_id.regex' => 'The phone number ID has digits only (it is not the mobile number).',
            'senders.*.number.required' => 'Enter the mobile number of every sender.',
            'senders.*.user_id.required' => 'Choose a user for every sender.',
        ]);

        $senders = [];
        foreach ($v['senders'] as $sender) {
            $number = WhatsappSetting::digits($sender['number']);
            abort_if(strlen($number) < 11 || strlen($number) > 15, 422, "The number {$sender['number']} is not complete.");
            $senders[$number] = ['number' => $number, 'user_id' => (int) $sender['user_id']];
        }

        $setting = WhatsappSetting::current();
        $setting->fill(['phone_number_id' => $v['phone_number_id'] ?? null, 'senders' => array_values($senders), 'updated_by' => Auth::id()]);
        if (filled($v['app_secret'] ?? null)) {
            $setting->app_secret = trim($v['app_secret']);
            $setting->fill(['last_problem' => null, 'last_problem_at' => null]);
        }
        if (! empty($v['new_token']) || $setting->secret('verify_token') === '') {
            $setting->verify_token = Str::random(32);
            $setting->verified_at = null;
        }
        abort_if($v['enabled'] && ($setting->secret('app_secret') === '' || ! $senders), 422, 'Enter the app secret and at least one sender before switching it on.');
        $setting->fill(['enabled' => $v['enabled']])->save();

        return response()->json(['data' => $setting->toApi()]);
    }

    private function requireAdmin(): void
    {
        $user = Auth::user();
        abort_unless($user instanceof User && $user->isFullAdmin(), 403, 'Only an administrator can change the WhatsApp settings.');
    }
}
