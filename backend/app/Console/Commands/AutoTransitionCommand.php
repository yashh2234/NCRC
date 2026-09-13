<?php

namespace App\Console\Commands;

use App\Models\Jobs;
use App\Models\WorkflowTransition;
use App\Models\JobTimeline;
use App\Models\Notification;
use App\Models\User;
use App\Services\WorkflowEngine;
use Illuminate\Console\Command;

class AutoTransitionCommand extends Command
{
    protected $signature = 'jobs:auto-transition';
    protected $description = 'Automatically transition jobs whose current stage work is complete';

    public function handle(WorkflowEngine $engine): void
    {
        $count = 0;

        // Strategy: for jobs in "lab-testing" stage where all linked reports
        // have status "Complete" or "Report Generated", auto-move to next stage.
        $testingStageIds = \App\Models\WorkflowStage::where('slug', 'lab-testing')
            ->orWhere('slug', 'report-generation')
            ->pluck('id');

        $readyJobs = Jobs::whereIn('current_stage_id', $testingStageIds)
            ->where('status', 'active')
            ->with(['workflowTemplate', 'currentStage'])
            ->get()
            ->filter(function ($job) {
                // Check if all reports linked to this UID are completed
                $reports = \App\Models\Report::where('uid_no', $job->uid_no)->get();
                if ($reports->isEmpty()) return false;

                $completedStatuses = ['Complete', 'Report Generated', 'Approved', 'Dispatched'];
                return $reports->every(fn ($r) => in_array($r->status, $completedStatuses));
            });

        foreach ($readyJobs as $job) {
            $nextTransitions = $engine->getAllowedTransitions($job);

            // Prefer a transition with "auto" in the name, or pick the first one
            $targetTransition = $nextTransitions->firstWhere('name', 'like', '%Auto%')
                ?? $nextTransitions->first();

            if (!$targetTransition) {
                $this->line("  [SKIP] {$job->uid_no} — no available transition");
                continue;
            }

            try {
                $engine->transition(
                    $job,
                    $targetTransition,
                    null,
                    'Auto-transition: all reports completed.'
                );

                // Notify assigned user
                if ($job->assigned_to) {
                    $stageName = $targetTransition->toStage?->name ?? 'next stage';
                    Notification::create([
                        'user_id' => $job->assigned_to,
                        'type' => 'auto_transition',
                        'title' => "Auto-Transition: {$job->uid_no}",
                        'message' => "Job {$job->uid_no} auto-moved to '{$stageName}' (all reports complete).",
                        'data' => json_encode([
                            'job_id' => $job->id,
                            'transition_id' => $targetTransition->id,
                        ]),
                    ]);
                }

                $this->line("  [AUTO] {$job->uid_no} → {$targetTransition->toStage?->name}");
                $count++;
            } catch (\Exception $e) {
                $this->error("  [FAIL] {$job->uid_no} — {$e->getMessage()}");
            }
        }

        $this->info("Auto-transitioned {$count} job(s).");
    }
}
