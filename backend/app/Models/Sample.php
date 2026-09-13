<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class Sample extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'job_id',
        'sample_name',
        'sample_type',
        'description',
        'quantity',
        'unit',
        'condition',
        'received_date',
        'collected_by',
        'remarks',
    ];

    protected function casts(): array
    {
        return [
            'received_date' => 'date',
        ];
    }

    public function job(): BelongsTo
    {
        return $this->belongsTo(Jobs::class, 'job_id');
    }
}
