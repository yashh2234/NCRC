<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TestResult extends Model
{
    protected $table = 'test_results';

    protected $fillable = [
        'job_id', 'job_assignment_id', 'test_id', 'category_id',
        'test_name', 'result_value', 'unit', 'specification_limit',
        'standard_name', 'method_name', 'status', 'remarks',
        'tested_by', 'tested_at',
    ];

    protected $casts = [
        'tested_at' => 'datetime',
    ];

    public function job(): BelongsTo
    {
        return $this->belongsTo(Jobs::class, 'job_id');
    }

    public function assignment(): BelongsTo
    {
        return $this->belongsTo(JobAssignment::class, 'job_assignment_id');
    }

    public function test(): BelongsTo
    {
        return $this->belongsTo(Test::class, 'test_id');
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(TestCategory::class, 'category_id');
    }

    public function tester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'tested_by');
    }
}
