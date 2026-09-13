<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Department extends Model
{
    protected $fillable = ['name', 'code', 'description', 'head_of_department', 'is_active', 'created_by'];

    public function designations(): HasMany
    {
        return $this->hasMany(Designation::class);
    }

    public function head(): BelongsTo
    {
        return $this->belongsTo(User::class, 'head_of_department');
    }
}
