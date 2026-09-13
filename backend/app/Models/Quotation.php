<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Quotation extends Model
{
    protected $table = 'quotations';

    protected $fillable = [
        'inquiry_id', 'quotation_no', 'date', 'valid_until',
        'client_name', 'agency_name', 'contact_person', 'mobile_no', 'email',
        'total_amount', 'discount', 'tax_amount', 'net_amount',
        'terms_and_conditions', 'status', 'sent_via', 'sent_at',
        'accepted_at', 'notes', 'created_by',
    ];

    protected $casts = [
        'sent_at' => 'datetime',
        'accepted_at' => 'datetime',
    ];

    public function inquiry(): BelongsTo
    {
        return $this->belongsTo(Inquiry::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(QuotationItem::class);
    }

    public function workOrders(): HasMany
    {
        return $this->hasMany(WorkOrder::class);
    }

    public static function generateQuotationNo(): string
    {
        $year = date('Y');
        $prefix = "QUO/{$year}/";
        $last = static::where('quotation_no', 'like', $prefix.'%')->orderByDesc('id')->value('quotation_no');
        if ($last) {
            $seq = (int) substr($last, -5) + 1;
        } else {
            $seq = 1;
        }
        return $prefix . str_pad((string) $seq, 5, '0', STR_PAD_LEFT);
    }
}
