<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Jobs;
use App\Models\Report;
use App\Models\TechnicalReview;
use App\Models\JobTimeline;
use App\Models\WorkflowStage;
use App\Models\WorkflowTransition;
use App\Models\Notification;
use App\Services\WorkflowEngine;
use Illuminate\Http\Request;

class ReportWorkflowController extends Controller
{
    protected WorkflowEngine $workflowEngine;

    public function __construct(WorkflowEngine $workflowEngine)
    {
        $this->workflowEngine = $workflowEngine;
    }

    /**
     * Get all reports linked to a job.
     */
    public function jobReports(Jobs $job)
    {
        $reports = Report::where('job_id', $job->id)
            ->orWhere('uid_no', $job->uid_no)
            ->orderByDesc('create_date')
            ->get()
            ->map(function ($r) {
                $obs = $r->material_details ? json_decode($r->material_details, true) : null;
                return [
                    'id' => $r->iReportId,
                    'uid_no' => $r->uid_no,
                    'type' => $r->report_type,
                    'status' => $r->status,
                    'workflow_status' => $r->status,
                    'created_at' => $r->create_date,
                    'assigned_to' => $r->assigned_to,
                    'approved_at' => $r->approved_at,
                    'observations' => $obs,
                ];
            });

        return response()->json(['data' => $reports]);
    }

    /**
     * Create a draft report for a job.
     */
    public function createDraft(Request $request, Jobs $job)
    {
        $validated = $request->validate([
            'report_type' => 'required|string',
            'sample_details' => 'nullable|string',
            'material_details' => 'nullable|string',
        ]);

        $existing = Report::where('job_id', $job->id)
            ->where('report_type', $validated['report_type'])
            ->where('status', 'Draft')
            ->first();

        if ($existing) {
            return response()->json(['message' => 'Draft already exists', 'report' => $existing], 200);
        }

        $report = Report::create([
            'uid_no' => $job->uid_no,
            'job_id' => $job->id,
            'report_type' => $validated['report_type'],
            'agency_name' => optional($job->client)->company_name ?? '',
            'customer_details' => optional($job->client)->company_name ?? '',
            'material_details' => $validated['material_details'] ?? '',
            'work_order_no' => $job->uid_no,
            'status' => 'Draft',
            'user_id' => $request->user()?->id,
            'created_by' => $request->user()?->id,
            'create_date' => now(),
        ]);

        JobTimeline::create([
            'job_id' => $job->id,
            'action' => 'Report Draft Created',
            'user_id' => $request->user()?->id,
            'notes' => "{$validated['report_type']} report draft created",
        ]);

        return response()->json($report, 201);
    }

    /**
     * Save observations/test data to a report.
     */
    public function saveObservations(Request $request, Report $report)
    {
        $validated = $request->validate([
            'observations' => 'required|array',
        ]);

        if ($report->status === 'Complete') {
            return response()->json(['message' => 'Cannot edit a locked report'], 422);
        }

        $report->update([
            'material_details' => json_encode($validated['observations']),
            'updated_date' => now(),
            'updated_by' => $request->user()?->id,
        ]);

        return response()->json(['message' => 'Observations saved']);
    }

    /**
     * Submit draft for technical review.
     */
    public function submitForReview(Request $request, Report $report)
    {
        if ($report->status !== 'Draft' && $report->status !== 'Corrections Requested') {
            return response()->json(['message' => 'Report must be in draft or corrections state'], 422);
        }

        $report->update([
            'status' => 'Under Review',
            'submitted_at' => now(),
            'updated_by' => $request->user()?->id,
        ]);

        // Move job to Technical Review stage
        $this->syncJobStage($report->job_id, 'technical-review', $request, 'Report submitted for review');

        TechnicalReview::create([
            'report_id' => $report->iReportId,
            'reviewer_id' => null,
            'remarks' => 'Submitted for technical review',
            'status' => 'pending',
        ]);

        return response()->json(['message' => 'Submitted for review', 'report' => $report->fresh()]);
    }

