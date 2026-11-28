<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LoginSession;
use App\Models\LegacyGroup;
use App\Models\User;
use App\Models\UserActivity;
use App\Services\LoginSecurity;
use App\Services\PasswordReset;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\PersonalAccessToken;

class AuthController extends Controller
{
    public function login(Request $request, LoginSecurity $security): JsonResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
            'device_id' => ['nullable', 'string', 'max:64', 'regex:/^[A-Za-z0-9-]+$/'],
        ]);

        if ($wait = $security->wait($credentials['email'], $request->ip())) {
            return response()->json(['message' => 'Too many wrong passwords. Try again in '.max(1, (int) ceil($wait / 60)).' minute(s).'], 429);
        }

        $user = User::query()->where('email', $credentials['email'])->first();

        if ($user && ! ($user->is_active ?? true)) {
            return response()->json(['message' => 'Your account has been deactivated. Contact administrator.'], 403);
        }

        if (! $user || ! Hash::check($credentials['password'], $user->password)) {
            $security->failed($credentials['email'], $user, $request->ip(), $request->userAgent());

            return response()->json([
                'message' => 'Incorrect username/password combination',
            ], 422);
        }

        $tokenResult = $user->createToken('web');
        $accessToken = $tokenResult->accessToken;
        $now = now();
        $loginSession = LoginSession::query()->create([
            'user_id' => $user->id,
            'personal_access_token_id' => $accessToken->id,
            'ip_address' => $request->ip(),
            'user_agent' => substr((string) $request->userAgent(), 0, 255),
            'device_id' => $credentials['device_id'] ?? null,
            'logged_in_at' => $now,
            'last_seen_at' => $now,
            'active' => true,
        ]);

        $security->loggedIn($user, $loginSession);

        $user->forceFill([
            'last_login_at' => $now,
            'last_login_ip' => $request->ip(),
            'last_login_user_agent' => substr((string) $request->userAgent(), 0, 255),
        ])->save();

        UserActivity::query()->create([
            'user_id' => $user->id,
            'action' => 'login',
            'module' => 'auth',
            'details' => 'User logged in',
            'ip_address' => $request->ip(),
            'created_at' => now(),
        ]);

        return response()->json([
            'token' => $tokenResult->plainTextToken,
            'user' => $this->presentUser($user),
            'session' => $this->presentSession($loginSession),
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'user' => $user ? $this->presentUser($user) : null,
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $user = $request->user();
        $currentAccessToken = $user?->currentAccessToken();

        if ($user && $currentAccessToken) {
            LoginSession::query()
                ->where('personal_access_token_id', $currentAccessToken->id)
                ->where('user_id', $user->id)
                ->update([
                    'logged_out_at' => now(),
                    'last_seen_at' => now(),
                    'active' => false,
                ]);

            $currentAccessToken->delete();
        }

        if ($user) {
            UserActivity::query()->create([
                'user_id' => $user->id,
                'action' => 'logout',
                'module' => 'auth',
                'details' => 'User logged out',
                'ip_address' => $request->ip(),
                'created_at' => now(),
            ]);
        }

        return response()->json(['message' => 'Logged out']);
    }

    public function sessions(Request $request): JsonResponse
    {
        $user = $request->user();

        $sessions = LoginSession::query()
            ->where('user_id', $user?->id)
            ->orderByDesc('logged_in_at')
            ->limit(10)
            ->get()
            ->map(fn (LoginSession $session): array => $this->presentSession($session));

        return response()->json([
            'data' => $sessions,
            'active_count' => $sessions->where('active', true)->count(),
        ]);
    }

    public function changePassword(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'current_password' => ['required', 'string', 'current_password'],
            'new_password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $request->user()->forceFill([
            'password' => Hash::make($validated['new_password']),
        ])->save();

        return response()->json(['message' => 'Password changed successfully']);
    }

    /** Mails a code; the answer is the same for addresses that belong to nobody. */
    public function forgotPassword(Request $request, PasswordReset $reset): JsonResponse
    {
        $values = $request->validate(['email' => ['required', 'email', 'max:255']]);
        $reset->send($values['email'], $request->ip());

        return response()->json(['message' => 'If this email belongs to a user, a 6-digit code was sent to it. It is valid for '.PasswordReset::MINUTES.' minutes. Look in Spam too.']);
    }

    public function resetPassword(Request $request, PasswordReset $reset): JsonResponse
    {
        $values = $request->validate([
            'email' => ['required', 'email', 'max:255'],
            'code' => ['required', 'digits:6'],
            'password' => ['required', 'string', 'min:8', 'max:200', 'confirmed'],
        ], ['code.digits' => 'The code has 6 digits.', 'password.confirmed' => 'The two passwords are not the same.']);
        $reset->reset($values['email'], $values['code'], $values['password'], $request->ip());

        return response()->json(['message' => 'Your new password is set. Sign in with it; you were signed out everywhere else.']);
    }

    public function revokeSession(Request $request, LoginSession $session): JsonResponse
    {
        $user = $request->user();

        abort_unless($user && ($user->is_admin || $session->user_id === $user->id), 403);

        $token = PersonalAccessToken::query()->find($session->personal_access_token_id);

        if ($token) {
            $token->delete();
        }

        $session->forceFill([
            'logged_out_at' => now(),
            'last_seen_at' => now(),
            'active' => false,
        ])->save();

        return response()->json(['message' => 'Session revoked']);
    }

    private function presentUser(User $user): array
    {
        $groups = $user->groups()->get();
        $isAdmin = $user->is_admin || $groups->contains(fn (LegacyGroup $group): bool => (int) $group->id === 1 || strtolower($group->group_name) === 'administrator');

        // Detect tracker role from group names (aligned with Namotech Job Tracker)
        $trackerRole = 'staff';
        $jobRole = $user->getAttributes()['tracker_role'] ?? null;
        if ($isAdmin) {
            $trackerRole = 'admin';
        } elseif (! empty($jobRole)) {
            // Set per user in Manage Users.
            $trackerRole = $jobRole;
        } else {
            $roleMap = [
                'technical'    => 'report_staff',
                'report staff' => 'report_staff',
                'lab employee' => 'lab',
                'lab'          => 'lab',
                'registerar'   => 'registration',
                'registration' => 'registration',
                'hr group'     => 'manager',
                'manager'      => 'manager',
                'accounts'     => 'accounts',
            ];
            foreach ($groups as $group) {
                $name = strtolower(trim($group->group_name));
                if (isset($roleMap[$name])) {
                    $trackerRole = $roleMap[$name];
                    break;
                }
            }
        }

        return [
            'id' => $user->id,
            'username' => $user->username,
            'email' => $user->email,
            'firstname' => $user->firstname,
            'lastname' => $user->lastname,
            'phone' => $user->phone,
            'gender' => $user->gender,
            'is_admin' => $isAdmin,
            'is_super_admin' => $user->isSuperAdmin(),
            'name' => $user->name,
            'is_active' => (bool) ($user->is_active ?? true),
            'tracker_role' => $trackerRole,
            'allowed_modules' => $user->allowed_modules,
            'groups' => $groups->map(fn (LegacyGroup $group): array => [
                'id' => $group->id,
                'group_name' => $group->group_name,
            ])->values()->all(),
            'permissions' => $user->groups->flatMap(fn (LegacyGroup $group): array => $group->permissions)->unique()->values()->all(),
        ];
    }

    private function presentSession(LoginSession $session): array
    {
        return [
            'id' => $session->id,
            'user_id' => $session->user_id,
            'ip_address' => $session->ip_address,
            'user_agent' => $session->user_agent,
            'logged_in_at' => optional($session->logged_in_at)->toDateTimeString(),
            'logged_out_at' => optional($session->logged_out_at)->toDateTimeString(),
            'last_seen_at' => optional($session->last_seen_at)->toDateTimeString(),
            'active' => (bool) $session->active,
        ];
    }
}