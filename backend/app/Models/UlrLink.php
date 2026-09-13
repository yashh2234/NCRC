<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class UlrLink extends Model
{
    protected $table = 'ulr_link';
    public $timestamps = false;
    protected $fillable = [
        'uid_no',
        'ulr_no',
        'date',
        'ndate',
        'name_of_department',
        'name_of_agency',
        'name_of_project',
        'sample_details',
        'qty',
        'parameters',
        'testing_period',
        'sample_received_date',
        'report_dispatch_date',
        'bill_details',
        'signature_remark',
    ];
}
