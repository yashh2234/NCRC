<?php

namespace App\Console\Commands;

use App\Models\JobStageTracking;
use App\Models\Jobs;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Console\Command;

class SendRemindersCommand extends Command
{
    protected $signature = 'jobs:send-reminders';
    protected $description = 'Send deadline reminders for jobs approaching SLA limits or due dates';

    public function handle(): void
    {
        $sent = 0;

        // 1. SLA approaching deadline (within 25% of total SLA time remaining)
        $approachingSla = JobStageTracking::whereNull('exited_at')
            ->whereNotNull('sla_deadline')
            ->where('sla_deadline', '>', now())
            ->where('is_overdue', false)
            ->with(['job', 'stage'])
            ->get()
            ->filter(function ($tracking) {
                $slaHours = $tracking->stage?->sla_hours;
                if (!$slaHours || $slaHours <= 0) return false;

                $totalSeconds = $slaHours * 3600;
                $remainingSeconds = max(0, $tracking->sla_deadline->diffInSeconds(now(), false));
                $ratio = $remainingSeconds / $totalSeconds;

                // Alert at 75% consumed (25% remaining) and 90% consumed (10% remaining)
                return $ratio <= 0.25 || $ratio <= 0.10;
            });

        foreach ($approachingSla as $tracking) {
            $job = $tracking->job;
            if (!$job) continue;

            $remaining = max(0, now()->diffInHours($tracking->sla_deadline, false));
            $stageName = $tracking->stage?->name ?? 'Unknown';

            $alreadyNotified = Notification::where('type', 'sla_reminder')
                ->where('created_at', '>', now()->subHours(6))
                ->where('data', 'like', "%\"job_id\":{$job->id}%")
                ->where('data', 'like', "%\"stage_id\":{$tracking->stage_id}%")
                ->exists();

            if ($alreadyNotified) continue;

            if ($job->assigned_to) {
                Notification::create([
                    'user_id' => $job->assigned_to,
                    'type' => 'sla_reminder',
                    'title' => "SLA Reminder: {$job->uid_no}",
                    'message' => "Job {$job->uid_no} at stage '{$stageName}' — {$remaining}h remaining before deadline.",
                    'data' => json_encode([
                        'job_id' => $job->id,
                        'stage_id' => $tracking->stage_id,
                        'remaining_hours' => $remaining,
                    ]),
                ]);
                $sent++;
                $this->line("  [REMINDER] {$job->uid_no} - {$stageName} - {$remaining}h left");
            }
        }

        // 2. Jobs past due_at date
        $overdueJobs = Jobs::whereNotNull('due_at')
            ->where('due_at', '<', now())
            ->whereIn('status', ['active', 'pending'])
            ->whereDoesntHave('timeline', function ($q) {
                $q->where('action', 'Due-date alert sent');
            })
            ->with('assignedUser')
            ->get();

        foreach ($overdueJobs as $job) {
            if ($job->assigned_to) {
                Notification::create([
                    'user_id' => $job->assigned_to,
                    'type' => 'due_date_overdue',
                    'title' => "Due Date Passed: {$job->uid_no}",
                    'message' => "Job {$job->uid_no} was due on {$job->due_at->format('d M Y')}.",
                    'data' => json_encode(['job_id' => $job->id]),
                ]);

                \App\Models\JobTimeline::create([
                    'job_id' => $job->id,
                    'action' => 'Due-date alert sent',
                    'user_id' => null,
                    'notes' => 'Automated reminder: due date has passed.',
                ]);
                $sent++;
            }
        }

        if ($sent === 0) {
            $this->info('No reminders needed at this time.');
        } else {
            $this->info("Sent {$sent} reminder(s).");
        }
    }
}
