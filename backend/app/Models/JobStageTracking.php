<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class JobStageTracking extends Model
{
    protected $table = 'job_stage_tracking';

    protected $fillable = [
        'job_id',
        'stage_id',
        'entered_at',
        'exited_at',
        'sla_deadline',
        'is_overdue',
        'overdue_minutes',
    ];

    protected function casts(): array
    {
        return [
            'entered_at' => 'datetime',
            'exited_at' => 'datetime',
            'sla_deadline' => 'datetime',
            'is_overdue' => 'boolean',
        ];
    }

    public function job(): BelongsTo
    {
        return $this->belongsTo(Jobs::class, 'job_id');
    }

    public function stage(): BelongsTo
    {
        return $this->belongsTo(WorkflowStage::class, 'stage_id');
    }
}
