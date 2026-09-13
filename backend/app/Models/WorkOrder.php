<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WorkOrder extends Model
{
    protected $table = 'work_orders';

    protected $fillable = [
        'work_order_no', 'inquiry_id', 'quotation_id', 'registration_id',
        'client_name', 'agency_name', 'contact_person', 'mobile_no',
        'scope_of_work', 'terms_and_conditions', 'total_amount',
        'advance_payment', 'balance_dues', 'payment_terms',
        'status', 'assignment_type', 'due_date', 'notes', 'created_by',
    ];

    protected $casts = [];

    public function inquiry(): BelongsTo
    {
        return $this->belongsTo(Inquiry::class);
    }

    public function quotation(): BelongsTo
    {
        return $this->belongsTo(Quotation::class);
    }

    public function registration(): BelongsTo
    {
        return $this->belongsTo(Registration::class);
    }

    public function dispatches(): HasMany
    {
        return $this->hasMany(Dispatch::class);
    }

    public function outsourceAssignments(): HasMany
    {
        return $this->hasMany(OutsourceAssignment::class);
    }

    public static function generateWorkOrderNo(): string
    {
        $year = date('Y');
        $prefix = "WO/{$year}/";
        $last = static::where('work_order_no', 'like', $prefix.'%')->orderByDesc('id')->value('work_order_no');
        if ($last) {
            $seq = (int) substr($last, -5) + 1;
        } else {
            $seq = 1;
        }
        return $prefix . str_pad((string) $seq, 5, '0', STR_PAD_LEFT);
    }
}
