<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\WorkflowTemplate;
use App\Models\WorkflowStage;
use App\Models\WorkflowTransition;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class WorkflowTemplateController extends Controller
{
    public function index()
    {
        $templates = WorkflowTemplate::with('stages')->orderBy('name')->get();
        return response()->json($templates);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'is_active' => 'boolean',
        ]);

        $validated['created_by'] = $request->user()?->id;
        $validated['is_active'] = $validated['is_active'] ?? true;

        $template = WorkflowTemplate::create($validated);

        return response()->json($template->load('stages'), 201);
    }

    public function show(WorkflowTemplate $workflowTemplate)
    {
        return response()->json(
            $workflowTemplate->load(['stages', 'transitions.fromStage', 'transitions.toStage'])
        );
    }

    public function update(Request $request, WorkflowTemplate $workflowTemplate)
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'is_active' => 'boolean',
        ]);

        $workflowTemplate->update($validated);

        return response()->json($workflowTemplate->fresh()->load('stages'));
    }

    public function destroy(WorkflowTemplate $workflowTemplate)
    {
        $workflowTemplate->delete();
        return response()->json(null, 204);
    }

    public function seed()
    {
        \App\Services\WorkflowEngine::seedDefaultWorkflow();
        return response()->json(['message' => 'Default workflow seeded successfully']);
    }
}
