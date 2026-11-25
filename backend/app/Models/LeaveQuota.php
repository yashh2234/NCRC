<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LeaveQuota extends Model
{
    protected $table = 'leave_quotas';

    protected $fillable = ['user_id', 'leave_type_id', 'year', 'days'];

    protected $casts = ['days' => 'float', 'year' => 'integer'];
}
