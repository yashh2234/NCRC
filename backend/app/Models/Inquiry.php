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
        'source_location', 'priority', 'status', 'notes',
        'received_date', 'contacted_at', 'assigned_to', 'created_by',
    ];

    protected $casts = [
        'contacted_at' => 'datetime',
    ];

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
