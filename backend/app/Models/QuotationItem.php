<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class QuotationItem extends Model
{
    protected $table = 'quotation_items';

    protected $fillable = [
        'quotation_id', 'kind', 'description', 'details', 'extra', 'quantity', 'unit', 'rate', 'amount', 'included', 'sort_order',
    ];

    /** heading / subheading: a row over the items, without quantity and rate */
    public const KINDS = ['item', 'heading', 'subheading'];

    protected $casts = [
        'extra' => 'array',
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
