<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class InvoiceList extends Model
{
    protected $table = 'invoice_list';
    protected $primaryKey = 'iIlid';
    public $incrementing = true;
    protected $keyType = 'int';
    public $timestamps = false;

    protected $fillable = [
        'iInvoiceId', 'description', 'unit', 'rate', 'discount', 'amount', 'set_count', 'create_date',
    ];

    public function invoice()
    {
        return $this->belongsTo(Invoice::class, 'iInvoiceId', 'iInvoiceId');
    }
}
