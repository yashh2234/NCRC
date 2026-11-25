<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Performa invoice of NCS LLP (GST always 18%) */
class PerformaInvoice extends Model
{
    private const DATES = ['invoice_date', 'uid_date', 'work_order_date', 'report_date'];

    protected $fillable = [
        'invoice_no', 'invoice_date', 'uid_no', 'uid_date', 'work_order_no', 'work_order_date', 'report_no', 'report_date',
        'terms_of_delivery', 'client_name', 'client_address', 'client_gstin', 'items', 'gst_type',
        'subtotal', 'transport', 'cgst', 'sgst', 'igst', 'net_amount', 'remark', 'created_by', 'updated_by',
    ];

    protected $casts = [
        'items' => 'array',
        'invoice_date' => 'date:Y-m-d',
        'uid_date' => 'date:Y-m-d',
        'work_order_date' => 'date:Y-m-d',
        'report_date' => 'date:Y-m-d',
        'subtotal' => 'float',
        'transport' => 'float',
        'cgst' => 'float',
        'sgst' => 'float',
        'igst' => 'float',
        'net_amount' => 'float',
    ];

    /** PI/2026/0001: by calendar year, starting again at 0001 on 1 January */
    public static function nextNumber(?string $date = null): string
    {
        $ts = $date ? strtotime($date) : false;
        $prefix = 'PI/'.date('Y', $ts ?: time()).'/';
        $max = 0;
        self::query()->where('invoice_no', 'like', $prefix.'%')->pluck('invoice_no')
            ->each(function ($no) use (&$max, $prefix): void {
                if (preg_match('#^'.preg_quote($prefix, '#').'(\d+)\s*$#', (string) $no, $m)) {
                    $max = max($max, (int) $m[1]);
                }
            });

        return $prefix.str_pad((string) ($max + 1), 4, '0', STR_PAD_LEFT);
    }

    public function toApi(): array
    {
        $data = $this->toArray();
        foreach (self::DATES as $key) {
            $data[$key] = $this->{$key}?->format('Y-m-d');
        }
        $data['items'] = $this->items ?? [];

        return $data;
    }
}
