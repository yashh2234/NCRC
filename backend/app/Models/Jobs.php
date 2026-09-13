<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class Jobs extends Model
{
    use SoftDeletes;

    protected $table = 'workflow_jobs';

    protected $fillable = [
        'workflow_template_id',
        'current_stage_id',
        'uid_no',
        'title',
        'description',
        'priority',
        'status',
        'client_id',
        'assigned_to',
        'created_by',
        'updated_by',
        'started_at',
        'completed_at',
        'due_at',
    ];

    protected function casts(): array
    {
        return [
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
            'due_at' => 'datetime',
        ];
    }

    public function workflowTemplate(): BelongsTo
    {
        return $this->belongsTo(WorkflowTemplate::class, 'workflow_template_id');
    }

    public function currentStage(): BelongsTo
    {
        return $this->belongsTo(WorkflowStage::class, 'current_stage_id');
    }

    public function assignedUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function timeline(): HasMany
    {
        return $this->hasMany(JobTimeline::class, 'job_id')->latest('created_at');
    }

    public function stageTracking(): HasMany
    {
        return $this->hasMany(JobStageTracking::class, 'job_id');
    }

    public function activeStageTracking()
    {
        return $this->hasOne(JobStageTracking::class, 'job_id')->whereNull('exited_at');
    }

    public function registration()
    {
        return $this->belongsTo(Registration::class, 'uid_no', 'uid_no');
    }

    public function reports()
    {
        return $this->hasMany(Report::class, 'uid_no', 'uid_no');
    }

    public function samples(): HasMany
    {
        return $this->hasMany(Sample::class, 'job_id');
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class, 'client_id');
    }

    public function assignments(): HasMany
    {
        return $this->hasMany(JobAssignment::class, 'job_id');
    }

    public function testResults(): HasMany
    {
        return $this->hasMany(TestResult::class, 'job_id');
    }

    public function inquiry(): BelongsTo
    {
        return $this->belongsTo(Inquiry::class, 'uid_no', 'inquiry_no');
    }

    public function quotation(): BelongsTo
    {
        return $this->belongsTo(Quotation::class, 'uid_no', 'quotation_no');
    }

    public function workOrder(): BelongsTo
    {
        return $this->belongsTo(WorkOrder::class, 'uid_no', 'work_order_no');
    }
}
