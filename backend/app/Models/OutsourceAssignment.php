<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OutsourceAssignment extends Model
{
    protected $table = 'outsource_assignments';

    protected $fillable = [
        'work_order_id', 'registration_id', 'party_name', 'party_contact',
        'party_email', 'scope_of_work', 'agreed_amount', 'advance_payment',
        'remaining_payment', 'payment_status',
        'payment_amount', 'payment_date', 'payment_reference',
        'status', 'started_at', 'completed_at', 'completion_details',
        'delivery_date', 'notes', 'assigned_by', 'vendor_report',
    ];

    protected $casts = [
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

    public function workOrder(): BelongsTo
    {
        return $this->belongsTo(WorkOrder::class);
    }

    public function assignedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_by');
    }
}
