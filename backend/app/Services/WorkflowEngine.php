<?php

namespace App\Services;

use App\Models\Jobs;
use App\Models\WorkflowTemplate;
use App\Models\WorkflowStage;
use App\Models\WorkflowTransition;
use App\Models\JobTimeline;
use App\Models\JobStageTracking;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class WorkflowEngine
{
    /**
     * Transition a job from its current stage to a target stage.
     */
    public function transition(Jobs $job, WorkflowTransition $transition, ?User $user = null, string $notes = ''): Jobs
    {
        if ($job->current_stage_id !== $transition->from_stage_id) {
            throw ValidationException::withMessages([
                'transition' => "Job is not at the required stage ({$transition->fromStage->name}).",
            ]);
        }

        if ($job->status === 'completed' || $job->status === 'cancelled') {
            throw ValidationException::withMessages([
                'transition' => 'Cannot transition a completed or cancelled job.',
            ]);
        }

        $allowed = $this->getAllowedTransitions($job);
        if (!$allowed->contains('id', $transition->id)) {
            throw ValidationException::withMessages([
                'transition' => 'This transition is not allowed from the current stage.',
            ]);
        }

        return DB::transaction(function () use ($job, $transition, $user, $notes) {
            // Exit current stage tracking
            $currentTracking = JobStageTracking::where('job_id', $job->id)
                ->where('stage_id', $job->current_stage_id)
                ->whereNull('exited_at')
                ->first();

            if ($currentTracking) {
                $currentTracking->update([
                    'exited_at' => now(),
                    'is_overdue' => $currentTracking->sla_deadline && now()->gt($currentTracking->sla_deadline),
                    'overdue_minutes' => $currentTracking->sla_deadline
                        ? (int) now()->diffInMinutes($currentTracking->sla_deadline, false)
                        : 0,
                ]);
            }

            $fromStageId = $job->current_stage_id;

            // Move to new stage
            $job->update([
                'current_stage_id' => $transition->to_stage_id,
                'updated_by' => $user?->id,
            ]);

            // Enter new stage tracking
            $newStage = $transition->toStage;
            $slaDeadline = $newStage->sla_hours
                ? now()->addHours((int) $newStage->sla_hours)
                : null;

            JobStageTracking::create([
                'job_id' => $job->id,
                'stage_id' => $newStage->id,
                'entered_at' => now(),
                'sla_deadline' => $slaDeadline,
            ]);

            // Record timeline entry
            JobTimeline::create([
                'job_id' => $job->id,
                'from_stage_id' => $fromStageId,
                'to_stage_id' => $transition->to_stage_id,
                'action' => $transition->name,
                'user_id' => $user?->id,
                'notes' => $notes,
            ]);

            // Auto-complete if this is an end stage
            if ($newStage->is_end) {
                $job->update(['status' => 'completed', 'completed_at' => now()]);
            }

            // Notify assigned user if stage has a role assignment
            if ($newStage->assigned_role_id && $job->assigned_to) {
                Notification::create([
                    'user_id' => $job->assigned_to,
                    'type' => 'stage_transition',
                    'title' => "Job moved to {$newStage->name}",
                    'message' => "Job {$job->uid_no} has been moved to stage: {$newStage->name}",
                    'data' => json_encode(['job_id' => $job->id, 'stage' => $newStage->slug]),
                ]);
            }

            return $job->fresh();
        });
    }

    /**
     * Return to a previous stage (reopen/return workflow).
     */
    public function returnToStage(Jobs $job, WorkflowStage $targetStage, ?User $user = null, string $notes = ''): Jobs
    {
        $timeline = $job->timeline()->latest()->first();
        if (!$timeline || !$timeline->from_stage_id) {
            throw ValidationException::withMessages([
                'transition' => 'Cannot return: no previous stage found.',
            ]);
        }

        $returnTransition = WorkflowTransition::where('template_id', $job->workflow_template_id)
            ->where('from_stage_id', $job->current_stage_id)
            ->where('to_stage_id', $targetStage->id)
            ->first();

        if (!$returnTransition) {
            throw ValidationException::withMessages([
                'transition' => "No allowed transition from current stage to {$targetStage->name}.",
            ]);
        }

        return $this->transition($job, $returnTransition, $user, $notes ?: "Returned to {$targetStage->name}");
    }

    /**
     * Get all allowed transitions for a job's current stage.
     */
    public function getAllowedTransitions(Jobs $job)
    {
        return WorkflowTransition::where('template_id', $job->workflow_template_id)
            ->where('from_stage_id', $job->current_stage_id)
            ->with('toStage')
            ->get();
    }

    /**
     * Start a job with the workflow template's start stage.
     */
    public function startJob(Jobs $job, ?User $user = null): Jobs
    {
        $template = $job->workflowTemplate;
        if (!$template) {
            throw ValidationException::withMessages([
                'template' => 'Job has no workflow template assigned.',
            ]);
        }

        $startStage = $template->startStage();
        if (!$startStage) {
            throw ValidationException::withMessages([
                'template' => 'Workflow template has no start stage defined.',
            ]);
        }

        return DB::transaction(function () use ($job, $startStage, $user) {
            $job->update([
                'current_stage_id' => $startStage->id,
                'status' => 'active',
                'started_at' => now(),
                'updated_by' => $user?->id,
            ]);

            JobStageTracking::create([
                'job_id' => $job->id,
                'stage_id' => $startStage->id,
                'entered_at' => now(),
                'sla_deadline' => $startStage->sla_hours
                    ? now()->addHours((int) $startStage->sla_hours)
                    : null,
            ]);

            JobTimeline::create([
                'job_id' => $job->id,
                'from_stage_id' => null,
                'to_stage_id' => $startStage->id,
                'action' => 'Job Started',
                'user_id' => $user?->id,
                'notes' => "Job started at stage: {$startStage->name}",
            ]);

            return $job->fresh();
        });
    }

    /**
     * Cancel a job.
     */
    public function cancelJob(Jobs $job, ?User $user = null, string $reason = ''): Jobs
    {
        return DB::transaction(function () use ($job, $user, $reason) {
            $currentTracking = JobStageTracking::where('job_id', $job->id)
                ->whereNull('exited_at')
                ->first();

            if ($currentTracking) {
                $currentTracking->update(['exited_at' => now()]);
            }

            $job->update([
                'status' => 'cancelled',
                'updated_by' => $user?->id,
            ]);

            JobTimeline::create([
                'job_id' => $job->id,
                'action' => 'Job Cancelled',
                'user_id' => $user?->id,
                'notes' => $reason ?: 'Job cancelled.',
            ]);

            return $job->fresh();
        });
    }

    /**
     * Assign a job to a user.
     */
    public function assignJob(Jobs $job, int $userId, ?User $assignedBy = null): Jobs
    {
        $job->update([
            'assigned_to' => $userId,
            'updated_by' => $assignedBy?->id,
        ]);

        JobTimeline::create([
            'job_id' => $job->id,
            'action' => 'Assigned',
            'user_id' => $assignedBy?->id,
            'notes' => "Assigned to user ID: {$userId}",
        ]);

        Notification::create([
            'user_id' => $userId,
            'type' => 'job_assigned',
            'title' => "Job {$job->uid_no} assigned to you",
            'message' => "You have been assigned to job {$job->uid_no}",
            'data' => json_encode(['job_id' => $job->id]),
        ]);

        return $job->fresh();
    }

    /**
     * Check SLA status for all active jobs.
     */
    public function checkSlaStatus(): array
    {
        $overdue = [];
        $trackings = JobStageTracking::whereNull('exited_at')
            ->whereNotNull('sla_deadline')
            ->with(['job', 'stage'])
            ->get();

        foreach ($trackings as $tracking) {
            $isOverdue = now()->gt($tracking->sla_deadline);
            $overdueMinutes = (int) now()->diffInMinutes($tracking->sla_deadline, false);

            if ($isOverdue !== $tracking->is_overdue || abs($overdueMinutes - $tracking->overdue_minutes) > 5) {
                $tracking->update([
                    'is_overdue' => $isOverdue,
                    'overdue_minutes' => max(0, $overdueMinutes),
                ]);
            }

            if ($isOverdue) {
                $overdue[] = [
                    'job' => $tracking->job->uid_no,
                    'stage' => $tracking->stage->name,
                    'overdue_minutes' => $overdueMinutes,
                ];
            }
        }

        return $overdue;
    }

    /**
     * Seed the default lab workflow template with the full 13-stage lifecycle.
     *
     * Stages:
     *  1. Inquiry
     *  2. Quotation
     *  3. Work Order
     *  4. Registration
     *  5. Sample Received
     *  6. Assigned
     *  7. Testing
     *  8. Report Draft
     *  9. Technical Review
     * 10. Approval
     * 11. Billing
     * 12. Dispatch
     * 13. Completed
     */
    public static function seedDefaultWorkflow(): void
    {
        $template = WorkflowTemplate::firstOrCreate(
            ['slug' => 'standard-lab-workflow'],
            [
                'name' => 'Standard Lab Workflow',
                'slug' => 'standard-lab-workflow',
                'description' => 'Full lifecycle workflow from inquiry to completion.',
                'is_active' => true,
            ]
        );

        $stageData = [
            ['name' => 'Inquiry',          'slug' => 'inquiry',          'sort_order' => 1,  'is_start' => true,  'color' => '#6b7280', 'sla_hours' => 24],
            ['name' => 'Quotation',        'slug' => 'quotation',        'sort_order' => 2,  'color' => '#8b5cf6', 'sla_hours' => 24],
            ['name' => 'Work Order',       'slug' => 'work-order',       'sort_order' => 3,  'color' => '#3b82f6', 'sla_hours' => 48],
            ['name' => 'Registration',     'slug' => 'registration',     'sort_order' => 4,  'color' => '#06b6d4', 'sla_hours' => 2],
            ['name' => 'Sample Received',  'slug' => 'sample-received',  'sort_order' => 5,  'color' => '#14b8a6', 'sla_hours' => 24],
            ['name' => 'Assigned',         'slug' => 'assigned',         'sort_order' => 6,  'color' => '#f59e0b', 'sla_hours' => 4],
            ['name' => 'Testing',          'slug' => 'testing',          'sort_order' => 7,  'color' => '#ef4444', 'sla_hours' => 72],
            ['name' => 'Report Draft',     'slug' => 'report-draft',     'sort_order' => 8,  'color' => '#f97316', 'sla_hours' => 24],
            ['name' => 'Technical Review', 'slug' => 'technical-review', 'sort_order' => 9,  'color' => '#ec4899', 'sla_hours' => 12],
            ['name' => 'Approval',         'slug' => 'approval',         'sort_order' => 10, 'color' => '#10b981', 'sla_hours' => 12],
            ['name' => 'Billing',          'slug' => 'billing',          'sort_order' => 11, 'color' => '#6366f1', 'sla_hours' => 48],
            ['name' => 'Dispatch',         'slug' => 'dispatch',         'sort_order' => 12, 'color' => '#0ea5e9', 'sla_hours' => 6],
            ['name' => 'Completed',        'slug' => 'completed',        'sort_order' => 13, 'is_end' => true,    'color' => '#22c55e'],
        ];

        $stages = [];
        foreach ($stageData as $i => $data) {
            $stage = WorkflowStage::firstOrCreate(
                ['template_id' => $template->id, 'slug' => $data['slug']],
                array_merge($data, ['template_id' => $template->id])
            );
            $stages[$data['slug']] = $stage;
        }

        $transitions = [
            // Forward transitions
            ['from' => 'inquiry',          'to' => 'quotation',        'name' => 'Convert to Quotation'],
            ['from' => 'quotation',        'to' => 'work-order',       'name' => 'Approve & Create Work Order'],
            ['from' => 'work-order',       'to' => 'registration',     'name' => 'Register Job'],
            ['from' => 'registration',     'to' => 'sample-received',  'name' => 'Receive Samples'],
            ['from' => 'sample-received',  'to' => 'assigned',         'name' => 'Assign to Department'],
            ['from' => 'assigned',         'to' => 'testing',          'name' => 'Start Testing'],
            ['from' => 'testing',          'to' => 'report-draft',     'name' => 'Generate Report'],
            ['from' => 'report-draft',     'to' => 'technical-review', 'name' => 'Submit for Review'],
            ['from' => 'technical-review', 'to' => 'approval',         'name' => 'Approve Report'],
            ['from' => 'approval',         'to' => 'billing',          'name' => 'Send for Billing'],
            ['from' => 'billing',          'to' => 'dispatch',         'name' => 'Mark for Dispatch'],
            ['from' => 'dispatch',         'to' => 'completed',        'name' => 'Mark Completed'],

            // Return / correction transitions
            ['from' => 'technical-review', 'to' => 'report-draft',     'name' => 'Return for Correction'],
            ['from' => 'approval',         'to' => 'technical-review', 'name' => 'Return for Review'],
            ['from' => 'billing',          'to' => 'approval',         'name' => 'Return to Approval'],
        ];

        foreach ($transitions as $t) {
            WorkflowTransition::firstOrCreate(
                [
                    'template_id' => $template->id,
                    'from_stage_id' => $stages[$t['from']]->id,
                    'to_stage_id' => $stages[$t['to']]->id,
                ],
                ['name' => $t['name']]
            );
        }
    }
}
