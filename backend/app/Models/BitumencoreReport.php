<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BitumencoreReport extends Model
{
    protected $table = 'bitumencore_report';
    protected $primaryKey = 'iBitumenCId';
    public $incrementing = false;
    public $timestamps = false;

    protected $fillable = [
        'iBitumenCId', 'iReportId', 'uid_no', 'name_of_test', 'thickness', 'date_of_sampling', 'mathod_of_test', 'density', 'result', 'create_date', 'set_count'
    ];
}
