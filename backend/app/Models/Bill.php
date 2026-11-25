<?php

namespace App\Models;

use App\Services\BillApproval;
use Illuminate\Database\Eloquent\Model;

class Bill extends Model
{
    public const COMPANIES = ['ncrc', 'ncs'];

    protected $fillable = [
        'company', 'invoice_no', 'invoice_date', 'uid_no', 'uid_date',
        'work_order_no', 'work_order_date', 'report_no', 'report_date', 'sac_code',
        'terms_of_delivery', 'client_name', 'client_address', 'client_gstin',
        'items', 'gst_type', 'subtotal', 'transport', 'cgst', 'sgst', 'igst', 'advance',
        'net_amount', 'amount_received', 'received_date', 'payment_mode', 'remark',
        'cancelled_at', 'cancel_reason', 'credit_note_no', 'credit_note_date', 'credit_note_data', 'credit_amount',
        'created_by', 'updated_by',
    ];

    protected $casts = [
        'items' => 'array',
        'invoice_date' => 'date:Y-m-d',
        'uid_date' => 'date:Y-m-d',
        'work_order_date' => 'date:Y-m-d',
        'report_date' => 'date:Y-m-d',
        'received_date' => 'date:Y-m-d',
        'cancelled_at' => 'date:Y-m-d',
        'credit_note_date' => 'date:Y-m-d',
        'subtotal' => 'float',
        'transport' => 'float',
        'cgst' => 'float',
        'sgst' => 'float',
        'igst' => 'float',
        'advance' => 'float',
        'net_amount' => 'float',
        'amount_received' => 'float',
        'credit_note_data' => 'array',
        'credit_amount' => 'float',
        'approval_at' => 'datetime',
        'approval_requested_at' => 'datetime',
        'approved_content' => 'array',
        'cn_approval_at' => 'datetime',
        'cn_approval_requested_at' => 'datetime',
        'cn_approved_content' => 'array',
    ];

    protected $hidden = ['approved_content', 'cn_approved_content'];

    public function toApi(): array
    {
        $data = $this->toArray();
        foreach (['invoice_date', 'uid_date', 'work_order_date', 'report_date', 'received_date', 'cancelled_at', 'credit_note_date'] as $key) {
            $data[$key] = $this->{$key}?->format('Y-m-d');
        }
        $data['items'] = $this->items ?? [];
        $data['cancelled'] = $this->cancelled_at !== null;
        // Credit value: the credit note's own total, else the full invoice value (before advance)
        $data['credit_amount'] = $this->credit_amount ?: round($this->subtotal + $this->cgst + $this->sgst + $this->igst + $this->transport);
        $data['due_amount'] = $data['cancelled'] ? 0 : round(max(0, $this->net_amount - $this->amount_received), 2);

        // toArray() has the plain columns; what the screens need of the approval comes from here
        return array_merge($data, BillApproval::api($this), BillApproval::api($this, 'cn_'));
    }

    /** What the invoice prints; a change in it needs approval (payments and the office remark do not print) */
    public function printedContent(): array
    {
        return $this->only(['company', 'invoice_no']) + $this->dates(['invoice_date', 'uid_date', 'work_order_date', 'report_date'])
            + $this->only(['uid_no', 'work_order_no', 'report_no', 'terms_of_delivery', 'client_name', 'client_address', 'client_gstin', 'gst_type', 'transport', 'advance', 'net_amount'])
            + ['items' => $this->items ?? []];
    }

    /** What its credit note prints: its own copy of the document, else the invoice's */
    public function creditNoteContent(): array
    {
        $doc = $this->credit_note_data ?? [];
        $base = $this->printedContent();
        unset($base['advance'], $base['net_amount']);
        foreach (array_keys($base) as $key) {
            if (! in_array($key, ['company', 'invoice_no', 'invoice_date'], true) && array_key_exists($key, $doc)) {
                $base[$key] = $doc[$key];
            }
        }

        return ['credit_note_no' => $this->credit_note_no] + $this->dates(['credit_note_date']) + $base
            + ['total' => $this->credit_amount ?: round($this->subtotal + $this->cgst + $this->sgst + $this->igst + $this->transport)];
    }

    private function dates(array $keys): array
    {
        return array_combine($keys, array_map(fn ($k) => $this->{$k}?->format('Y-m-d'), $keys));
    }

    /** Financial year label for a date, April–March: 2026-04-24 → "2026-27" */
    public static function financialYear(?string $date): string
    {
        $ts = $date ? strtotime($date) : false;
        $ts = $ts ?: time();
        $year = (int) date('Y', $ts);
        $start = (int) date('n', $ts) >= 4 ? $year : $year - 1;

        return $start . '-' . substr((string) ($start + 1), -2);
    }
}
