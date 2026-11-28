<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreUserRequest;
use App\Http\Requests\UpdateUserRequest;
use App\Models\LegacyGroup;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class UserController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorizeLegacy($request, 'viewUser');

        $users = User::query()
            // The super admin (user 1) is listed only for full admins
            ->when(! $request->user()?->isFullAdmin(), fn ($query) => $query->where('id', '!=', 1))
            ->with('groups')
            ->orderBy('firstname')
            ->orderBy('lastname')
            ->get()
            ->map(fn (User $user): array => $this->presentUser($user));

        return response()->json([
            'data' => $users,
        ]);
    }

    /**
     * Minimal list of active staff (id, name, role) for assignment dropdowns
     * such as "Currently With". Available to any signed-in user.
     */
    public function assignable(): JsonResponse
    {
        $users = User::query()
            ->where(function ($query): void {
                $query->whereNull('is_active')->orWhere('is_active', true);
            })
            ->orderBy('firstname')
            ->orderBy('lastname')
            ->get()
            ->map(fn (User $user): array => [
                'id' => $user->id,
                'name' => $user->name,
                'tracker_role' => $user->tracker_role,
            ])
            ->filter(fn (array $user): bool => $user['name'] !== '')
            ->values();

        return response()->json([
            'data' => $users,
        ]);
    }

    public function store(StoreUserRequest $request): JsonResponse
    {
        $this->authorizeLegacy($request, 'createUser');

        $validated = $request->validated();
        $user = DB::transaction(function () use ($validated): User {
            $user = User::query()->create([
                'username' => $validated['username'],
                'email' => $validated['email'],
                'password' => $validated['password'],
                'firstname' => $validated['firstname'],
                'lastname' => $validated['lastname'] ?? '',
                'phone' => $validated['phone'] ?? '',
                'gender' => (int) $validated['gender'],
                'date_of_birth' => $validated['date_of_birth'] ?? null,
                'is_admin' => array_key_exists('is_admin', $validated)
                    ? (bool) $validated['is_admin']
                    : (int) ($validated['group_id'] ?? 0) === 1,
                'tracker_role' => $validated['tracker_role'] ?? null,
                'allowed_modules' => $this->normalizeModules($validated['allowed_modules'] ?? null, []),
            ]);

            if (! empty($validated['group_id'])) {
                DB::table('user_group')->updateOrInsert(
                    ['user_id' => $user->id],
                    ['group_id' => (int) $validated['group_id']],
                );
            }

            return $user->load('groups');
        });

        return response()->json([
            'message' => 'User created successfully',
            'user' => $this->presentUser($user),
        ], 201);
    }

    public function show(Request $request, User $user): JsonResponse
    {
        $this->authorizeLegacy($request, 'viewUser');
        $this->guardSuperAdmin($request, $user);

        $user->load('groups');

        return response()->json([
            'user' => $this->presentUser($user),
        ]);
    }

    public function update(UpdateUserRequest $request, User $user): JsonResponse
    {
        $this->authorizeLegacy($request, 'updateUser');
        $this->guardSuperAdmin($request, $user);

        $validated = $request->validated();

        // The super admin stays a full admin and stays active
        if ($user->isSuperAdmin()) {
            abort_if(array_key_exists('is_admin', $validated) && ! $validated['is_admin'], 422, 'The super admin always has full access.');
            abort_if(array_key_exists('is_active', $validated) && ! $validated['is_active'], 422, 'The super admin cannot be made inactive.');
        }

        // Don't let someone remove their own full-admin access and lock themselves out.
        if (array_key_exists('is_admin', $validated) && ! $validated['is_admin']
            && $request->user()?->id === $user->id && $user->isFullAdmin()) {
            abort(422, 'You cannot remove your own full admin access.');
        }

        $updatedUser = DB::transaction(function () use ($validated, $user): User {
            $payload = [
                'username' => $validated['username'],
                'email' => $validated['email'],
                'firstname' => $validated['firstname'],
                'lastname' => $validated['lastname'] ?? '',
                'phone' => $validated['phone'] ?? '',
                'gender' => (int) $validated['gender'],
                'is_active' => (bool) ($validated['is_active'] ?? true),
            ];

            if (array_key_exists('date_of_birth', $validated)) {
                $payload['date_of_birth'] = $validated['date_of_birth'];
            }
            if (array_key_exists('is_admin', $validated)) {
                $payload['is_admin'] = (bool) $validated['is_admin'];
            } elseif (! empty($validated['group_id'])) {
                $payload['is_admin'] = (int) $validated['group_id'] === 1;
            }
            if (array_key_exists('tracker_role', $validated)) {
                // The super admin has no job role
                $payload['tracker_role'] = $user->isSuperAdmin() ? null : $validated['tracker_role'];
            }
            if (array_key_exists('allowed_modules', $validated)) {
                $payload['allowed_modules'] = $this->normalizeModules($validated['allowed_modules'], $user->fresh()?->allowed_modules ?? []);
            }

            if (! empty($validated['password'])) {
                $payload['password'] = $validated['password'];
            }

            $user->update($payload);

            if (! empty($validated['group_id'])) {
                DB::table('user_group')->updateOrInsert(
                    ['user_id' => $user->id],
                    ['group_id' => (int) $validated['group_id']],
                );
            }

            // Full admin switched off: also take the user out of the legacy Administrator group,
            // otherwise that group membership would keep granting full access.
            if (array_key_exists('is_admin', $validated) && ! $validated['is_admin']) {
                DB::table('user_group')->where('user_id', $user->id)->where('group_id', 1)->delete();
            }

            return $user->fresh('groups');
        });

        return response()->json([
            'message' => 'User updated successfully',
            'user' => $this->presentUser($updatedUser),
        ]);
    }

    public function destroy(Request $request, User $user): JsonResponse
    {
        $this->authorizeLegacy($request, 'deleteUser');

        abort_if((int) $request->user()?->id === (int) $user->id, 422, 'You cannot delete your own account.');
        abort_if($user->isSuperAdmin(), 422, 'The super admin cannot be deleted.');

        DB::transaction(function () use ($user): void {
            $user->tokens()->delete();
            DB::table('user_group')->where('user_id', $user->id)->delete();
            $user->delete();
        });

        return response()->json([
            'message' => 'User removed successfully',
        ]);
    }

    private function authorizeLegacy(Request $request, string $permission): void
    {
        $user = $request->user();

        abort_unless($user && ($user->canManageUsers() || in_array($permission, $user->legacyPermissions(), true)), 403, 'Unauthorized');
    }

    /**
     * Keep only known feature keys; null means "not configured, use job-role defaults".
     * What is switched on in "Access and approvals" stays as it is ($current).
     */
    private function normalizeModules(?array $modules, array $current): ?array
    {
        if ($modules === null) {
            return null;
        }

        $modules = [...array_diff($modules, User::BOX_KEYS), ...array_intersect($current, User::BOX_KEYS)];

        return array_values(array_intersect(User::FEATURE_KEYS, $modules));
    }

    /** Only full admins see or change the super admin (user 1) */
    private function guardSuperAdmin(Request $request, User $user): void
    {
        abort_if($user->isSuperAdmin() && ! $request->user()?->isFullAdmin(), 404);
    }

    private function presentUser(User $user): array
    {
        $group = $user->groups->first();
        $permissions = $user->groups->flatMap(fn (LegacyGroup $legacyGroup): array => $legacyGroup->permissions)->unique()->values()->all();

        return [
            'id' => $user->id,
            'username' => $user->username,
            'email' => $user->email,
            'firstname' => $user->firstname,
            'lastname' => $user->lastname,
            'phone' => $user->phone,
            'gender' => (int) $user->gender,
            'date_of_birth' => $user->date_of_birth?->format('Y-m-d'),
            'is_admin' => $user->isFullAdmin(),
            'is_super_admin' => $user->isSuperAdmin(),
            'name' => $user->name,
            'is_active' => (bool) ($user->is_active ?? true),
            'tracker_role' => $user->tracker_role,
            'job_role' => $user->isSuperAdmin() ? null : ($user->getAttributes()['tracker_role'] ?? null),
            'allowed_modules' => $user->allowed_modules,
            'group' => $group ? [
                'id' => $group->id,
                'group_name' => $group->group_name,
                'permissions' => $group->permissions,
            ] : null,
            'groups' => $user->groups->map(fn (LegacyGroup $legacyGroup): array => [
                'id' => $legacyGroup->id,
                'group_name' => $legacyGroup->group_name,
            ])->values()->all(),
            'permissions' => $permissions,
            'last_login_at' => optional($user->last_login_at)->toDateTimeString(),
        ];
    }
}