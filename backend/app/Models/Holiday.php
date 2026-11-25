<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Holiday extends Model
{
    protected $table = 'holidays';

    protected $fillable = ['date', 'name', 'type', 'tentative'];

    protected $casts = ['date' => 'date:Y-m-d', 'tentative' => 'boolean'];
}
