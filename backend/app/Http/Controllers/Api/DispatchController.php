<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Dispatch;
use App\Models\Jobs;
use App\Models\WorkOrder;
use App\Services\WorkflowBridge;
use Illuminate\Http\Request;

class DispatchController extends Controller
{
    protected WorkflowBridge $bridge;

    public function __construct(WorkflowBridge $bridge)
    {
        $this->bridge = $bridge;
    }

    public function index(Request $request)
    {
        $query = Dispatch::with(['workOrder', 'dispatchedByUser']);

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }
        if ($request->filled('work_order_id')) {
            $query->where('work_order_id', $request->work_order_id);
        }
        if ($request->filled('registration_id')) {
            $query->where('registration_id', $request->registration_id);
        }
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('tracking_number', 'like', "%{$search}%")
                  ->orWhere('recipient_name', 'like', "%{$search}%")
                  ->orWhere('courier_name', 'like', "%{$search}%");
            });
        }
        if ($request->filled('date_from')) {
            $query->where('dispatch_date', '>=', $request->date_from);
        }
        if ($request->filled('date_to')) {
            $query->where('dispatch_date', '<=', $request->date_to);
        }

        $dispatches = $query->orderByDesc('id')->paginate($request->get('per_page', 25));
        return response()->json($dispatches);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'report_id' => 'nullable|integer',
            'work_order_id' => 'nullable|integer',
            'registration_id' => 'nullable|integer',
            'uid_no' => 'nullable|string',
            'dispatch_date' => 'required|date',
            'dispatch_method' => 'required|in:courier,hand_delivery,email,post',
            'courier_name' => 'nullable|string|max:222',
            'tracking_number' => 'nullable|string|max:222',
            'recipient_name' => 'nullable|string|max:222',
            'recipient_address' => 'nullable|string',
            'notes' => 'nullable|string',
        ]);

        $validated['status'] = 'dispatched';
        $validated['dispatched_by'] = auth()->id();

        $dispatch = Dispatch::create($validated);

        // Advance workflow job to 'dispatch' stage (and potentially 'completed')
        $uidNo = $validated['uid_no'] ?? null;
        if ($uidNo) {
            $this->bridge->advanceToStage(
                $uidNo,
                'dispatch',
                $request->user(),
                "Dispatch created: {$validated['dispatch_method']}"
            );
        }

        return response()->json($dispatch->load('workOrder'), 201);
    }

    public function show(Dispatch $dispatch)
    {
        return response()->json($dispatch->load(['workOrder', 'dispatchedByUser']));
    }

    public function update(Request $request, Dispatch $dispatch)
    {
        $validated = $request->validate([
            'dispatch_date' => 'sometimes|date',
            'dispatch_method' => 'sometimes|in:courier,hand_delivery,email,post',
            'courier_name' => 'nullable|string|max:222',
            'tracking_number' => 'nullable|string|max:222',
            'recipient_name' => 'nullable|string|max:222',
            'recipient_address' => 'nullable|string',
            'received_by' => 'nullable|string|max:222',
            'received_at' => 'nullable|date',
            'status' => 'sometimes|in:pending,dispatched,delivered,returned',
            'notes' => 'nullable|string',
        ]);

        $dispatch->update($validated);

        // If delivered, advance workflow job to 'completed'
        if (($validated['status'] ?? null) === 'delivered') {
            $uidNo = $dispatch->registration?->uid_no
                ?? WorkOrder::where('id', $dispatch->work_order_id)->value('work_order_no')
                ?? null;
            if ($uidNo) {
                $this->bridge->advanceToStage(
                    $uidNo,
                    'completed',
                    $request->user(),
                    "Dispatch delivered — job completed"
                );
            }
        }

        return response()->json($dispatch);
    }

    public function jobDispatches(Jobs $job)
    {
        $workOrderIds = WorkOrder::where('work_order_no', $job->uid_no)->pluck('id');
        $registrationId = $job->registration?->id;

        $dispatches = Dispatch::with(['workOrder', 'dispatchedByUser'])
            ->where(function ($q) use ($workOrderIds, $registrationId) {
                $q->whereIn('work_order_id', $workOrderIds);
                if ($registrationId) {
                    $q->orWhere('registration_id', $registrationId);
                }
            })
            ->orderByDesc('id')
            ->get();

        return response()->json(['data' => $dispatches]);
    }

    public function destroy(Dispatch $dispatch)
    {
        $dispatch->delete();
        return response()->json(['message' => 'Dispatch deleted']);
    }
}
