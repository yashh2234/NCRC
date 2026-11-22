<?php

namespace App\Models;

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
    ];

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

        return $data;
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
