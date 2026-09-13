<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Client extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'uid', 'company_name', 'contact_person',
        'phone', 'mobile', 'email', 'website',
        'address', 'city', 'state', 'pincode',
        'gst_no', 'pan_no', 'category',
        'notes', 'is_active',
        'created_by', 'updated_by',
    ];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    public function contacts(): HasMany
    {
        return $this->hasMany(ClientContact::class, 'client_id');
    }

    public function communications(): HasMany
    {
        return $this->hasMany(ClientCommunication::class, 'client_id')->latest('communication_date');
    }

    public function registrations(): HasMany
    {
        return $this->hasMany(Registration::class, 'client_id');
    }

    public function primaryContact()
    {
        return $this->hasOne(ClientContact::class, 'client_id')->where('is_primary', true);
    }
}
