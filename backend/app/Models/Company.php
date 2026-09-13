<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Company extends Model
{
    protected $table = 'company';
    protected $primaryKey = 'id';
    public $incrementing = false;
    public $timestamps = false;

    protected $fillable = [
        'id', 'company_name', 'service_charge_value', 'vat_charge_value',
        'address', 'corporate_address', 'gst_no', 'pan_no', 'phone',
        'bank_name', 'account_number', 'ifsc_code', 'account_name',
        'country', 'message', 'currency',
    ];
}
