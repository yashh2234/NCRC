<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BitumenlooseReport extends Model
{
    protected $table = 'bitumenloose_report';
    protected $primaryKey = 'iBitumenLId';
    public $incrementing = false;
    public $timestamps = false;

    protected $fillable = [
        'iBitumenlId', 'iReportId', 'uid_no', 'name_of_test', 'date_of_sampling', 'mathod_of_test', 'result', 'create_date', 'set_count'
    ];
}
