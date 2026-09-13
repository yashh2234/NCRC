<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Report extends Model
{
    protected $table = 'reports';
    protected $primaryKey = 'iReportId';

    public $incrementing = false;
    public $timestamps = false;

    protected $fillable = [
        'iReportId',
        'job_id',
        'uid_no',
        'ulr_no',
        'customer_details',
        'agency_name',
        'reference_no',
        'material_details',
        'source_location',
        'work_order_no',
        'sample_date',
        'sample_tested_date',
        'dispatch_date',
        'sampled_by',
        'environment_condition',
        'report_type',
        'status',
        'cancel_remark',
        'user_id',
        'updated_by',
        'updated_date',
        'create_date',
        'assigned_to',
        'assigned_at',
        'testing_started_at',
        'report_generated_at',
        'submitted_at',
        'approved_at',
        'approved_by',
        'locked_at',
        'locked_by',
    ];

    protected $casts = [
        'create_date' => 'datetime',
        'updated_date' => 'datetime',
        'assigned_at' => 'datetime',
        'testing_started_at' => 'datetime',
        'report_generated_at' => 'datetime',
        'submitted_at' => 'datetime',
        'approved_at' => 'datetime',
        'locked_at' => 'datetime',
    ];

    public function job(): BelongsTo
    {
        return $this->belongsTo(Jobs::class, 'job_id');
    }

    public function cubeReport()
    {
        return $this->hasMany(CubeReport::class, 'iReportId', 'iReportId');
    }

    public function technicalReviews()
    {
        return $this->hasMany(TechnicalReview::class, 'report_id', 'iReportId');
    }

    public function assignedUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function approvedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function lockedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'locked_by');
    }

    public function getWorkflowStatusAttribute(): ?string
    {
        return $this->status;
    }

    public function getSampleDateAttribute($value)
    {
        return $this->parseLegacyDate($value);
    }

    public function getSampleTestedDateAttribute($value)
    {
        return $this->parseLegacyDate($value);
    }

    public function getDispatchDateAttribute($value)
    {
        return $this->parseLegacyDate($value);
    }

    protected function parseLegacyDate($value)
    {
        if (empty($value)) return null;
        if (preg_match('/^\d{4}-\d{2}-\d{2}/', $value)) return substr($value, 0, 10);
        try {
            return \Carbon\Carbon::createFromFormat('d/m/Y', $value)->format('Y-m-d');
        } catch (\Exception $e) {
            return $value;
        }
    }
}
