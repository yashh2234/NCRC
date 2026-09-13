<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class QuotationItem extends Model
{
    protected $table = 'quotation_items';

    protected $fillable = [
        'quotation_id', 'description', 'quantity', 'unit', 'rate', 'amount', 'sort_order',
    ];

    protected $casts = [];

    public function quotation(): BelongsTo
    {
        return $this->belongsTo(Quotation::class);
    }
}
