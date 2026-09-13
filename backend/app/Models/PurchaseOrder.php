<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PurchaseOrder extends Model
{
    protected $table = 'purchaseorder';
    protected $primaryKey = 'iPurchaseorderId';
    protected $keyType = 'int';
    public $timestamps = false;

    protected $fillable = [
        'iPurchaseorderId', 'date', 'purchase_order', 'agency_name',
        'reporting_address', 'vendor_ref_no', 'vendor_ref_date',
        'total_amount', 'total_discount', 'transportation',
        'advance_amount', 'gst_amount', 'net_amount', 'remark', 'user_id',
    ];

    public function items(): HasMany
    {
        return $this->hasMany(PurchaseOrderList::class, 'iPurchaseorderId', 'iPurchaseorderId');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
