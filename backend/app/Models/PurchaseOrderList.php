<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PurchaseOrderList extends Model
{
    protected $table = 'purchaseorder_list';
    protected $primaryKey = 'iPlid';
    protected $keyType = 'int';
    public $timestamps = false;

    protected $fillable = [
        'iPurchaseorderId', 'description', 'unit', 'rate', 'discount', 'amount', 'set_count',
    ];

    public function purchaseOrder(): BelongsTo
    {
        return $this->belongsTo(PurchaseOrder::class, 'iPurchaseorderId', 'iPurchaseorderId');
    }
}
