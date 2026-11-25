<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FailedLogin extends Model
{
    protected $table = 'failed_logins';

    public $timestamps = false;

    protected $fillable = ['email', 'user_id', 'ip_address', 'user_agent', 'created_at'];

    protected $casts = ['created_at' => 'datetime'];
}
