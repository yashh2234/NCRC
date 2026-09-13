<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WorkflowStage extends Model
{
    protected $fillable = [
        'template_id',
        'name',
        'slug',
        'sort_order',
        'assigned_role_id',
        'sla_hours',
        'is_start',
        'is_end',
        'color',
    ];

    protected function casts(): array
    {
        return [
            'is_start' => 'boolean',
            'is_end' => 'boolean',
            'sla_hours' => 'float',
        ];
    }

    public function template(): BelongsTo
    {
        return $this->belongsTo(WorkflowTemplate::class, 'template_id');
    }

    public function allowedTransitionsTo()
    {
        return $this->hasMany(WorkflowTransition::class, 'from_stage_id');
    }

    public function allowedTransitionsFrom()
    {
        return $this->hasMany(WorkflowTransition::class, 'to_stage_id');
    }
}
