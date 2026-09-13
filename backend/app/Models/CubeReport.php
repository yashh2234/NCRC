<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CubeReport extends Model
{
    protected $table = 'cube_reports';
    protected $primaryKey = 'iCubeId';

    public $incrementing = false;

    public $timestamps = false;

    protected $fillable = [
        'iCubeId', 'iReportId', 'uid_no', 'location', 'size_of_cube', 'date_of_casting', 'date_of_testing', 'age_of_specimen', 'avg_comp_strength', 'is_code_comp_strength', 'load_1', 'load_2', 'load_3', 'comp_strength_1', 'comp_strength_2', 'comp_strength_3', 'set_count', 'create_date'
    ];

    protected $casts = [
        'create_date' => 'datetime',
    ];
}