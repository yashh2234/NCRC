<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Time a user spent in the software on one day */
class UsageDay extends Model
{
    protected $table = 'usage_days';

    public $timestamps = false;

    protected $fillable = ['user_id', 'date', 'active_seconds', 'idle_seconds', 'first_at', 'last_active_at', 'last_ping_at'];

    protected $casts = ['date' => 'date:Y-m-d', 'active_seconds' => 'integer', 'idle_seconds' => 'integer', 'first_at' => 'datetime', 'last_active_at' => 'datetime', 'last_ping_at' => 'datetime'];
}
