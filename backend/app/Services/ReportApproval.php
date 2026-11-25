<?php

namespace App\Services;

use App\Http\Controllers\Api\NotificationController;
use App\Models\Report;
use App\Models\User;
use App\Models\UserActivity;

/**
 * An approved lab report that a user without "Approve Reports" changes needs approval again: it goes back to
 * Report Generated, so it leaves Final Reports, prints as DRAFT and its QR page stops until it is approved.
 */
class ReportApproval
{
    /** What the report prints from its own row; empty boxes and the format key do not count */
    public static function content(Report $report): array
    {
        $core = [];
        foreach (['reference_no', 'work_order_no', 'source_location', 'customer_details', 'material_details', 'environment_condition',
            'sampled_by', 'sample_date', 'sample_tested_date', 'dispatch_date'] as $key) {
            $value = trim(str_replace("\r\n", "\n", (string) $report->{$key}));
            $core[$key] = str_starts_with($value, '0000') ? '' : $value;
        }
        $lab = [];
        foreach ($report->lab_data ?? [] as $key => $value) {
            $value = is_scalar($value) ? trim((string) $value) : '';
            if ($key !== '_template' && $value !== '') {
                $lab[$key] = $value;
            }
        }
        ksort($lab);

        return $core + ['lab' => $lab];
    }

    /** Back to waiting when a non-approver changed an approved report */
    public static function changed(Report $report, User $user): bool
    {
        if ($report->status !== 'Complete' || $user->canApproveReports()) {
            return false;
        }
        $report->update([
            'status' => 'Report Generated', 'report_generated_at' => now(), 'approved_at' => null, 'approved_by' => null,
            'updated_date' => now(), 'updated_by' => $user->id,
        ]);
        UserActivity::query()->create([
            'user_id' => $user->id, 'action' => 'report_needs_approval', 'module' => 'reports',
            'details' => "Changed approved report {$report->uid_no}: needs approval again", 'ip_address' => request()->ip(), 'created_at' => now(),
        ]);
        self::notify($report, 'Changed report to approve', "Report {$report->uid_no} was approved and has now been changed by {$user->name}.", $user);

        return true;
    }

    public static function notify(Report $report, string $title, string $message, ?User $by = null): void
    {
        foreach (User::query()->get()->filter(fn (User $u) => $u->is_active !== false && $u->canApproveReports()) as $approver) {
            if ($by && $approver->id === $by->id) {
                continue;
            }
            NotificationController::create($approver->id, 'approval_needed', $title, $message, ['report_id' => $report->iReportId, 'uid_no' => $report->uid_no]);
        }
    }
}
