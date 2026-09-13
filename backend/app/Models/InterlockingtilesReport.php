<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class InterlockingtilesReport extends Model
{
    protected $table = 'interlockingtiles_report';
    protected $primaryKey = 'iTilesId';
    public $incrementing = false;
    public $timestamps = false;

    protected $fillable = [
        'iTilesId', 'iReportId', 'uid_no', 'location', 'size', 'date_of_testing', 'age_of_specimen', 'crushing_load_1', 'crushing_load_2', 'crushing_load_3', 'crushing_load_4', 'crushing_load_5', 'crushing_load_6', 'crushing_load_7', 'crushing_load_8', 'currected_comp_strength_1', 'currected_comp_strength_2', 'currected_comp_strength_3', 'currected_comp_strength_4', 'currected_comp_strength_5', 'currected_comp_strength_6', 'currected_comp_strength_7', 'currected_comp_strength_8', 'avg_comp_strength', 'is_code_comp_strength'
    ];
}
