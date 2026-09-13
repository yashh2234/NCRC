<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\OutsourceAssignment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class OutsourceAssignmentController extends Controller
{
    public function index(Request $request)
    {
        $query = OutsourceAssignment::with(['workOrder', 'assignedByUser']);

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }
        if ($request->filled('work_order_id')) {
            $query->where('work_order_id', $request->work_order_id);
        }
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('party_name', 'like', "%{$search}%")
                  ->orWhere('party_contact', 'like', "%{$search}%");
            });
        }

        $assignments = $query->orderByDesc('id')->paginate($request->get('per_page', 25));
        return response()->json($assignments);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'work_order_id' => 'required|integer|exists:work_orders,id',
            'registration_id' => 'nullable|integer',
            'party_name' => 'required|string|max:222',
            'party_contact' => 'nullable|string|max:222',
            'party_email' => 'nullable|email|max:222',
            'scope_of_work' => 'nullable|string',
            'agreed_amount' => 'required|numeric|min:0',
            'advance_payment' => 'nullable|numeric|min:0',
            'notes' => 'nullable|string',
        ]);

        $validated['status'] = 'assigned';
        $validated['assigned_by'] = auth()->id();
        $validated['remaining_payment'] = ($validated['agreed_amount'] ?? 0) - ($validated['advance_payment'] ?? 0);

        $assignment = OutsourceAssignment::create($validated);

        return response()->json($assignment->load('workOrder'), 201);
    }

    public function show(OutsourceAssignment $outsourceAssignment)
    {
        return response()->json($outsourceAssignment->load(['workOrder', 'assignedByUser']));
    }

    public function update(Request $request, OutsourceAssignment $outsourceAssignment)
    {
        $validated = $request->validate([
            'party_name' => 'sometimes|string|max:222',
            'party_contact' => 'nullable|string|max:222',
            'party_email' => 'nullable|email|max:222',
            'scope_of_work' => 'nullable|string',
            'agreed_amount' => 'sometimes|numeric|min:0',
            'advance_payment' => 'nullable|numeric|min:0',
            'payment_status' => 'sometimes|in:pending,partial,paid',
            'payment_amount' => 'nullable|numeric|min:0',
            'payment_date' => 'nullable|date',
            'payment_reference' => 'nullable|string|max:222',
            'status' => 'sometimes|in:assigned,in_progress,completed,cancelled',
            'started_at' => 'nullable|date',
            'completed_at' => 'nullable|date',
            'completion_details' => 'nullable|string',
            'delivery_date' => 'nullable|date',
            'notes' => 'nullable|string',
        ]);

        if (isset($validated['agreed_amount']) || isset($validated['advance_payment'])) {
            $agreed = $validated['agreed_amount'] ?? $outsourceAssignment->agreed_amount;
            $advance = $validated['advance_payment'] ?? $outsourceAssignment->advance_payment;
            $validated['remaining_payment'] = $agreed - $advance;
        }

        if (isset($validated['status']) && $validated['status'] === 'in_progress' && !$outsourceAssignment->started_at) {
            $validated['started_at'] = now();
        }
        if (isset($validated['status']) && $validated['status'] === 'completed' && !$outsourceAssignment->completed_at) {
            $validated['completed_at'] = now();
        }

        $outsourceAssignment->update($validated);
        return response()->json($outsourceAssignment);
    }

    public function destroy(OutsourceAssignment $outsourceAssignment)
    {
        $outsourceAssignment->delete();
        return response()->json(['message' => 'Outsource assignment deleted']);
    }

    public function uploadVendorReport(Request $request, OutsourceAssignment $outsourceAssignment)
    {
        $validated = $request->validate([
            'vendor_report' => 'required|file|mimes:pdf,doc,docx,xlsx,xls,jpg,jpeg,png|max:20480',
        ]);

        $path = $request->file('vendor_report')->store('vendor-reports', 'public');

        $outsourceAssignment->update([
            'vendor_report' => $path,
            'status' => 'completed',
            'completed_at' => $outsourceAssignment->completed_at ?? now(),
        ]);

        return response()->json([
            'message' => 'Vendor report uploaded',
            'assignment' => $outsourceAssignment->fresh(),
        ]);
    }
}
