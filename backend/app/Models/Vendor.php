<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Vendor extends Model
{
    protected $fillable = ['vendor_name', 'contact_person', 'mobile', 'phone', 'email', 'website', 'address', 'city', 'state', 'pincode', 'gst_no', 'pan_no', 'services_offered', 'notes', 'is_active', 'approval_status', 'approved_by', 'approved_at', 'created_by'];

    protected $casts = ['is_active' => 'boolean', 'approved_at' => 'datetime'];

    public function contacts(): HasMany
    {
        return $this->hasMany(VendorContact::class);
    }

    public function services(): HasMany
    {
        return $this->hasMany(VendorService::class);
    }
}
