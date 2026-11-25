<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One spell of work: check in to check out */
class Attendance extends Model
{
    protected $table = 'attendances';

    protected $fillable = ['user_id', 'date', 'check_in_at', 'check_out_at', 'in_lat', 'in_lng', 'in_accuracy', 'in_ip', 'in_note', 'out_lat', 'out_lng', 'out_accuracy', 'out_ip', 'out_note', 'auto_closed', 'correction_id'];

    protected $casts = ['date' => 'date:Y-m-d', 'check_in_at' => 'datetime', 'check_out_at' => 'datetime', 'in_lat' => 'float', 'in_lng' => 'float', 'out_lat' => 'float', 'out_lng' => 'float', 'auto_closed' => 'boolean'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
