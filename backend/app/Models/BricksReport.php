<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BricksReport extends Model
{
    protected $table = 'bricks_report';
    protected $primaryKey = 'iBricksId';
    public $incrementing = false;
    public $timestamps = false;

    protected $fillable = [
        'iBricksId', 'iReportId', 'uid_no', 'dimension_length', 'dimension_width', 'dimension_height', 'water_absorption', 'efflorescence', 'compressive_strength_main', 'length', 'width', 'load', 'compressive_strength', 'avg_compressive_strength', 'limit', 'create_date', 'set_count'
    ];
}
