<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Inquiry;
use App\Models\InquiryActivity;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Inquiry menu: client leads that are called, followed up and handed over between users.
 * Every status change / handover is written to inquiry_activities as the call log.
 */
class InquiryController extends Controller
{
    public function index(): JsonResponse
    {
        $inquiries = Inquiry::with(['assignedUser', 'createdByUser'])
            ->orderByDesc('id')
            ->get()
            ->map(fn (Inquiry $inquiry): array => $this->present($inquiry));

        return response()->json(['data' => $inquiries]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $this->validateInquiry($request);

        $inquiry = Inquiry::create([
            ...$this->toColumns($validated),
            'inquiry_no' => Inquiry::generateInquiryNo(),
            'status' => $validated['status'] ?? 'new',
            'inquiry_type' => 'phone',
            'priority' => 'normal',
            'received_date' => now()->toDateString(),
            'created_by' => auth()->id(),
        ]);

        $this->log($inquiry, [
            'status' => $inquiry->status,
            'assigned_to' => $inquiry->assigned_to,
            'next_follow_up' => $inquiry->next_follow_up,
            'remark' => 'Inquiry created',
        ]);
        $this->notifyHandover($inquiry);

        return response()->json(['data' => $this->present($inquiry->load(['assignedUser', 'createdByUser']))], 201);
    }

    public function show(Inquiry $inquiry): JsonResponse
    {
        $inquiry->load(['assignedUser', 'createdByUser', 'activities.user', 'activities.assignedUser']);

        return response()->json(['data' => $this->present($inquiry, true)]);
    }

    public function update(Request $request, Inquiry $inquiry): JsonResponse
    {
        $validated = $this->validateInquiry($request);
        $before = $inquiry->only(['status', 'assigned_to']);

        $inquiry->update($this->toColumns($validated) + (isset($validated['status']) ? ['status' => $validated['status']] : []));

        $statusChanged = $before['status'] !== $inquiry->status;
        $handedOver = (int) $before['assigned_to'] !== (int) $inquiry->assigned_to;
        if ($statusChanged || $handedOver) {
            $this->log($inquiry, [
                'status' => $statusChanged ? $inquiry->status : null,
                'assigned_to' => $handedOver ? $inquiry->assigned_to : null,
                'remark' => 'Details edited',
            ]);
        }
        if ($handedOver) {
            $this->notifyHandover($inquiry);
        }

        return response()->json(['data' => $this->present($inquiry->load(['assignedUser', 'createdByUser']))]);
    }

    /** Log a call: new status, remark, next follow-up date and optional handover in one step. */
    public function logActivity(Request $request, Inquiry $inquiry): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['required', Rule::in(Inquiry::STATUSES)],
            'remark' => 'nullable|string|max:2000',
            'next_follow_up' => 'nullable|date',
            'assigned_to' => 'nullable|integer|exists:users,id',
        ]);

        $handedOver = array_key_exists('assigned_to', $validated)
            && (int) $validated['assigned_to'] !== (int) $inquiry->assigned_to;

        $inquiry->update([
            'status' => $validated['status'],
            'next_follow_up' => $validated['next_follow_up'] ?? null,
            'contacted_at' => $validated['status'] === 'new' ? $inquiry->contacted_at : now(),
            ...($handedOver ? ['assigned_to' => $validated['assigned_to']] : []),
        ]);

        $this->log($inquiry, [
            'status' => $validated['status'],
            'assigned_to' => $handedOver ? $inquiry->assigned_to : null,
            'next_follow_up' => $validated['next_follow_up'] ?? null,
            'remark' => $validated['remark'] ?? null,
        ]);
        if ($handedOver) {
            $this->notifyHandover($inquiry);
        }

        return $this->show($inquiry->fresh());
    }

    public function destroy(Inquiry $inquiry): JsonResponse
    {
        InquiryActivity::where('inquiry_id', $inquiry->id)->delete();
        $inquiry->delete();

        return response()->json(['message' => 'Inquiry deleted']);
    }

    private function validateInquiry(Request $request): array
    {
        return $request->validate([
            'client_name' => 'required|string|max:222',
            'mobile_no' => 'nullable|string|max:50',
            'location' => 'nullable|string|max:222',
            'budget' => 'nullable|string|max:100',
            'work_categories' => 'nullable|array',
            'work_categories.*' => 'string|max:100',
            'notes' => 'nullable|string',
            'assigned_to' => 'nullable|integer|exists:users,id',
            'status' => ['nullable', Rule::in(Inquiry::STATUSES)],
            'next_follow_up' => 'nullable|date',
        ]);
    }

    /** Map request fields to table columns (location is stored in source_location). */
    private function toColumns(array $validated): array
    {
        return [
            'client_name' => trim($validated['client_name']),
            'mobile_no' => $validated['mobile_no'] ?? null,
            'source_location' => $validated['location'] ?? null,
            'budget' => $validated['budget'] ?? null,
            'work_categories' => array_values(array_unique($validated['work_categories'] ?? [])),
            'notes' => $validated['notes'] ?? null,
            'assigned_to' => $validated['assigned_to'] ?? null,
            'next_follow_up' => $validated['next_follow_up'] ?? null,
        ];
    }

    private function log(Inquiry $inquiry, array $values): void
    {
        InquiryActivity::create([
            'inquiry_id' => $inquiry->id,
            'user_id' => auth()->id(),
            ...$values,
            'created_at' => now(),
        ]);
    }

    private function notifyHandover(Inquiry $inquiry): void
    {
        if (!$inquiry->assigned_to || (int) $inquiry->assigned_to === (int) auth()->id()) {
            return;
        }

        $from = auth()->user()?->name ?: 'A user';
        Notification::create([
            'user_id' => $inquiry->assigned_to,
            'type' => 'inquiry_handover',
            'title' => "Inquiry {$inquiry->inquiry_no} handed over to you",
            'message' => "{$from} handed over the inquiry from {$inquiry->client_name}"
                .($inquiry->mobile_no ? " ({$inquiry->mobile_no})" : '').'.',
            'data' => ['inquiry_id' => $inquiry->id],
        ]);
    }

    private function present(Inquiry $inquiry, bool $withActivities = false): array
    {
        $data = [
            'id' => $inquiry->id,
            'inquiry_no' => $inquiry->inquiry_no,
            'client_name' => $inquiry->client_name,
            'mobile_no' => $inquiry->mobile_no ?? '',
            'location' => $inquiry->source_location ?? '',
            'budget' => $inquiry->budget ?? '',
            'work_categories' => $inquiry->work_categories ?? [],
            'notes' => $inquiry->notes ?? '',
            'status' => in_array($inquiry->status, Inquiry::STATUSES, true) ? $inquiry->status : 'new',
            'next_follow_up' => $inquiry->next_follow_up?->toDateString(),
            'received_date' => $inquiry->received_date?->toDateString(),
            'assigned_to' => $inquiry->assigned_to,
            'assigned_to_name' => $this->userName($inquiry->assignedUser),
            'created_by_name' => $this->userName($inquiry->createdByUser),
            'created_at' => $inquiry->created_at?->toIso8601String(),
            'updated_at' => $inquiry->updated_at?->toIso8601String(),
        ];

        if ($withActivities) {
            $data['activities'] = $inquiry->activities->map(fn (InquiryActivity $activity): array => [
                'id' => $activity->id,
                'status' => $activity->status,
                'remark' => $activity->remark,
                'next_follow_up' => $activity->next_follow_up?->toDateString(),
                'assigned_to_name' => $this->userName($activity->assignedUser),
                'user_name' => $this->userName($activity->user),
                'created_at' => $activity->created_at?->toIso8601String(),
            ])->values();
        }

        return $data;
    }

    private function userName(?User $user): ?string
    {
        return $user ? ($user->name ?: null) : null;
    }
}
