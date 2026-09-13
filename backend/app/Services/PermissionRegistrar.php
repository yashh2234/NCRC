<?php

namespace App\Services;

use App\Models\Permission;
use App\Models\User;
use App\Models\LegacyGroup;
use Illuminate\Support\Facades\Cache;

class PermissionRegistrar
{
    /**
     * Get all permission names for a user (merged from roles + direct).
     */
    public function getPermissions(User $user): array
    {
        $cacheKey = "user_permissions:{$user->id}";

        return Cache::remember($cacheKey, 300, function () use ($user) {
            $permissions = [];

            // 1. From legacy groups (old serialized format)
            foreach ($user->groups as $group) {
                $legacyPerms = $group->permissions ?? [];
                $permissions = array_merge($permissions, $legacyPerms);
            }

            // 2. From new role_has_permissions pivot
            $roleIds = $user->groups->pluck('id');
            if ($roleIds->isNotEmpty()) {
                $rolePerms = Permission::whereHas('roles', function ($q) use ($roleIds) {
                    $q->whereIn('role_id', $roleIds);
                })->pluck('name')->toArray();
                $permissions = array_merge($permissions, $rolePerms);
            }

            // 3. Direct user permissions (overrides)
            $directPerms = Permission::whereHas('users', function ($q) use ($user) {
                $q->where('model_id', $user->id);
            })->pluck('name')->toArray();
            $permissions = array_merge($permissions, $directPerms);

            return array_unique($permissions);
        });
    }

    /**
     * Check if a user has a specific permission.
     */
    public function hasPermission(User $user, string $permission): bool
    {
        return in_array($permission, $this->getPermissions($user), true);
    }

    /**
     * Check if a user has any of the given permissions.
     */
    public function hasAnyPermission(User $user, array $permissions): bool
    {
        return !empty(array_intersect($permissions, $this->getPermissions($user)));
    }

    /**
     * Check if a user has all of the given permissions.
     */
    public function hasAllPermissions(User $user, array $permissions): bool
    {
        return empty(array_diff($permissions, $this->getPermissions($user)));
    }

    /**
     * Sync permissions for a role (updates both new pivot and legacy serialized column).
     */
    public function syncRolePermissions(LegacyGroup $role, array $permissionNames): void
    {
        // Sync new pivot table
        $permissionIds = Permission::whereIn('name', $permissionNames)->pluck('id');
        $role->newPermissions()->sync($permissionIds);

        // Sync legacy serialized column for backward compatibility
        $role->permission = serialize(array_values($permissionNames));
        $role->save();
    }

    /**
     * Get all permissions grouped by module.
     */
    public function getGroupedPermissions(): array
    {
        return Permission::all()
            ->groupBy(fn ($p) => $p->module ?? 'General')
            ->map(fn ($group) => $group->values())
            ->toArray();
    }

