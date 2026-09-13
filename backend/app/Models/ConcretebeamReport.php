<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ConcretebeamReport extends Model
{
    protected $table = 'concretebeam_report';
    protected $primaryKey = 'iBeamId';
    public $incrementing = false;
    public $timestamps = false;

    protected $fillable = [
        'iBeamId', 'iReportId', 'uid_no', 'size_l', 'size_b', 'size_d', 'span_length', 'date_of_casting', 'date_of_testing', 'age_of_specimen', 'fracture_value', 'observe_load', 'formula', 'flexural_strength', 'avg_flexural_strength', 'create_date', 'set_count'
    ];
}
