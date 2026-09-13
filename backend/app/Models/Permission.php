<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Permission extends Model
{
    protected $fillable = [
        'name',
        'guard_name',
        'module',
        'action',
        'description',
    ];

    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(LegacyGroup::class, 'role_has_permissions', 'permission_id', 'role_id');
    }

    public function users(): BelongsToMany
    {
        return $this->morphedByMany(User::class, 'model', 'model_has_permissions', 'permission_id', 'model_id');
    }
}
