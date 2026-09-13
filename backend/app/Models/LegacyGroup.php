<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class LegacyGroup extends Model
{
    use HasFactory;

    protected $table = 'groups';

    public $timestamps = false;

    protected $fillable = [
        'group_name',
        'permission',
    ];

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'user_group', 'group_id', 'user_id');
    }

    public function getPermissionsAttribute(): array
    {
        if (! is_string($this->permission) || $this->permission === '') {
            return [];
        }

        $decoded = @unserialize($this->permission, ['allowed_classes' => false]);

        return is_array($decoded) ? array_values(array_filter($decoded, 'is_string')) : [];
    }

    public function getPermissionsList(): array
    {
        return $this->getPermissionsAttribute();
    }

    public function newPermissions(): BelongsToMany
    {
        return $this->belongsToMany(Permission::class, 'role_has_permissions', 'role_id', 'permission_id');
    }
}