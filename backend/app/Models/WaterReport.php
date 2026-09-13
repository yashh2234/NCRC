<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WaterReport extends Model
{
    protected $table = 'water_report';
    protected $primaryKey = 'iWaterId';
    public $incrementing = false;
    public $timestamps = false;

    protected $fillable = [
        'iWaterId', 'iReportId', 'uid_no', 'name_of_test', 'mathod_of_test', 'result', 'unit', 'specification', 'create_date', 'set_count'
    ];
}
