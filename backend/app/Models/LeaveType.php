<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LeaveType extends Model
{
    protected $table = 'leave_types';

    protected $fillable = ['name', 'code', 'color', 'yearly_days', 'granted', 'counts_present', 'active', 'sort_order'];

    protected $casts = ['yearly_days' => 'float', 'granted' => 'boolean', 'counts_present' => 'boolean', 'active' => 'boolean'];
}
