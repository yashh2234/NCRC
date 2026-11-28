<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\MorphToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Laravel\Sanctum\HasApiTokens;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use App\Services\PermissionRegistrar;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'username',
        'email',
        'password',
        'firstname',
        'lastname',
        'phone',
        'gender',
        'is_admin',
        'is_active',
        'tracker_role',
        'allowed_modules',
        'date_of_birth',
    ];

    /** Sidebar features that can be switched on per user (must match the frontend FEATURES list). */
    public const FEATURE_KEYS = [
        'tenders', 'inquiries', 'registrations', 'quotations', 'proposals', 'work_orders', 'outsource', 'reports',
        'ulr_add', 'ulr_register', 'final_reports', 'billing', 'due_reports', 'expenses',
        'purchase_orders', 'admin', 'mail', 'documents_site', 'quotation_approve', 'report_approve', 'bill_approve', 'leave_approve',
    ];

    /** Of the FEATURE_KEYS: switched on in "Access and approvals", not in the user form */
    public const BOX_KEYS = ['mail', 'documents_site', 'quotation_approve', 'report_approve', 'bill_approve', 'leave_approve'];

    /** Job roles that drive the dashboard and the job queues. */
    public const JOB_ROLES = ['registration', 'lab', 'report_staff', 'technical', 'manager', 'staff'];

    /** Permissions granted by the "Administration" feature (manage users). */
    private const USER_ADMIN_PERMISSIONS = ['view_users', 'create_users', 'update_users', 'delete_users', 'view_roles'];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var array<int, string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'password' => 'hashed',
            'is_admin' => 'boolean',
            'is_active' => 'boolean',
            'allowed_modules' => 'array',
            'push_prefs' => 'array',
            'app_prefs' => 'array',
            'date_of_birth' => 'date:Y-m-d',
        ];
    }

    /** The system's own account: not in the user list, without attendance and leave of its own */
    public function isSuperAdmin(): bool
    {
        return (int) $this->id === 1;
    }

    public function isFullAdmin(): bool
    {
        return (bool) $this->is_admin || $this->isLegacyAdmin();
    }

    /**
     * The user can open this page (same rule as canUserAccess in the app): full admins everything, others the pages
     * ticked for them. The job role is only a label. The dashboard shows only what the user can open.
     */
    public function canOpen(string $page): bool
    {
        $page = in_array($page, ['credit_notes', 'performa'], true) ? 'billing' : $page;

        return $this->isFullAdmin() || in_array($page, $this->allowed_modules ?? [], true);
    }

    /** Full admins, or users given the "Administration" feature, can manage users. */
    public function canManageUsers(): bool
    {
        return $this->isFullAdmin() || in_array('admin', $this->allowed_modules ?? [], true);
    }

    /** Full admins, and users given "Approve Quotations" */
    public function canApproveQuotations(): bool
    {
        return $this->isFullAdmin() || in_array('quotation_approve', $this->allowed_modules ?? [], true);
    }

    /** Full admins, and users given "Approve Reports" */
    public function canApproveReports(): bool
    {
        return $this->isFullAdmin() || in_array('report_approve', $this->allowed_modules ?? [], true);
    }

    /** Full admins, and users given "Approve Invoices" (invoices, performa invoices, credit notes) */
    public function canApproveBills(): bool
    {
        return $this->isFullAdmin() || in_array('bill_approve', $this->allowed_modules ?? [], true);
    }

    /** Full admins, and users given "Approve Leave" */
    public function canApproveLeave(): bool
    {
        return $this->isFullAdmin() || in_array('leave_approve', $this->allowed_modules ?? [], true);
    }

    public function getNameAttribute(): string
    {
        return trim($this->firstname.' '.$this->lastname);
    }

    public function getGroupAttribute()
    {
        return $this->groups->first();
    }

    public function getTrackerRoleAttribute(): string
    {
        if (!empty($this->attributes['tracker_role'])) {
            return $this->attributes['tracker_role'];
        }

        $groupName = strtolower($this->group->group_name ?? '');
        if ($this->is_admin || str_contains($groupName, 'admin')) {
            return 'admin';
        }
        if (str_contains($groupName, 'register')) {
            return 'registration';
        }
        if (str_contains($groupName, 'lab')) {
            return 'lab';
        }
        if (str_contains($groupName, 'report staff') || str_contains($groupName, 'report')) {
            return 'report_staff';
        }
        if (str_contains($groupName, 'technical')) {
            return 'technical';
        }
        if (str_contains($groupName, 'hr') || str_contains($groupName, 'account') || str_contains($groupName, 'manager')) {
            return 'manager';
        }

        return 'staff';
    }

    public function loginSessions(): HasMany
    {
        return $this->hasMany(LoginSession::class);
    }

    public function activities(): HasMany
    {
        return $this->hasMany(UserActivity::class);
    }

    public function groups(): BelongsToMany
    {
        return $this->belongsToMany(LegacyGroup::class, 'user_group', 'user_id', 'group_id');
    }

    public function legacyPermissions(): array
    {
        return $this->groups
            ->flatMap(fn (LegacyGroup $group): array => $group->permissions)
            ->unique()
            ->values()
            ->all();
    }

    public function isLegacyAdmin(): bool
    {
        return $this->groups->contains(fn (LegacyGroup $group): bool => (int) $group->id === 1 || strtolower($group->group_name) === 'administrator');
    }

    // === Enterprise RBAC Methods ===

    public function roles(): MorphToMany
    {
        return $this->morphToMany(LegacyGroup::class, 'model', 'model_has_roles', 'model_id', 'role_id');
    }

    public function directPermissions(): MorphToMany
    {
        return $this->morphToMany(Permission::class, 'model', 'model_has_permissions', 'model_id', 'permission_id');
    }

    public function allPermissions(): array
    {
        return app(PermissionRegistrar::class)->getPermissions($this);
    }

    /**
     * Check whether the user has a given RBAC permission.
     *
     * Named hasPermissionTo() rather than can() because Laravel's own
     * Authorizable trait (used by gates/policies) already declares
     * can(iterable|string $abilities, array|mixed $arguments = []) on
     * every Authenticatable model. Overriding it with an incompatible
     * signature causes a fatal "Declaration must be compatible" error
     * on class load.
     */
    public function hasPermissionTo(string $permission): bool
    {
        if ($this->is_admin || $this->isLegacyAdmin()) return true;
        if (in_array($permission, self::USER_ADMIN_PERMISSIONS, true) && $this->canManageUsers()) return true;
        return app(PermissionRegistrar::class)->hasPermission($this, $permission);
    }

    /**
     * Check whether the user has any of the given RBAC permissions.
     *
     * Named hasAnyPermissionTo() for the same reason as hasPermissionTo():
     * canAny(iterable|string $abilities, array|mixed $arguments = []) is
     * already declared by Laravel's Authorizable trait.
     */
    public function hasAnyPermissionTo(array $permissions): bool
    {
        if ($this->is_admin || $this->isLegacyAdmin()) return true;
        return app(PermissionRegistrar::class)->hasAnyPermission($this, $permissions);
    }

    /**
     * Check whether the user has all of the given RBAC permissions.
     */
    public function hasAllPermissionsTo(array $permissions): bool
    {
        if ($this->is_admin || $this->isLegacyAdmin()) return true;
        return app(PermissionRegistrar::class)->hasAllPermissions($this, $permissions);
    }
}