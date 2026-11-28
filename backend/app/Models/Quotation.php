<?php

namespace App\Models;

use App\Models\Concerns\RecordsTimeline;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Quotation extends Model
{
    use RecordsTimeline;

    protected $table = 'quotations';

    public const STATUSES = ['draft', 'sent', 'accepted', 'rejected', 'expired'];

    /** Company => number prefix. ncs = NCS LLP (GST 18%), ncrc = NCRC Pvt Ltd (no GST) */
    public const COMPANIES = ['ncs' => 'NCS', 'ncrc' => 'NCRC'];

    /** The last LLP quotation made outside the app was NCS/2026/1057 */
    private const FIRST_SERIAL = ['ncs' => 1058, 'ncrc' => 1];

    protected $fillable = [
        'company', 'inquiry_id', 'quotation_no', 'date', 'valid_until',
        'client_name', 'agency_name', 'contact_person', 'mobile_no', 'email', 'location',
        'client_address', 'client_gstin', 'subject', 'intro', 'ref_no', 'ref_date', 'prepared_by',
        'total_amount', 'discount', 'gst_mode', 'tax_amount', 'transport', 'transport_gst', 'net_amount',
        'payment_terms', 'sections', 'signatory_name', 'signatory_designation',
        'terms_and_conditions', 'status', 'sent_via', 'sent_at',
        'accepted_at', 'notes', 'admin_remark', 'created_by', 'updated_by',
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
        'transport_gst' => 'boolean',
        'net_amount' => 'float',
        'sent_at' => 'datetime',
        'accepted_at' => 'datetime',
        'approval_by' => 'integer',
        'approval_at' => 'datetime',
        'approval_requested_by' => 'integer',
        'approval_requested_at' => 'datetime',
        'approved_content' => 'array',
    ];

    public function inquiry(): BelongsTo
    {
        return $this->belongsTo(Inquiry::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(QuotationItem::class)->orderBy('sort_order')->orderBy('id');
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approval_by');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function approvalRequester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approval_requested_by');
    }

    /** Everything that prints; a change in it needs approval (the office remark does not print) */
    public function content(): array
    {
        $data = $this->toApiBase();
        $keys = ['company', 'quotation_no', 'date', 'valid_until', 'client_name', 'client_address', 'client_gstin', 'contact_person', 'mobile_no', 'email',
            'location', 'ref_no', 'ref_date', 'prepared_by', 'subject', 'intro', 'discount', 'gst_mode', 'transport', 'transport_gst', 'payment_terms',
            'signatory_name', 'signatory_designation', 'net_amount', 'sections', 'items'];

        // The same form as it has when read back from the database
        return json_decode((string) json_encode(array_intersect_key($data, array_flip($keys))), true);
    }

    public function workOrders(): HasMany
    {
        return $this->hasMany(WorkOrder::class);
    }

    /** NCS/2026/1058, NCRC/2026/0001: the year follows the quotation date, each company's serial runs on and never resets */
    public static function nextNumber(string $company = 'ncs', ?string $date = null): string
    {
        $prefix = self::COMPANIES[$company];
        $next = self::FIRST_SERIAL[$company];
        static::query()->where('quotation_no', 'like', $prefix . '/%')->pluck('quotation_no')
            ->each(function ($no) use (&$next, $prefix): void {
                if (preg_match('#^' . $prefix . '/\d{4}/(\d+)#', (string) $no, $m)) {
                    $next = max($next, (int) $m[1] + 1);
                }
            });
        $ts = $date ? strtotime($date) : false;

        return $prefix . '/' . date('Y', $ts ?: time()) . '/' . str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }

    public function toApi(): array
    {
        $data = $this->toApiBase();
        $waiting = $this->approval !== 'approved';
        $data['approval'] = $this->approval ?? 'approved';
        $data['approval_by_name'] = $this->approver?->name;
        $data['approval_requested_by_name'] = $this->approvalRequester?->name;
        // Old quotations had "Prepared by" typed by hand, often left blank: then it is whoever made it
        $data['created_by_name'] = $this->creator?->name;
        $data['approval_at'] = $this->approval_at?->toIso8601String();
        $data['approval_requested_at'] = $this->approval_requested_at?->toIso8601String();
        $data['content'] = $this->content();
        // So that an approval counts only for what the approver has seen
        $data['content_hash'] = $this->contentHash();
        if (! $waiting) {
            $data['approved_content'] = null;
        }

        return $data;
    }

    public function contentHash(): string
    {
        return md5((string) json_encode($this->content()));
    }

    private function toApiBase(): array
    {
        $data = $this->attributesToArray();
        $data['company'] ??= 'ncs';
        foreach (['date', 'valid_until', 'ref_date'] as $key) {
            $data[$key] = $this->{$key}?->format('Y-m-d');
        }
        $data['sections'] = $this->sections ?? [];
        // Terms typed in the old form become a Terms & Conditions section
        if ($this->sections === null && trim((string) $this->terms_and_conditions) !== '') {
            $data['sections'] = [['title' => 'Terms & Conditions', 'style' => 'text', 'body' => trim($this->terms_and_conditions), 'half' => false]];
        }
        $data['items'] = $this->items->map(fn (QuotationItem $it) => [
            'kind' => $it->kind ?? 'item',
            'description' => $it->description,
            'details' => $it->details ?? '',
            'extra' => $it->extra ?? [],
            'quantity' => $it->quantity,
            'unit' => $it->unit,
            'rate' => $it->rate,
            'amount' => $it->amount,
            'included' => $it->included,
        ])->values()->all();

        return $data;
    }
}
