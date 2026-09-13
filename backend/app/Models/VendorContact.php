<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VendorContact extends Model
{
    protected $table = 'vendor_contacts';
    protected $fillable = ['vendor_id', 'name', 'designation', 'mobile', 'email', 'is_primary'];

    public function vendor(): BelongsTo
    {
        return $this->belongsTo(Vendor::class);
    }
}
