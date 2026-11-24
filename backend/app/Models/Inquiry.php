<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Inquiry extends Model
{
    protected $table = 'inquiries';

    protected $fillable = [
        'inquiry_no', 'client_name', 'agency_name', 'contact_person',
        'mobile_no', 'email', 'inquiry_type', 'scope_of_work',
        'source_location', 'budget', 'work_categories', 'priority', 'status', 'notes',
        'received_date', 'contacted_at', 'next_follow_up', 'assigned_to', 'created_by', 'needs_check',
    ];

    /** Call pipeline, in order. Keep in sync with INQUIRY_STATUSES in frontend/src/lib/inquiries.ts. */
    public const STATUSES = [
        'new', 'no_answer', 'interested', 'follow_up', 'quotation_sent', 'won', 'lost',
    ];

    protected $casts = [
        'contacted_at' => 'datetime',
        'work_categories' => 'array',
        'needs_check' => 'boolean',
        'received_date' => 'date:Y-m-d',
        'next_follow_up' => 'date:Y-m-d',
    ];

    public function activities(): HasMany
    {
        return $this->hasMany(InquiryActivity::class)->orderByDesc('id');
    }

    public function quotations(): HasMany
    {
        return $this->hasMany(Quotation::class);
    }

    public function workOrders(): HasMany
    {
        return $this->hasMany(WorkOrder::class);
    }

    public function assignedUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function createdByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public static function generateInquiryNo(): string
    {
        $year = date('Y');
        $prefix = "INQ/{$year}/";
        $last = static::where('inquiry_no', 'like', $prefix.'%')->orderByDesc('id')->value('inquiry_no');
        if ($last) {
            $seq = (int) substr($last, -5) + 1;
        } else {
            $seq = 1;
        }
        return $prefix . str_pad((string) $seq, 5, '0', STR_PAD_LEFT);
    }
}
