<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Quotation extends Model
{
    protected $table = 'quotations';

    public const STATUSES = ['draft', 'sent', 'accepted', 'rejected', 'expired'];

    public const GST_MODES = ['add', 'extra', 'none'];

    /** The last quotation made outside the app was NCS/2026/1057 */
    private const FIRST_SERIAL = 1058;

    protected $fillable = [
        'inquiry_id', 'quotation_no', 'date', 'valid_until',
        'client_name', 'agency_name', 'contact_person', 'mobile_no', 'email', 'location',
        'client_address', 'client_gstin', 'subject', 'intro', 'ref_no', 'ref_date', 'prepared_by',
        'total_amount', 'discount', 'gst_mode', 'tax_amount', 'transport', 'net_amount',
        'payment_terms', 'sections', 'signatory_name', 'signatory_designation',
        'terms_and_conditions', 'status', 'sent_via', 'sent_at',
        'accepted_at', 'notes', 'created_by', 'updated_by',
    ];

    protected $casts = [
        'date' => 'date:Y-m-d',
        'valid_until' => 'date:Y-m-d',
        'ref_date' => 'date:Y-m-d',
        'sections' => 'array',
        'total_amount' => 'float',
        'discount' => 'float',
        'tax_amount' => 'float',
        'transport' => 'float',
        'net_amount' => 'float',
        'sent_at' => 'datetime',
        'accepted_at' => 'datetime',
    ];

    public function inquiry(): BelongsTo
    {
        return $this->belongsTo(Inquiry::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(QuotationItem::class)->orderBy('sort_order')->orderBy('id');
    }

    public function workOrders(): HasMany
    {
        return $this->hasMany(WorkOrder::class);
    }

    /** NCS/2026/1058: the year follows the quotation date, the serial runs on and never resets */
    public static function nextNumber(?string $date = null): string
    {
        $max = self::FIRST_SERIAL - 1;
        static::query()->where('quotation_no', 'like', 'NCS/%')->pluck('quotation_no')
            ->each(function ($no) use (&$max): void {
                if (preg_match('#^NCS/\d{4}/(\d+)#', (string) $no, $m)) {
                    $max = max($max, (int) $m[1]);
                }
            });
        $ts = $date ? strtotime($date) : false;

        return 'NCS/' . date('Y', $ts ?: time()) . '/' . ($max + 1);
    }

    public function toApi(): array
    {
        $data = $this->attributesToArray();
        foreach (['date', 'valid_until', 'ref_date'] as $key) {
            $data[$key] = $this->{$key}?->format('Y-m-d');
        }
        $data['sections'] = $this->sections ?? [];
        // Terms typed in the old form become a Terms & Conditions section
        if ($this->sections === null && trim((string) $this->terms_and_conditions) !== '') {
            $data['sections'] = [['title' => 'Terms & Conditions', 'style' => 'text', 'body' => trim($this->terms_and_conditions), 'half' => false]];
        }
        $data['items'] = $this->items->map(fn (QuotationItem $it) => [
            'description' => $it->description,
            'details' => $it->details ?? '',
            'quantity' => $it->quantity,
            'unit' => $it->unit,
            'rate' => $it->rate,
            'amount' => $it->amount,
            'included' => $it->included,
        ])->values()->all();

        return $data;
    }
}
