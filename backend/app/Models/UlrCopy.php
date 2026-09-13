<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class UlrCopy extends Model
{
    protected $table = 'ulr_copy';
    public $timestamps = false;
    protected $fillable = [
        'uid_no',
        'ulr_no',
        'name_of_department',
        'name_of_agency',
        'name_of_project',
        'sample_details',
    ];
}
