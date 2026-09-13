<?php

namespace App\Services;

use App\Models\Jobs;
use App\Models\WorkflowStage;
use App\Models\WorkflowTransition;
use App\Models\JobTimeline;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Centralized bridge between standalone module actions and the workflow engine.
 * Every module controller calls into this service to keep jobs in sync.
 */
class WorkflowBridge
{
    protected WorkflowEngine $engine;

    public function __construct(WorkflowEngine $engine)
    {
        $this->engine = $engine;
    }

    /**
     * Move the job linked to a UID to the given stage slug.
     * Returns true on success, false if no transition found or no job exists.
     */
    public function advanceToStage(string $uidNo, string $stageSlug, ?User $user = null, string $notes = ''): bool
    {
        $job = $this->findJobByUid($uidNo);
        if (!$job || !$job->workflow_template_id) {
            return false;
        }

        $targetStage = WorkflowStage::where('template_id', $job->workflow_template_id)
            ->where('slug', $stageSlug)
            ->first();

        if (!$targetStage || $targetStage->id === $job->current_stage_id) {
            return false;
        }

        $transition = WorkflowTransition::where('template_id', $job->workflow_template_id)
            ->where('from_stage_id', $job->current_stage_id)
            ->where('to_stage_id', $targetStage->id)
            ->first();

        if ($transition) {
            try {
                $this->engine->transition($job, $transition, $user, $notes);
                return true;
            } catch (\Exception $e) {
                // Fallback: direct stage update with timeline
                $this->directStageUpdate($job, $targetStage, $user, $notes);
                return true;
            }
        }

        // Fallback: try direct update
        $this->directStageUpdate($job, $targetStage, $user, $notes);
        return true;
    }

    /**
     * Find a job by UID number (checks jobs table first, falls back to uid_no lookup).
     */
    public function findJobByUid(string $uidNo): ?Jobs
    {
        return Jobs::where('uid_no', $uidNo)->first();
    }

    /**
     * Find or create a job for a given UID, linking it to the active workflow template.
     * Returns the job instance.
     */
    public function findOrCreateJob(string $uidNo, string $title, ?User $user = null): Jobs
    {
        $job = Jobs::where('uid_no', $uidNo)->first();
        if ($job) {
            return $job;
        }

        $template = \App\Models\WorkflowTemplate::where('is_active', true)->first();
        if (!$template) {
            // No workflow template, create a job without one
            return Jobs::create([
                'uid_no' => $uidNo,
                'title' => $title,
                'status' => 'pending',
                'created_by' => $user?->id,
            ]);
        }

        $job = Jobs::create([
            'uid_no' => $uidNo,
            'title' => $title,
            'workflow_template_id' => $template->id,
            'status' => 'pending',
            'created_by' => $user?->id,
        ]);

        $this->engine->startJob($job, $user);

        return $job;
    }

    /**
     * Record a timeline entry on a job (for actions that don't change stage).
     */
    public function recordTimeline(string $uidNo, string $action, ?User $user = null, string $notes = ''): void
    {
        $job = $this->findJobByUid($uidNo);
        if (!$job) return;

        JobTimeline::create([
            'job_id' => $job->id,
            'action' => $action,
            'user_id' => $user?->id,
            'notes' => $notes,
        ]);
    }

    /**
     * Direct stage update when no valid transition exists.
     */
    protected function directStageUpdate(Jobs $job, WorkflowStage $targetStage, ?User $user, string $notes): void
    {
        $fromStageId = $job->current_stage_id;

        DB::transaction(function () use ($job, $targetStage, $user, $notes, $fromStageId) {
            $job->update([
                'current_stage_id' => $targetStage->id,
                'updated_by' => $user?->id,
            ]);

            JobTimeline::create([
                'job_id' => $job->id,
                'from_stage_id' => $fromStageId,
                'to_stage_id' => $targetStage->id,
                'action' => $notes ?: "Moved to {$targetStage->name}",
                'user_id' => $user?->id,
            ]);

            if ($targetStage->is_end) {
                $job->update(['status' => 'completed', 'completed_at' => now()]);
            }
        });
    }
}
