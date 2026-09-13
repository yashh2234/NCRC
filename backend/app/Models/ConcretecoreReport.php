<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ConcretecoreReport extends Model
{
    protected $table = 'concretecore_report';
    protected $primaryKey = 'iCoreId';
    public $incrementing = false;
    public $timestamps = false;

    protected $fillable = [
        'iCoreId', 'iReportId', 'uid_no', 'ht_core_before_facing', 'dimension_core_facing_dia', 'dimension_core_facing_height', 'core_sectional_area', 'correction_factor', 'age_of_specimen', 'crushing_load', 'measured_comp_strength', 'corrected_comp_strength', 'equivalent_cube_strength', 'create_date', 'set_count'
    ];
}
