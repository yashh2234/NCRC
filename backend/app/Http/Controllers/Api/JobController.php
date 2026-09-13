<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Jobs;
use App\Models\WorkflowStage;
use App\Models\WorkflowTransition;
use App\Services\WorkflowEngine;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class JobController extends Controller
{
    protected WorkflowEngine $workflowEngine;

    public function __construct(WorkflowEngine $workflowEngine)
    {
        $this->workflowEngine = $workflowEngine;
    }

    public function index(Request $request)
    {
        $query = Jobs::with([
            'currentStage',
            'workflowTemplate',
            'assignedUser',
            'activeStageTracking',
        ]);

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }
        if ($request->filled('priority')) {
            $query->where('priority', $request->priority);
        }
        if ($request->filled('workflow_template_id')) {
            $query->where('workflow_template_id', $request->workflow_template_id);
        }
        if ($request->filled('current_stage_id')) {
            $query->where('current_stage_id', $request->current_stage_id);
        }
        if ($request->filled('assigned_to')) {
            $query->where('assigned_to', $request->assigned_to);
        }
        if ($request->filled('search')) {
            $s = $request->search;
            $query->where(function ($q) use ($s) {
                $q->where('uid_no', 'like', "%{$s}%")
                  ->orWhere('title', 'like', "%{$s}%");
            });
        }

        $query->orderBy('created_at', 'desc');

        $perPage = $request->input('per_page', 20);
        $jobs = $query->paginate($perPage);

        return response()->json($jobs);
    }

    public function show(Jobs $job)
    {
        return response()->json(
            $job->load([
                'currentStage',
                'workflowTemplate.stages',
                'assignedUser',
                'client',
                'samples',
                'assignments.department',
                'assignments.assignedUser',
                'assignments.vendor',
                'timeline.user',
                'timeline.fromStage',
                'timeline.toStage',
                'activeStageTracking.stage',
                'stageTracking.stage',
            ])
        );
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'uid_no' => 'required|string|max:255|unique:jobs,uid_no',
            'title' => 'nullable|string|max:255',
            'description' => 'nullable|string',
            'priority' => 'string|in:low,normal,high,urgent',
            'workflow_template_id' => 'nullable|integer|exists:workflow_templates,id',
            'client_id' => 'nullable|integer',
            'assigned_to' => 'nullable|integer|exists:users,id',
            'due_at' => 'nullable|date',
        ]);

        $validated['created_by'] = $request->user()?->id;
        $validated['status'] = 'pending';

        $job = Jobs::create($validated);

        if ($job->workflow_template_id) {
            $this->workflowEngine->startJob($job, $request->user());
        }

        return response()->json($job->load(['currentStage', 'workflowTemplate']), 201);
    }

    public function update(Request $request, Jobs $job)
    {
        $validated = $request->validate([
            'title' => 'nullable|string|max:255',
            'description' => 'nullable|string',
            'priority' => 'string|in:low,normal,high,urgent',
            'client_id' => 'nullable|integer',
            'assigned_to' => 'nullable|integer|exists:users,id',
            'due_at' => 'nullable|date',
        ]);

        $validated['updated_by'] = $request->user()?->id;

        $job->update($validated);

        return response()->json($job->fresh()->load(['currentStage', 'workflowTemplate']));
    }

    public function destroy(Jobs $job)
    {
        $job->delete();
        return response()->json(null, 204);
    }

    /**
     * Transition a job to the next stage.
     */
    public function transition(Request $request, Jobs $job)
    {
        $validated = $request->validate([
            'transition_id' => 'required|integer|exists:workflow_transitions,id',
            'notes' => 'nullable|string|max:1000',
        ]);

        $transition = WorkflowTransition::with(['fromStage', 'toStage'])
            ->findOrFail($validated['transition_id']);

        $user = $request->user();
        $targetStage = $transition->toStage;

        if ($targetStage->assigned_role_id && !$user->is_admin && !$user->isLegacyAdmin()) {
            $userGroupIds = $user->groups()->pluck('group_id')->toArray();
            if (!in_array((int) $targetStage->assigned_role_id, $userGroupIds, true)) {
                return response()->json([
                    'message' => "You do not have the required role to move this job to {$targetStage->name}.",
                ], 403);
            }
        }

        $job = $this->workflowEngine->transition(
            $job,
            $transition,
            $user,
            $validated['notes'] ?? ''
        );

        return response()->json([
            'message' => "Job transitioned to: {$transition->toStage->name}",
            'job' => $job->load(['currentStage', 'timeline.user', 'timeline.fromStage', 'timeline.toStage']),
        ]);
    }

    /**
     * Get allowed transitions for a job.
     */
    public function allowedTransitions(Jobs $job)
    {
        $transitions = $this->workflowEngine->getAllowedTransitions($job);
        return response()->json($transitions);
    }

    /**
     * Return job to a previous stage.
     */
    public function returnToStage(Request $request, Jobs $job)
    {
        $validated = $request->validate([
            'stage_id' => 'required|integer|exists:workflow_stages,id',
            'notes' => 'nullable|string|max:1000',
        ]);

        $stage = \App\Models\WorkflowStage::findOrFail($validated['stage_id']);

        $job = $this->workflowEngine->returnToStage(
            $job,
            $stage,
            $request->user(),
            $validated['notes'] ?? ''
        );

        return response()->json([
            'message' => "Job returned to: {$stage->name}",
            'job' => $job->fresh()->load(['currentStage', 'timeline.user', 'timeline.fromStage', 'timeline.toStage']),
        ]);
    }

    /**
     * Assign job to user.
     */
    public function assign(Request $request, Jobs $job)
    {
        $validated = $request->validate([
            'user_id' => 'required|integer|exists:users,id',
        ]);

        $job = $this->workflowEngine->assignJob($job, $validated['user_id'], $request->user());

        return response()->json([
            'message' => 'Job assigned successfully',
            'job' => $job->load('assignedUser'),
        ]);
    }

    /**
     * Cancel a job.
     */
    public function cancel(Request $request, Jobs $job)
    {
        $validated = $request->validate([
            'reason' => 'nullable|string|max:1000',
        ]);

        $job = $this->workflowEngine->cancelJob($job, $request->user(), $validated['reason'] ?? '');

        return response()->json([
            'message' => 'Job cancelled',
            'job' => $job->fresh(),
        ]);
    }

    /**
     * Get job timeline.
     */
    public function timeline(Jobs $job)
    {
        $timeline = $job->timeline()
            ->with(['user', 'fromStage', 'toStage'])
            ->get();

        return response()->json($timeline);
    }

    /**
     * Get SLA summary for all active jobs.
     */
    public function slaSummary()
    {
        $overdue = $this->workflowEngine->checkSlaStatus();

        $stats = [
            'total_active' => Jobs::where('status', 'active')->count(),
            'overdue_count' => count($overdue),
            'on_track' => Jobs::where('status', 'active')->count() - count($overdue),
            'overdue_jobs' => $overdue,
        ];

        return response()->json($stats);
    }

    /**
     * Link existing registration to a job.
     */
    public function linkRegistration(Request $request)
    {
        $validated = $request->validate([
            'uid_no' => 'required|string|exists:client_registration,uid_no',
        ]);

        $existingJob = Jobs::where('uid_no', $validated['uid_no'])->first();
        if ($existingJob) {
            return response()->json([
                'message' => 'Job already exists for this UID',
                'job' => $existingJob->load(['currentStage', 'workflowTemplate']),
            ]);
        }

        $registration = \App\Models\Registration::where('uid_no', $validated['uid_no'])->firstOrFail();

        $template = WorkflowTemplate::where('is_active', true)->first();

        $job = Jobs::create([
            'uid_no' => $registration->uid_no,
            'title' => $registration->name_of_work ?: "Job {$registration->uid_no}",
            'workflow_template_id' => $template?->id,
            'status' => 'pending',
            'client_id' => $registration->id,
            'created_by' => $request->user()?->id,
        ]);

        if ($template) {
            $this->workflowEngine->startJob($job, $request->user());
        }

        return response()->json($job->load(['currentStage', 'workflowTemplate']), 201);
    }
}
