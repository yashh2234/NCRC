<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Jobs;
use App\Models\WorkOrder;
use App\Models\WorkflowTemplate;
use App\Models\WorkflowStage;
use App\Services\WorkflowEngine;
use Illuminate\Http\Request;

class WorkOrderController extends Controller
{
    protected WorkflowEngine $workflowEngine;

    public function __construct(WorkflowEngine $workflowEngine)
    {
        $this->workflowEngine = $workflowEngine;
    }

    public function index(Request $request)
    {
        $query = WorkOrder::with(['inquiry', 'quotation', 'registration', 'outsourceAssignments']);

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }
        if ($request->filled('assignment_type')) {
            $query->where('assignment_type', $request->assignment_type);
        }
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('work_order_no', 'like', "%{$search}%")
                  ->orWhere('client_name', 'like', "%{$search}%")
                  ->orWhere('agency_name', 'like', "%{$search}%");
            });
        }
        if ($request->filled('date_from')) {
            $query->where('created_at', '>=', $request->date_from);
        }
        if ($request->filled('date_to')) {
            $query->where('created_at', '<=', $request->date_to);
        }

        $workOrders = $query->orderByDesc('id')->paginate($request->get('per_page', 25));
        return response()->json($workOrders);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'inquiry_id' => 'nullable|integer',
            'quotation_id' => 'nullable|integer',
            'registration_id' => 'nullable|integer',
            'client_name' => 'required|string|max:222',
            'agency_name' => 'nullable|string|max:222',
            'contact_person' => 'nullable|string|max:222',
            'mobile_no' => 'nullable|string|max:50',
            'scope_of_work' => 'nullable|string',
            'terms_and_conditions' => 'nullable|string',
            'total_amount' => 'nullable|numeric|min:0',
            'advance_payment' => 'nullable|numeric|min:0',
            'payment_terms' => 'nullable|string|max:222',
            'assignment_type' => 'nullable|in:inhouse,outsource',
            'due_date' => 'nullable|date',
            'notes' => 'nullable|string',
        ]);

        $validated['work_order_no'] = WorkOrder::generateWorkOrderNo();
        $validated['balance_dues'] = ($validated['total_amount'] ?? 0) - ($validated['advance_payment'] ?? 0);
        $validated['status'] = 'active';
        $validated['created_by'] = auth()->id();

        $workOrder = WorkOrder::create($validated);

        // Create or update linked job at Work Order stage
        $this->syncJobFromWorkOrder($workOrder, $request);

        return response()->json($workOrder->load(['inquiry', 'quotation', 'registration']), 201);
    }

    public function show(WorkOrder $workOrder)
    {
        return response()->json($workOrder->load([
            'inquiry', 'quotation', 'registration', 'dispatches', 'outsourceAssignments',
        ]));
    }

    public function update(Request $request, WorkOrder $workOrder)
    {
        $validated = $request->validate([
            'client_name' => 'sometimes|string|max:222',
            'agency_name' => 'nullable|string|max:222',
            'contact_person' => 'nullable|string|max:222',
            'mobile_no' => 'nullable|string|max:50',
            'scope_of_work' => 'nullable|string',
            'terms_and_conditions' => 'nullable|string',
            'total_amount' => 'sometimes|numeric|min:0',
            'advance_payment' => 'sometimes|numeric|min:0',
            'payment_terms' => 'nullable|string|max:222',
            'status' => 'sometimes|in:draft,active,in_progress,completed,cancelled',
            'assignment_type' => 'nullable|in:inhouse,outsource',
            'due_date' => 'nullable|date',
            'notes' => 'nullable|string',
        ]);

        if (isset($validated['total_amount']) || isset($validated['advance_payment'])) {
            $total = $validated['total_amount'] ?? $workOrder->total_amount;
            $advance = $validated['advance_payment'] ?? $workOrder->advance_payment;
            $validated['balance_dues'] = $total - $advance;
        }

        $workOrder->update($validated);
        return response()->json($workOrder->load(['inquiry', 'quotation', 'registration']));
    }

    public function destroy(WorkOrder $workOrder)
    {
        $workOrder->delete();
        return response()->json(['message' => 'Work order deleted']);
    }

    public function printDiv(WorkOrder $workOrder)
    {
        return response()->json($workOrder->load(['inquiry', 'quotation', 'registration', 'outsourceAssignments']));
    }

    protected function syncJobFromWorkOrder(WorkOrder $workOrder, Request $request): void
    {
        $template = WorkflowTemplate::where('is_active', true)->first();
        if (!$template) return;

        $existingJob = Jobs::where('uid_no', $workOrder->work_order_no)->first();
        if ($existingJob) {
            // Update existing job
            $existingJob->update([
                'title' => $workOrder->client_name . ' - ' . ($workOrder->scope_of_work ?? ''),
                'due_at' => $workOrder->due_date,
                'priority' => 'normal',
            ]);

            // Move to Work Order stage if not already there
            $woStage = WorkflowStage::where('template_id', $template->id)
                ->where('slug', 'work-order')->first();
            if ($woStage && $existingJob->current_stage_id !== $woStage->id) {
                $transition = \App\Models\WorkflowTransition::where('template_id', $template->id)
                    ->where('from_stage_id', $existingJob->current_stage_id)
                    ->where('to_stage_id', $woStage->id)
                    ->first();
                if ($transition) {
                    $this->workflowEngine->transition($existingJob, $transition, auth()->user(), 'Work order created');
                }
            }
            return;
        }

        // Create new job
        $job = Jobs::create([
            'uid_no' => $workOrder->work_order_no,
            'title' => $workOrder->client_name . ($workOrder->scope_of_work ? ' - ' . $workOrder->scope_of_work : ''),
            'description' => $workOrder->notes,
            'priority' => 'normal',
            'workflow_template_id' => $template->id,
            'created_by' => auth()->id(),
            'due_at' => $workOrder->due_date,
            'status' => 'pending',
        ]);

        $this->workflowEngine->startJob($job, auth()->user());

        // Move to Work Order stage
        $woStage = WorkflowStage::where('template_id', $template->id)
            ->where('slug', 'work-order')->first();
        if ($woStage && $job->current_stage_id !== $woStage->id) {
            $transition = \App\Models\WorkflowTransition::where('template_id', $template->id)
                ->where('from_stage_id', $job->current_stage_id)
                ->where('to_stage_id', $woStage->id)
                ->first();
            if ($transition) {
                $this->workflowEngine->transition($job, $transition, auth()->user(), 'Work order created');
            }
        }
    }
}
