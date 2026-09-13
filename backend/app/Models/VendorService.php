<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VendorService extends Model
{
    protected $table = 'vendor_services';
    protected $fillable = ['vendor_id', 'test_id', 'service_name', 'description', 'rate', 'turnaround_time'];

    public function vendor(): BelongsTo
    {
        return $this->belongsTo(Vendor::class);
    }

    public function test(): BelongsTo
    {
        return $this->belongsTo(Test::class);
    }
}