    /**
     * Approve report (technical review passes).
     */
    public function approve(Request $request, Report $report)
    {
        if ($report->status !== 'Under Review') {
            return response()->json(['message' => 'Report must be under review'], 422);
        }

        $report->update([
            'status' => 'Approved',
            'approved_at' => now(),
            'approved_by' => $request->user()?->id,
            'updated_by' => $request->user()?->id,
        ]);

        // Update technical review
        TechnicalReview::where('report_id', $report->iReportId)
            ->where('status', 'pending')
            ->latest()
            ->first()
            ?->update(['status' => 'approved', 'reviewer_id' => $request->user()?->id, 'reviewed_at' => now()]);

        // Move job to Approval stage
        $this->syncJobStage($report->job_id, 'approval', $request, 'Report approved');

        return response()->json(['message' => 'Report approved', 'report' => $report->fresh()]);
    }

    /**
     * Return report for corrections.
     */
    public function requestCorrection(Request $request, Report $report)
    {
        $validated = $request->validate(['remarks' => 'nullable|string|max:2000']);

        if ($report->status !== 'Under Review') {
            return response()->json(['message' => 'Report must be under review'], 422);
        }

        $report->update([
            'status' => 'Corrections Requested',
            'updated_by' => $request->user()?->id,
        ]);

        TechnicalReview::where('report_id', $report->iReportId)
            ->where('status', 'pending')
            ->latest()
            ->first()
            ?->update([
                'status' => 'returned_for_correction',
                'reviewer_id' => $request->user()?->id,
                'reviewed_at' => now(),
                'remarks' => $validated['remarks'] ?? 'Corrections requested',
            ]);

        // Move job back to Report Draft stage
        $this->syncJobStage($report->job_id, 'report-draft', $request, 'Report corrections requested');

        return response()->json(['message' => 'Corrections requested', 'report' => $report->fresh()]);
    }

    /**
     * Lock a report (final state - no more edits).
     */
    public function lock(Request $request, Report $report)
    {
        if ($report->status !== 'Approved') {
            return response()->json(['message' => 'Only approved reports can be locked'], 422);
        }

        $report->update([
            'status' => 'Complete',
            'locked_at' => now(),
            'locked_by' => $request->user()?->id,
            'updated_by' => $request->user()?->id,
        ]);

        JobTimeline::create([
            'job_id' => $report->job_id,
            'action' => 'Report Locked',
            'user_id' => $request->user()?->id,
            'notes' => "Report #{$report->iReportId} locked (final)",
        ]);

        return response()->json(['message' => 'Report locked', 'report' => $report->fresh()]);
    }

    /**
     * Get review history for a report.
     */
    public function reviewHistory(Report $report)
    {
        $reviews = TechnicalReview::where('report_id', $report->iReportId)
            ->with(['reviewer'])
            ->orderByDesc('created_at')
            ->get();

        return response()->json(['data' => $reviews]);
    }

    /**
     * Move the parent job to the matching workflow stage.
     */
    protected function syncJobStage(?int $jobId, string $stageSlug, Request $request, string $notes): void
    {
        if (!$jobId) return;

        $job = Jobs::find($jobId);
        if (!$job || !$job->workflow_template_id) return;

        $targetStage = WorkflowStage::where('template_id', $job->workflow_template_id)
            ->where('slug', $stageSlug)->first();
        if (!$targetStage || $targetStage->id === $job->current_stage_id) return;

        $transition = WorkflowTransition::where('template_id', $job->workflow_template_id)
            ->where('from_stage_id', $job->current_stage_id)
            ->where('to_stage_id', $targetStage->id)
            ->first();

        if ($transition) {
            try {
                $this->workflowEngine->transition($job, $transition, $request->user(), $notes);
            } catch (\Exception $e) {
                // If transition fails, just log timeline entry
                JobTimeline::create([
                    'job_id' => $job->id,
                    'action' => $notes,
                    'user_id' => $request->user()?->id,
                ]);
            }
        } else {
            // Direct stage update
            $job->update(['current_stage_id' => $targetStage->id]);
            JobTimeline::create([
                'job_id' => $job->id,
                'from_stage_id' => $job->getOriginal('current_stage_id'),
                'to_stage_id' => $targetStage->id,
                'action' => $notes,
                'user_id' => $request->user()?->id,
            ]);
        }
    }
}
