<?php

namespace App\Console\Commands;

use App\Models\JobStageTracking;
use App\Models\Jobs;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Console\Command;

class CheckSlaCommand extends Command
{
    protected $signature = 'jobs:check-sla';
    protected $description = 'Check all active job stages for SLA breaches and update overdue status';

    public function handle(): void
    {
        $overdueTrackings = JobStageTracking::whereNull('exited_at')
            ->whereNotNull('sla_deadline')
            ->where('sla_deadline', '<', now())
            ->where('is_overdue', false)
            ->with(['job.currentStage', 'job.assignedUser', 'stage'])
            ->get();

        if ($overdueTrackings->isEmpty()) {
            $this->info('No new SLA breaches found.');
            return;
        }

        $count = 0;
        foreach ($overdueTrackings as $tracking) {
            $overdueMinutes = (int) now()->diffInMinutes($tracking->sla_deadline, false);

            $tracking->update([
                'is_overdue' => true,
                'overdue_minutes' => max(0, $overdueMinutes),
            ]);

            $job = $tracking->job;
            if (!$job) continue;

            $stageName = $tracking->stage?->name ?? 'Unknown';
            $hoursOverdue = number_format(max(0, $overdueMinutes) / 60, 1);

            // Notify assigned user
            if ($job->assigned_to) {
                Notification::create([
                    'user_id' => $job->assigned_to,
                    'type' => 'sla_breach',
                    'title' => "SLA Breach: {$job->uid_no}",
                    'message' => "Job {$job->uid_no} exceeded SLA for stage '{$stageName}' by {$hoursOverdue}h.",
                    'data' => json_encode([
                        'job_id' => $job->id,
                        'stage_id' => $tracking->stage_id,
                        'overdue_minutes' => $overdueMinutes,
                    ]),
                ]);
            }

            // Notify all admin users
            $admins = User::where('is_admin', true)->where('id', '!=', $job->assigned_to)->get();
            foreach ($admins as $admin) {
                Notification::create([
                    'user_id' => $admin->id,
                    'type' => 'sla_breach_admin',
                    'title' => "SLA Alert: {$job->uid_no}",
                    'message' => "Job {$job->uid_no} exceeded SLA for stage '{$stageName}' by {$hoursOverdue}h.",
                    'data' => json_encode([
                        'job_id' => $job->id,
                        'stage_id' => $tracking->stage_id,
                        'overdue_minutes' => $overdueMinutes,
                    ]),
                ]);
            }

            $this->line("  [BREACH] {$job->uid_no} - {$stageName} - {$hoursOverdue}h overdue");
            $count++;
        }

        $this->info("Marked {$count} stage(s) as overdue and sent notifications.");
    }
}
