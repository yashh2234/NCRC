<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MesReport extends Model
{
    protected $table = 'mes_report';
    protected $primaryKey = 'iMesId';
    public $incrementing = false;
    public $timestamps = false;

    protected $fillable = [
        'iMesId', 'iReportId', 'uid_no', 'impact_value', 'los_angles_abrasion_value', 'crushing_value', 'soundness', 'presence_of_deleterious', 'organic_impurities', 'specific_gravity', 'is_sieve_size', 'weight_retained', 'weight_retained_in', 'cum_weight_retained_in', 'passing', 'is_grading_as_per_is_table', 'remarks', 'set_count', 'create_date'
    ];
}
