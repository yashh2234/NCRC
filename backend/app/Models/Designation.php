<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Designation extends Model
{
    protected $fillable = ['department_id', 'name', 'description', 'is_active', 'created_by'];

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }
}
