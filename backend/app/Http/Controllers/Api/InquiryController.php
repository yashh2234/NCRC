<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Inquiry;
use App\Models\Jobs;
use App\Models\WorkflowTemplate;
use App\Models\WorkflowStage;
use App\Services\WorkflowEngine;
use Illuminate\Http\Request;

class InquiryController extends Controller
{
    protected WorkflowEngine $workflowEngine;

    public function __construct(WorkflowEngine $workflowEngine)
    {
        $this->workflowEngine = $workflowEngine;
    }

    public function index(Request $request)
    {
        $query = Inquiry::with(['assignedUser', 'createdByUser']);

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }
        if ($request->filled('inquiry_type')) {
            $query->where('inquiry_type', $request->inquiry_type);
        }
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('inquiry_no', 'like', "%{$search}%")
                  ->orWhere('client_name', 'like', "%{$search}%")
                  ->orWhere('agency_name', 'like', "%{$search}%")
                  ->orWhere('contact_person', 'like', "%{$search}%")
                  ->orWhere('mobile_no', 'like', "%{$search}%");
            });
        }
        if ($request->filled('date_from')) {
            $query->where('received_date', '>=', $request->date_from);
        }
        if ($request->filled('date_to')) {
            $query->where('received_date', '<=', $request->date_to);
        }

        $inquiries = $query->orderByDesc('id')->paginate($request->get('per_page', 25));
        return response()->json($inquiries);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'client_name' => 'required|string|max:222',
            'agency_name' => 'nullable|string|max:222',
            'contact_person' => 'nullable|string|max:222',
            'mobile_no' => 'nullable|string|max:50',
            'email' => 'nullable|email|max:222',
            'inquiry_type' => 'required|in:letter,email,phone,walk_in,reference',
            'scope_of_work' => 'nullable|string',
            'source_location' => 'nullable|string|max:222',
            'priority' => 'required|in:low,normal,high,urgent',
            'notes' => 'nullable|string',
            'received_date' => 'required|date',
            'assigned_to' => 'nullable|integer',
        ]);

        $validated['inquiry_no'] = Inquiry::generateInquiryNo();
        $validated['status'] = 'new';
        $validated['created_by'] = auth()->id();

        $inquiry = Inquiry::create($validated);

        // Create a linked job at Inquiry stage
        $this->createJobFromInquiry($inquiry, $request);

        return response()->json($inquiry->load(['assignedUser', 'createdByUser']), 201);
    }

    public function show(Inquiry $inquiry)
    {
        return response()->json($inquiry->load([
            'quotations', 'workOrders', 'assignedUser', 'createdByUser',
        ]));
    }

    public function update(Request $request, Inquiry $inquiry)
    {
        $validated = $request->validate([
            'client_name' => 'sometimes|string|max:222',
            'agency_name' => 'nullable|string|max:222',
            'contact_person' => 'nullable|string|max:222',
            'mobile_no' => 'nullable|string|max:50',
            'email' => 'nullable|email|max:222',
            'inquiry_type' => 'sometimes|in:letter,email,phone,walk_in,reference',
            'scope_of_work' => 'nullable|string',
            'source_location' => 'nullable|string|max:222',
            'priority' => 'sometimes|in:low,normal,high,urgent',
            'status' => 'sometimes|in:new,contacted,quoted,converted,cancelled',
            'notes' => 'nullable|string',
            'received_date' => 'sometimes|date',
            'contacted_at' => 'nullable|date',
            'assigned_to' => 'nullable|integer',
        ]);

        $inquiry->update($validated);

        return response()->json($inquiry->load(['assignedUser', 'createdByUser']));
    }

    public function destroy(Inquiry $inquiry)
    {
        $inquiry->delete();
        return response()->json(['message' => 'Inquiry deleted']);
    }

    public function convertToQuotation(Inquiry $inquiry)
    {
        $inquiry->update(['status' => 'quoted']);

        // Move linked job to Quotation stage
        $job = Jobs::where('uid_no', $inquiry->inquiry_no)->first();
        if ($job) {
            $quotationStage = WorkflowStage::whereHas('template', fn ($q) => $q->where('slug', 'standard-lab-workflow'))
                ->where('slug', 'quotation')->first();
            if ($quotationStage && $quotationStage->id !== $job->current_stage_id) {
                $transition = \App\Models\WorkflowTransition::where('template_id', $job->workflow_template_id)
                    ->where('from_stage_id', $job->current_stage_id)
                    ->where('to_stage_id', $quotationStage->id)
                    ->first();
                if ($transition) {
                    $this->workflowEngine->transition($job, $transition, auth()->user(), 'Converted from inquiry');
                }
            }
        }

        return response()->json($inquiry->fresh());
    }

    protected function createJobFromInquiry(Inquiry $inquiry, Request $request): void
    {
        $template = WorkflowTemplate::where('is_active', true)->first();
        if (!$template) return;

        $existingJob = Jobs::where('uid_no', $inquiry->inquiry_no)->first();
        if ($existingJob) return;

        $job = Jobs::create([
            'uid_no' => $inquiry->inquiry_no,
            'title' => $inquiry->client_name . ($inquiry->scope_of_work ? ' - ' . $inquiry->scope_of_work : ''),
            'description' => $inquiry->notes,
            'priority' => $inquiry->priority,
            'workflow_template_id' => $template->id,
            'assigned_to' => $inquiry->assigned_to,
            'created_by' => auth()->id(),
            'status' => 'pending',
        ]);

        // Move through stages to reach Inquiry
        $inquiryStage = WorkflowStage::where('template_id', $template->id)
            ->where('slug', 'inquiry')->first();
        if ($inquiryStage) {
            $this->workflowEngine->startJob($job, auth()->user());

            if ($job->current_stage_id !== $inquiryStage->id) {
                $transition = \App\Models\WorkflowTransition::where('template_id', $template->id)
                    ->where('from_stage_id', $job->current_stage_id)
                    ->where('to_stage_id', $inquiryStage->id)
                    ->first();
                if ($transition) {
                    $this->workflowEngine->transition($job, $transition, auth()->user(), 'Inquiry created');
                }
            }
        }
    }
}
