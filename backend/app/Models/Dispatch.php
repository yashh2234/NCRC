<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Dispatch extends Model
{
    protected $table = 'dispatches';

    protected $fillable = [
        'report_id', 'work_order_id', 'registration_id', 'dispatch_date',
        'dispatch_method', 'courier_name', 'tracking_number',
        'recipient_name', 'recipient_address', 'received_by',
        'received_at', 'status', 'notes', 'dispatched_by',
    ];

    protected $casts = [
        'received_at' => 'datetime',
    ];

    public function workOrder(): BelongsTo
    {
        return $this->belongsTo(WorkOrder::class);
    }

    public function dispatchedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'dispatched_by');
    }
}