    /**
     * Seed the default permission set.
     */
    public static function seedDefaultPermissions(): void
    {
        $permissions = [
            // Dashboard
            ['name' => 'view_dashboard', 'module' => 'Dashboard', 'action' => 'view', 'description' => 'View the dashboard'],

            // Users
            ['name' => 'view_users', 'module' => 'Users', 'action' => 'view', 'description' => 'View user list'],
            ['name' => 'create_users', 'module' => 'Users', 'action' => 'create', 'description' => 'Create new users'],
            ['name' => 'update_users', 'module' => 'Users', 'action' => 'update', 'description' => 'Edit existing users'],
            ['name' => 'delete_users', 'module' => 'Users', 'action' => 'delete', 'description' => 'Delete users'],

            // Roles
            ['name' => 'view_roles', 'module' => 'Roles', 'action' => 'view', 'description' => 'View roles and permissions'],
            ['name' => 'create_roles', 'module' => 'Roles', 'action' => 'create', 'description' => 'Create new roles'],
            ['name' => 'update_roles', 'module' => 'Roles', 'action' => 'update', 'description' => 'Edit roles'],
            ['name' => 'delete_roles', 'module' => 'Roles', 'action' => 'delete', 'description' => 'Delete roles'],

            // Registrations
            ['name' => 'view_registrations', 'module' => 'Registrations', 'action' => 'view', 'description' => 'View registrations'],
            ['name' => 'create_registrations', 'module' => 'Registrations', 'action' => 'create', 'description' => 'Create registrations'],
            ['name' => 'update_registrations', 'module' => 'Registrations', 'action' => 'update', 'description' => 'Edit registrations'],
            ['name' => 'delete_registrations', 'module' => 'Registrations', 'action' => 'delete', 'description' => 'Delete registrations'],

            // Lab / Testing
            ['name' => 'view_lab', 'module' => 'Lab', 'action' => 'view', 'description' => 'View lab dashboard'],
            ['name' => 'assign_tests', 'module' => 'Lab', 'action' => 'assign', 'description' => 'Assign tests to technicians'],
            ['name' => 'start_testing', 'module' => 'Lab', 'action' => 'testing', 'description' => 'Start testing on samples'],
            ['name' => 'enter_observations', 'module' => 'Lab', 'action' => 'observations', 'description' => 'Enter test observations'],

            // Reports
            ['name' => 'view_reports', 'module' => 'Reports', 'action' => 'view', 'description' => 'View reports'],
            ['name' => 'generate_reports', 'module' => 'Reports', 'action' => 'generate', 'description' => 'Generate reports'],
            ['name' => 'approve_reports', 'module' => 'Reports', 'action' => 'approve', 'description' => 'Approve reports'],
            ['name' => 'cancel_reports', 'module' => 'Reports', 'action' => 'cancel', 'description' => 'Cancel reports'],
            ['name' => 'print_reports', 'module' => 'Reports', 'action' => 'print', 'description' => 'Print reports'],
            ['name' => 'export_reports', 'module' => 'Reports', 'action' => 'export', 'description' => 'Export reports to CSV'],

            // Billing
            ['name' => 'view_billing', 'module' => 'Billing', 'action' => 'view', 'description' => 'View billing'],
            ['name' => 'create_billing', 'module' => 'Billing', 'action' => 'create', 'description' => 'Create billing entries'],
            ['name' => 'update_billing', 'module' => 'Billing', 'action' => 'update', 'description' => 'Edit billing'],
            ['name' => 'delete_billing', 'module' => 'Billing', 'action' => 'delete', 'description' => 'Delete billing'],
            ['name' => 'send_reminders', 'module' => 'Billing', 'action' => 'notify', 'description' => 'Send payment reminders'],

            // Invoices
            ['name' => 'view_invoices', 'module' => 'Invoices', 'action' => 'view', 'description' => 'View invoices'],
            ['name' => 'create_invoices', 'module' => 'Invoices', 'action' => 'create', 'description' => 'Create invoices'],
            ['name' => 'update_invoices', 'module' => 'Invoices', 'action' => 'update', 'description' => 'Edit invoices'],
            ['name' => 'delete_invoices', 'module' => 'Invoices', 'action' => 'delete', 'description' => 'Delete invoices'],
            ['name' => 'print_invoices', 'module' => 'Invoices', 'action' => 'print', 'description' => 'Print invoices'],

            // Purchase Orders
            ['name' => 'view_purchase_orders', 'module' => 'Purchase Orders', 'action' => 'view', 'description' => 'View POs'],
            ['name' => 'create_purchase_orders', 'module' => 'Purchase Orders', 'action' => 'create', 'description' => 'Create POs'],
            ['name' => 'update_purchase_orders', 'module' => 'Purchase Orders', 'action' => 'update', 'description' => 'Edit POs'],
            ['name' => 'delete_purchase_orders', 'module' => 'Purchase Orders', 'action' => 'delete', 'description' => 'Delete POs'],

            // Expenses
            ['name' => 'view_expenses', 'module' => 'Expenses', 'action' => 'view', 'description' => 'View expenses'],
            ['name' => 'create_expenses', 'module' => 'Expenses', 'action' => 'create', 'description' => 'Create expenses'],

            // Workflow
            ['name' => 'view_workflows', 'module' => 'Workflows', 'action' => 'view', 'description' => 'View workflow templates'],
            ['name' => 'manage_workflows', 'module' => 'Workflows', 'action' => 'manage', 'description' => 'Manage workflow templates'],
            ['name' => 'manage_jobs', 'module' => 'Workflows', 'action' => 'jobs', 'description' => 'Manage jobs'],

            // Permissions (RBAC management)
            ['name' => 'manage_permissions', 'module' => 'Permissions', 'action' => 'manage', 'description' => 'Manage permissions and assignments'],

            // Settings
            ['name' => 'view_settings', 'module' => 'Settings', 'action' => 'view', 'description' => 'View settings'],
            ['name' => 'update_settings', 'module' => 'Settings', 'action' => 'update', 'description' => 'Update settings'],

            // ULR Links
            ['name' => 'view_ulr_links', 'module' => 'ULR Links', 'action' => 'view', 'description' => 'View ULR links'],
            ['name' => 'manage_ulr_links', 'module' => 'ULR Links', 'action' => 'manage', 'description' => 'Manage ULR links'],

            // Stores
            ['name' => 'view_stores', 'module' => 'Stores', 'action' => 'view', 'description' => 'View stores'],
            ['name' => 'manage_stores', 'module' => 'Stores', 'action' => 'manage', 'description' => 'Manage stores'],

            // Audit
            ['name' => 'view_audit_logs', 'module' => 'Audit', 'action' => 'view', 'description' => 'View audit logs'],

            // User Tracking
            ['name' => 'view_user_tracking', 'module' => 'User Tracking', 'action' => 'view', 'description' => 'View user activity tracking'],

            // Job Tracker Workflow (aligned with Namotech Excel)
            ['name' => 'view_my_queue', 'module' => 'Job Tracker', 'action' => 'view', 'description' => 'View personal queue filtered by role stages'],
            ['name' => 'view_all_queues', 'module' => 'Job Tracker', 'action' => 'view', 'description' => 'View all role queue counts (admin/manager)'],
            ['name' => 'view_financial_snapshot', 'module' => 'Job Tracker', 'action' => 'view', 'description' => 'View financial KPIs (billing, payments)'],
            ['name' => 'manage_dispatch', 'module' => 'Job Tracker', 'action' => 'manage', 'description' => 'Handle report dispatch'],
            ['name' => 'manage_payments', 'module' => 'Job Tracker', 'action' => 'manage', 'description' => 'Handle payment follow-up'],

            // Clients
            ['name' => 'view_clients', 'module' => 'Clients', 'action' => 'view', 'description' => 'View client list'],
            ['name' => 'create_clients', 'module' => 'Clients', 'action' => 'create', 'description' => 'Create new clients'],
            ['name' => 'update_clients', 'module' => 'Clients', 'action' => 'update', 'description' => 'Edit clients'],
            ['name' => 'delete_clients', 'module' => 'Clients', 'action' => 'delete', 'description' => 'Delete clients'],

            // Outsource
            ['name' => 'view_outsource', 'module' => 'Outsource', 'action' => 'view', 'description' => 'View outsource assignments'],
            ['name' => 'manage_outsource', 'module' => 'Outsource', 'action' => 'manage', 'description' => 'Manage outsource assignments'],

            // Quotations
            ['name' => 'view_quotations', 'module' => 'Quotations', 'action' => 'view', 'description' => 'View quotations'],
            ['name' => 'create_quotations', 'module' => 'Quotations', 'action' => 'create', 'description' => 'Create quotations'],
            ['name' => 'update_quotations', 'module' => 'Quotations', 'action' => 'update', 'description' => 'Edit quotations'],

            // Work Orders
            ['name' => 'view_work_orders', 'module' => 'Work Orders', 'action' => 'view', 'description' => 'View work orders'],
            ['name' => 'create_work_orders', 'module' => 'Work Orders', 'action' => 'create', 'description' => 'Create work orders'],
            ['name' => 'update_work_orders', 'module' => 'Work Orders', 'action' => 'update', 'description' => 'Edit work orders'],

            // Documents
            ['name' => 'view_documents', 'module' => 'Documents', 'action' => 'view', 'description' => 'View documents'],
            ['name' => 'manage_documents', 'module' => 'Documents', 'action' => 'manage', 'description' => 'Upload and manage documents'],

            // Analytics
            ['name' => 'view_analytics', 'module' => 'Analytics', 'action' => 'view', 'description' => 'View analytics and charts'],
        ];

        foreach ($permissions as $data) {
            Permission::firstOrCreate(
                ['name' => $data['name']],
                $data
            );
        }
    }
}
