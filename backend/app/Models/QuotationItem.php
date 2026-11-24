<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class QuotationItem extends Model
{
    protected $table = 'quotation_items';

    protected $fillable = [
        'quotation_id', 'description', 'details', 'quantity', 'unit', 'rate', 'amount', 'included', 'sort_order',
    ];

    protected $casts = [
        'quantity' => 'float',
        'rate' => 'float',
        'amount' => 'float',
        'included' => 'boolean',
    ];

    public function quotation(): BelongsTo
    {
        return $this->belongsTo(Quotation::class);
    }
}
