<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\WorkflowTransition;
use App\Models\WorkflowTemplate;
use Illuminate\Http\Request;

class WorkflowTransitionController extends Controller
{
    public function index(WorkflowTemplate $workflowTemplate)
    {
        $transitions = $workflowTemplate->transitions()
            ->with(['fromStage', 'toStage'])
            ->orderBy('from_stage_id')
            ->get();
        return response()->json($transitions);
    }

    public function store(Request $request, WorkflowTemplate $workflowTemplate)
    {
        $validated = $request->validate([
            'from_stage_id' => 'required|integer|exists:workflow_stages,id',
            'to_stage_id' => 'required|integer|exists:workflow_stages,id',
            'name' => 'required|string|max:255',
            'permission_name' => 'nullable|string|max:255',
            'requires_approval' => 'boolean',
        ]);

        $validated['template_id'] = $workflowTemplate->id;

        $exists = WorkflowTransition::where('template_id', $workflowTemplate->id)
            ->where('from_stage_id', $validated['from_stage_id'])
            ->where('to_stage_id', $validated['to_stage_id'])
            ->exists();

        if ($exists) {
            return response()->json(['message' => 'This transition already exists.'], 409);
        }

        $transition = WorkflowTransition::create($validated);

        return response()->json(
            $transition->load(['fromStage', 'toStage']),
            201
        );
    }

    public function show(WorkflowTransition $workflowTransition)
    {
        return response()->json($workflowTransition->load(['fromStage', 'toStage', 'template']));
    }

    public function update(Request $request, WorkflowTransition $workflowTransition)
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'permission_name' => 'nullable|string|max:255',
            'requires_approval' => 'boolean',
        ]);

        $workflowTransition->update($validated);

        return response()->json($workflowTransition->fresh()->load(['fromStage', 'toStage']));
    }

    public function destroy(WorkflowTransition $workflowTransition)
    {
        $workflowTransition->delete();
        return response()->json(null, 204);
    }
}
