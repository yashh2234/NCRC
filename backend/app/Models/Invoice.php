<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Invoice extends Model
{
    protected $table = 'invoices';
    protected $primaryKey = 'iInvoiceId';
    public $incrementing = true;
    protected $keyType = 'int';
    public $timestamps = true;

    protected $fillable = [
        'date', 'invoice_no', 'work_order_no', 'work_order_date',
        'report_no', 'report_date', 'agency_name', 'reporting_address',
        'agency_gst', 'agency_state', 'terms_of_delivery',
        'total_amount', 'total_discount', 'transportation',
        'sgst_amount', 'cgst_amount', 'gst_amount', 'net_amount',
        'advance_amount', 'user_id',
    ];

    public function items()
    {
        return $this->hasMany(InvoiceList::class, 'iInvoiceId', 'iInvoiceId');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
