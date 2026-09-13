<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\JobAssignment;
use App\Models\Jobs;
use App\Models\JobTimeline;
use Illuminate\Http\Request;

class JobAssignmentController extends Controller
{
    public function index(Request $request, Jobs $job)
    {
        return response()->json(
            $job->assignments()->with(['department', 'assignedUser', 'vendor'])->latest()->get()
        );
    }

    public function store(Request $request, Jobs $job)
    {
        $validated = $request->validate([
            'department_id' => 'nullable|integer|exists:departments,id',
            'assigned_to' => 'nullable|integer|exists:users,id',
            'assignment_type' => 'required|in:internal,outsource',
            'vendor_id' => 'nullable|integer|exists:vendors,id',
            'priority' => 'string|in:low,normal,high,urgent',
            'due_date' => 'nullable|date',
            'notes' => 'nullable|string|max:2000',
        ]);

        $validated['job_id'] = $job->id;
        $validated['assigned_by'] = $request->user()?->id;
        $validated['status'] = 'pending';

        $assignment = JobAssignment::create($validated);

        JobTimeline::create([
            'job_id' => $job->id,
            'action' => 'Assignment Created',
            'user_id' => $request->user()?->id,
            'notes' => "Assigned to " . ($assignment->assignedUser?->name ?? 'Unassigned') . " ({$assignment->assignment_type})",
        ]);

        return response()->json($assignment->load(['department', 'assignedUser', 'vendor']), 201);
    }

    public function show(JobAssignment $jobAssignment)
    {
        return response()->json($jobAssignment->load(['department', 'assignedUser', 'vendor', 'job']));
    }

    public function update(Request $request, JobAssignment $jobAssignment)
    {
        $validated = $request->validate([
            'department_id' => 'nullable|integer|exists:departments,id',
            'assigned_to' => 'nullable|integer|exists:users,id',
            'assignment_type' => 'in:internal,outsource',
            'vendor_id' => 'nullable|integer|exists:vendors,id',
            'priority' => 'string|in:low,normal,high,urgent',
            'due_date' => 'nullable|date',
            'status' => 'in:pending,in_progress,completed,cancelled',
            'notes' => 'nullable|string|max:2000',
        ]);

        $jobAssignment->update($validated);

        if ($request->filled('status') && $request->status === 'in_progress' && !$jobAssignment->started_at) {
            $jobAssignment->update(['started_at' => now()]);
        }

        if ($request->filled('status') && $request->status === 'completed' && !$jobAssignment->completed_at) {
            $jobAssignment->update(['completed_at' => now()]);
        }

        JobTimeline::create([
            'job_id' => $jobAssignment->job_id,
            'action' => "Assignment status: {$jobAssignment->status}",
            'user_id' => $request->user()?->id,
            'notes' => $validated['notes'] ?? 'Assignment updated',
        ]);

        return response()->json($jobAssignment->fresh()->load(['department', 'assignedUser', 'vendor']));
    }

    public function destroy(JobAssignment $jobAssignment)
    {
        $jobAssignment->delete();
        return response()->json(null, 204);
    }
}
