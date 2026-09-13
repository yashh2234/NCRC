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
            ->where('id', '!=', 1)
            ->with('groups')
            ->orderBy('firstname')
            ->orderBy('lastname')
            ->get()
            ->map(fn (User $user): array => $this->presentUser($user));

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
                'is_admin' => (int) $validated['group_id'] === 1,
            ]);

            DB::table('user_group')->updateOrInsert(
                ['user_id' => $user->id],
                ['group_id' => (int) $validated['group_id']],
            );

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

        $user->load('groups');

        return response()->json([
            'user' => $this->presentUser($user),
        ]);
    }

    public function update(UpdateUserRequest $request, User $user): JsonResponse
    {
        $this->authorizeLegacy($request, 'updateUser');

        $validated = $request->validated();

        $updatedUser = DB::transaction(function () use ($validated, $user): User {
            $payload = [
                'username' => $validated['username'],
                'email' => $validated['email'],
                'firstname' => $validated['firstname'],
                'lastname' => $validated['lastname'] ?? '',
                'phone' => $validated['phone'] ?? '',
                'gender' => (int) $validated['gender'],
                'is_admin' => (int) $validated['group_id'] === 1,
                'is_active' => (bool) ($validated['is_active'] ?? true),
            ];

            if (! empty($validated['password'])) {
                $payload['password'] = $validated['password'];
            }

            $user->update($payload);

            DB::table('user_group')->updateOrInsert(
                ['user_id' => $user->id],
                ['group_id' => (int) $validated['group_id']],
            );

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

        abort_unless($user && ($user->isLegacyAdmin() || in_array($permission, $user->legacyPermissions(), true)), 403, 'Unauthorized');
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
            'is_admin' => (bool) $user->is_admin,
            'name' => $user->name,
            'is_active' => (bool) ($user->is_active ?? true),
            'tracker_role' => $user->tracker_role,
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