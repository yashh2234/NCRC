<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AttendanceCorrection extends Model
{
    protected $table = 'attendance_corrections';

    protected $fillable = ['user_id', 'date', 'check_in_at', 'check_out_at', 'reason', 'status', 'decided_by', 'decided_at', 'remark', 'before'];

    protected $casts = ['date' => 'date:Y-m-d', 'check_in_at' => 'datetime', 'check_out_at' => 'datetime', 'decided_at' => 'datetime', 'before' => 'array'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function decider(): BelongsTo
    {
        return $this->belongsTo(User::class, 'decided_by');
    }
}
