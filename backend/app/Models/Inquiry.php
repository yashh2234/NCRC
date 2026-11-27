<?php

namespace App\Models;

use App\Models\Concerns\RecordsTimeline;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Inquiry extends Model
{
    use RecordsTimeline;

    protected $table = 'inquiries';

    protected $fillable = [
        'inquiry_no', 'client_name', 'agency_name', 'contact_person',
        'mobile_no', 'email', 'source', 'source_detail', 'inquiry_type', 'scope_of_work',
        'source_location', 'budget', 'work_categories', 'priority', 'status', 'notes',
        'received_date', 'contacted_at', 'next_follow_up', 'assigned_to', 'created_by',
    ];

    /** Call pipeline, in order. Keep in sync with INQUIRY_STATUSES in frontend/src/lib/inquiries.ts. */
    public const STATUSES = [
        'new', 'no_answer', 'interested', 'follow_up', 'quotation_sent', 'won', 'lost',
    ];

    /** Where enquiries come from. Keep in sync with ENQUIRY_SOURCES in frontend/src/lib/inquiries.ts. */
    public const SOURCES = [
        'Website', 'Phone Call', 'WhatsApp', 'Email', 'LinkedIn', 'Instagram / Facebook', 'Google Search / Maps', 'Reference',
        'Existing Client', 'Walk-in', 'Tender / Government Portal', 'IndiaMART / Justdial', 'Exhibition / Event', 'Site Visit / Field Staff', 'Other',
    ];

    protected $casts = [
        'contacted_at' => 'datetime',
        'work_categories' => 'array',
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
        // Numbers made before the word changed start with INQ; the count goes on
        $last = static::where('inquiry_no', 'like', "ENQ/{$year}/%")->orWhere('inquiry_no', 'like', "INQ/{$year}/%")
            ->pluck('inquiry_no')->map(fn (string $no): int => (int) substr($no, -5))->max() ?? 0;

        return "ENQ/{$year}/".str_pad((string) ($last + 1), 5, '0', STR_PAD_LEFT);
    }
}
