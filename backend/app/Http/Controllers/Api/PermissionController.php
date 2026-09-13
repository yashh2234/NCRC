<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Permission;
use App\Models\LegacyGroup;
use App\Services\PermissionRegistrar;
use Illuminate\Http\Request;

class PermissionController extends Controller
{
    protected PermissionRegistrar $registrar;

    public function __construct(PermissionRegistrar $registrar)
    {
        $this->registrar = $registrar;
    }

    /**
     * List all permissions, grouped by module.
     */
    public function index()
    {
        $permissions = Permission::orderBy('module')->orderBy('name')->get()
            ->groupBy(fn ($p) => $p->module ?? 'General')
            ->map(fn ($group, $module) => [
                'module' => $module,
                'permissions' => $group->values()->map(fn ($p) => [
                    'id' => $p->id,
                    'name' => $p->name,
                    'action' => $p->action,
                    'description' => $p->description,
                ]),
            ])
            ->values();

        return response()->json($permissions);
    }

    /**
     * Get all permissions for a specific role (with assigned state).
     */
    public function rolePermissions(LegacyGroup $role)
    {
        $allPermissions = Permission::orderBy('module')->orderBy('name')->get();

        $rolePermissionIds = $role->newPermissions()->pluck('permissions.id')->toArray();
        $legacyPerms = $role->permissions();

        $permissions = $allPermissions->map(fn ($p) => [
            'id' => $p->id,
            'name' => $p->name,
            'module' => $p->module,
            'action' => $p->action,
            'description' => $p->description,
            'assigned' => in_array($p->id, $rolePermissionIds) || in_array($p->name, $legacyPerms),
        ]);

        return response()->json([
            'role' => $role,
            'permissions' => $permissions,
        ]);
    }

    /**
     * Sync permissions for a role.
     */
    public function syncRolePermissions(Request $request, LegacyGroup $role)
    {
        $validated = $request->validate([
            'permissions' => 'array',
            'permissions.*' => 'string',
        ]);

        $this->registrar->syncRolePermissions($role, $validated['permissions']);

        return response()->json([
            'message' => 'Permissions updated successfully',
            'role' => $role->fresh(),
        ]);
    }

    /**
     * Assign direct permission to a user.
     */
    public function assignToUser(Request $request)
    {
        $validated = $request->validate([
            'user_id' => 'required|integer|exists:users,id',
            'permissions' => 'required|array',
            'permissions.*' => 'string|exists:permissions,name',
        ]);

        $user = \App\Models\User::findOrFail($validated['user_id']);
        $permissionIds = Permission::whereIn('name', $validated['permissions'])->pluck('id');
        $user->directPermissions()->sync($permissionIds);

        // Clear cache
        \Illuminate\Support\Facades\Cache::forget("user_permissions:{$user->id}");

        return response()->json(['message' => 'Direct permissions updated']);
    }

    /**
     * Get a user's effective permissions.
     */
    public function userPermissions(Request $request, int $userId)
    {
        $user = \App\Models\User::findOrFail($userId);
        $permissions = $this->registrar->getPermissions($user);

        return response()->json([
            'user' => ['id' => $user->id, 'name' => $user->name],
            'permissions' => array_values($permissions),
            'direct_permissions' => $user->directPermissions->pluck('name'),
            'role_permissions' => Permission::whereHas('roles', function ($q) use ($user) {
                $q->whereIn('role_id', $user->groups->pluck('id'));
            })->pluck('name')->unique()->values(),
        ]);
    }

    /**
     * Seed default permissions.
     */
    public function seed()
    {
        PermissionRegistrar::seedDefaultPermissions();

        // Auto-assign all permissions to admin role
        $adminRole = LegacyGroup::find(1);
        if ($adminRole) {
            $allPerms = Permission::pluck('name')->toArray();
            $this->registrar->syncRolePermissions($adminRole, $allPerms);
        }

        return response()->json(['message' => 'Default permissions seeded']);
    }
}
