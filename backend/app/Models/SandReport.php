<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SandReport extends Model
{
    protected $table = 'sand_report';
    protected $primaryKey = 'iSandId';
    public $incrementing = false;
    public $timestamps = false;

    protected $fillable = [
        'iSandId', 'iReportId', 'uid_no', 'is_sieve_size', 'weight_retained_in_gm', 'weight_retained_in_perc', 'cum_weight_retained_in_perc', 'passing', 'is_grading_as_per_is', 'remarks', 'create_date', 'set_count'
    ];
}
