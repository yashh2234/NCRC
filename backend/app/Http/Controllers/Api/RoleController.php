<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LegacyGroup;
use App\Models\Permission;
use App\Services\PermissionRegistrar;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class RoleController extends Controller
{
    public function index(): JsonResponse
    {
        $roles = LegacyGroup::query()
            ->withCount('users')
            ->orderBy('group_name')
            ->get()
            ->map(fn (LegacyGroup $group): array => $this->presentRole($group));

        return response()->json([
            'data' => $roles,
        ]);
    }

    public function show(LegacyGroup $role): JsonResponse
    {
        $role->loadCount('users');

        return response()->json([
            'role' => $this->presentRole($role),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizeLegacy($request, 'createGroup');

        $validated = $request->validate([
            'group_name' => ['required', 'string', 'max:255', 'unique:groups,group_name'],
            'permissions' => ['nullable', 'array'],
            'permissions.*' => ['string'],
        ]);

        $permNames = $validated['permissions'] ?? [];
        $permission = $this->serializePermissions($permNames);

        $group = LegacyGroup::query()->create([
            'group_name' => $validated['group_name'],
            'permission' => $permission,
        ]);

        // Sync new RBAC pivot
        $this->syncNewPermissions($group, $permNames);

        return response()->json([
            'message' => 'Role created successfully',
            'role' => $this->presentRole($group),
        ], 201);
    }

    public function update(Request $request, LegacyGroup $role): JsonResponse
    {
        $this->authorizeLegacy($request, 'updateGroup');

        $validated = $request->validate([
            'group_name' => ['required', 'string', 'max:255', Rule::unique('groups', 'group_name')->ignore($role->id)],
            'permissions' => ['nullable', 'array'],
            'permissions.*' => ['string'],
        ]);

        $permNames = $validated['permissions'] ?? $role->permissions;
        $permission = $this->serializePermissions($permNames);

        $role->update([
            'group_name' => $validated['group_name'],
            'permission' => $permission,
        ]);

        // Sync new RBAC pivot
        $this->syncNewPermissions($role, $permNames);

        return response()->json([
            'message' => 'Role updated successfully',
            'role' => $this->presentRole($role),
        ]);
    }

    public function destroy(Request $request, LegacyGroup $role): JsonResponse
    {
        $this->authorizeLegacy($request, 'deleteGroup');

        abort_if((int) $role->id === 1, 422, 'Cannot delete the Administrator role.');

        $role->users()->detach();
        $role->delete();

        return response()->json([
            'message' => 'Role deleted successfully',
        ]);
    }

    private function presentRole(LegacyGroup $group): array
    {
        return [
            'id' => $group->id,
            'name' => $group->group_name,
            'users_count' => (int) ($group->users_count ?? $group->users()->count()),
            'permissions' => $group->permissions,
            'permissions_count' => count($group->permissions),
        ];
    }

    private function serializePermissions(array $permissions): string
    {
        $indexed = [];
        foreach (array_values($permissions) as $i => $perm) {
            $indexed[$i] = $perm;
        }
        return serialize($indexed);
    }

    private function authorizeLegacy(Request $request, string $permission): void
    {
        $user = $request->user();
        abort_unless($user && ($user->isLegacyAdmin() || in_array($permission, $user->legacyPermissions(), true)), 403, 'Unauthorized');
    }

    private function syncNewPermissions(LegacyGroup $role, array $permNames): void
    {
        $permIds = Permission::whereIn('name', $permNames)->pluck('id');
        $role->newPermissions()->sync($permIds);
    }
}
