<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\WorkflowStage;
use App\Models\WorkflowTemplate;
use Illuminate\Http\Request;

class WorkflowStageController extends Controller
{
    public function index(WorkflowTemplate $workflowTemplate)
    {
        $stages = $workflowTemplate->stages()->orderBy('sort_order')->get();
        return response()->json($stages);
    }

    public function store(Request $request, WorkflowTemplate $workflowTemplate)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'slug' => 'required|string|max:255',
            'sort_order' => 'integer|min:0',
            'assigned_role_id' => 'nullable|integer|exists:groups,id',
            'sla_hours' => 'nullable|numeric|min:0',
            'is_start' => 'boolean',
            'is_end' => 'boolean',
            'color' => 'nullable|string|max:7',
        ]);

        $validated['template_id'] = $workflowTemplate->id;

        if ($validated['is_start'] ?? false) {
            $workflowTemplate->stages()->where('is_start', true)->update(['is_start' => false]);
        }
        if ($validated['is_end'] ?? false) {
            $workflowTemplate->stages()->where('is_end', true)->update(['is_end' => false]);
        }

        $stage = WorkflowStage::create($validated);

        return response()->json($stage, 201);
    }

    public function show(WorkflowStage $workflowStage)
    {
        return response()->json($workflowStage->load('template'));
    }

    public function update(Request $request, WorkflowStage $workflowStage)
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'slug' => 'sometimes|string|max:255',
            'sort_order' => 'integer|min:0',
            'assigned_role_id' => 'nullable|integer|exists:groups,id',
            'sla_hours' => 'nullable|numeric|min:0',
            'is_start' => 'boolean',
            'is_end' => 'boolean',
            'color' => 'nullable|string|max:7',
        ]);

        if (($validated['is_start'] ?? false) && !$workflowStage->is_start) {
            WorkflowStage::where('template_id', $workflowStage->template_id)
                ->where('is_start', true)
                ->update(['is_start' => false]);
        }
        if (($validated['is_end'] ?? false) && !$workflowStage->is_end) {
            WorkflowStage::where('template_id', $workflowStage->template_id)
                ->where('is_end', true)
                ->update(['is_end' => false]);
        }

        $workflowStage->update($validated);

        return response()->json($workflowStage->fresh());
    }

    public function destroy(WorkflowStage $workflowStage)
    {
        WorkflowTransition::where('template_id', $workflowStage->template_id)
            ->where(function ($q) use ($workflowStage) {
                $q->where('from_stage_id', $workflowStage->id)
                  ->orWhere('to_stage_id', $workflowStage->id);
            })
            ->delete();

        $workflowStage->delete();
        return response()->json(null, 204);
    }
}
