<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FerrocoverReport extends Model
{
    protected $table = 'ferrocover_report';
    protected $primaryKey = 'iFerroId';
    public $incrementing = false;
    public $timestamps = false;

    protected $fillable = [
        'iFerroId', 'iReportId', 'uid_no', 'cover_type', 'location', 'dia_of_plat', 'date_of_sample_collection', 'date_of_testing', 'applying_of_load', 'observation', 'remark', 'create_date', 'set_count'
    ];
}
