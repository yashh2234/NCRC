<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LeaveRequest extends Model
{
    protected $table = 'leave_requests';

    protected $fillable = ['user_id', 'leave_type_id', 'from_date', 'to_date', 'half', 'days', 'reason', 'status', 'decided_by', 'decided_at', 'remark'];

    protected $casts = ['from_date' => 'date:Y-m-d', 'to_date' => 'date:Y-m-d', 'days' => 'float', 'decided_at' => 'datetime'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function type(): BelongsTo
    {
        return $this->belongsTo(LeaveType::class, 'leave_type_id');
    }

    public function decider(): BelongsTo
    {
        return $this->belongsTo(User::class, 'decided_by');
    }
}
