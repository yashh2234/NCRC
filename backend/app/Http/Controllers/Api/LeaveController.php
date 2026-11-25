<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LeaveQuota;
use App\Models\LeaveRequest;
use App\Models\LeaveType;
use App\Services\AttendanceBook;
use App\Services\LeaveBook;
use App\Services\WorkCalendar;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Leave: a user's own applications, the approvers' list, and the admin's types and yearly days. */
class LeaveController extends Controller
{
    public function __construct(private LeaveBook $book) {}

    public function mine(Request $request): JsonResponse
    {
        $user = $request->user();
        $year = $this->year($request);

        return response()->json(['data' => [
            'balances' => $this->book->balances($user->id, $year),
            'requests' => LeaveRequest::query()->with(['type', 'decider'])->where('user_id', $user->id)->whereYear('from_date', $year)
                ->orderByDesc('from_date')->orderByDesc('id')->get()->map(fn (LeaveRequest $r) => $this->present($r)),
        ]]);
    }

    /** How many days a leave would count as */
    public function preview(Request $request): JsonResponse
    {
        $values = $this->dates($request);

        return response()->json(['days' => $this->book->days($request->user()->id, $values['from_date'], $values['to_date'], $values['half'] ?? null)]);
    }

    public function store(Request $request): JsonResponse
    {
        $values = $this->dates($request) + $request->validate([
            'leave_type_id' => ['required', 'integer'],
            'reason' => ['required', 'string', 'max:1000'],
        ]);

        return response()->json(['data' => $this->present($this->book->apply($request->user(), $values)->load('type'))], 201);
    }

    public function cancel(Request $request, LeaveRequest $leave): JsonResponse
    {
        $this->book->cancel($leave, $request->user());

        return response()->json(['data' => $this->present($leave->fresh(['type', 'decider']))]);
    }

    // ─── Approvers ───────────────────────────────────────────────────────

    /** Waiting applications, and those decided in the year */
    public function team(Request $request): JsonResponse
    {
        abort_unless($request->user()->canApproveLeave(), 403, 'You cannot approve leave.');
        $rows = LeaveRequest::query()->with(['type', 'decider', 'user'])
            ->where(fn ($q) => $q->where('status', 'pending')->orWhereYear('from_date', $this->year($request)))
            ->orderByRaw("status = 'pending' desc")->orderByDesc('from_date')->limit(1000)->get();
        $today = WorkCalendar::today();
        $balances = [];

        return response()->json(['data' => $rows->map(function (LeaveRequest $r) use (&$balances, $today): array {
            $extra = [];
            if ($r->status === 'pending') {
                $key = $r->user_id.'|'.$r->from_date->year;
                $balances[$key] ??= $this->book->balances($r->user_id, $r->from_date->year);
                $balance = $balances[$key]->firstWhere('leave_type_id', $r->leave_type_id);
                $extra = [
                    // Days left if this one is approved (the waiting days are already taken off)
                    'left_after' => $balance['left'] ?? null,
                    'also_away' => LeaveRequest::query()->with('user')->where('status', 'approved')->where('user_id', '!=', $r->user_id)
                        ->where('from_date', '<=', $r->to_date)->where('to_date', '>=', $r->from_date)->get()
                        ->map(fn (LeaveRequest $x) => $x->user?->name)->filter()->unique()->values(),
                ];
            }

            return $this->present($r) + ['user_name' => $r->user?->name ?? 'Deleted user', 'past' => $r->to_date->toDateString() < $today] + $extra;
        })]);
    }

    public function decide(Request $request, LeaveRequest $leave): JsonResponse
    {
        $values = $request->validate([
            'approve' => ['required', 'boolean'],
            'remark' => ['nullable', 'string', 'max:480', 'required_if:approve,false,0'],
        ], ['remark.required_if' => 'Write why it is not approved.']);
        $this->book->decide($leave, $request->user(), (bool) $values['approve'], $values['remark'] ?? null);

        return response()->json(['data' => $this->present($leave->fresh(['type', 'decider']))]);
    }

    // ─── Admin ───────────────────────────────────────────────────────────

    public function teamBalances(Request $request, AttendanceBook $attendance): JsonResponse
    {
        abort_unless($request->user()->canApproveLeave(), 403);
        $year = $this->year($request);

        return response()->json([
            'types' => LeaveType::query()->orderBy('sort_order')->orderBy('id')->get(),
            'data' => $attendance->people()->map(fn ($u) => ['user_id' => $u->id, 'name' => $u->name, 'balances' => $this->book->balances($u->id, $year)]),
        ]);
    }

    /** One user's own number of days; empty = back to the type's yearly days */
    public function setQuota(Request $request): JsonResponse
    {
        $this->admin($request);
        $values = $request->validate([
            'user_id' => ['required', 'integer', 'exists:users,id'],
            'leave_type_id' => ['required', 'integer', 'exists:leave_types,id'],
            'year' => ['required', 'integer', 'between:2020,2100'],
            'days' => ['nullable', 'numeric', 'between:0,366'],
        ]);
        $key = ['user_id' => $values['user_id'], 'leave_type_id' => $values['leave_type_id'], 'year' => $values['year']];
        if (isset($values['days'])) {
            LeaveQuota::query()->updateOrCreate($key, ['days' => $values['days']]);
        } else {
            LeaveQuota::query()->where($key)->delete();
        }

        return response()->json(['data' => $this->book->balances($values['user_id'], $values['year'])]);
    }

    public function storeType(Request $request): JsonResponse
    {
        $this->admin($request);
        $type = LeaveType::create($this->typeValues($request) + ['sort_order' => (int) LeaveType::query()->max('sort_order') + 1]);

        return response()->json(['data' => $type->fresh()], 201);
    }

    public function updateType(Request $request, LeaveType $type): JsonResponse
    {
        $this->admin($request);
        $type->update($this->typeValues($request));

        return response()->json(['data' => $type->fresh()]);
    }

    private function typeValues(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:80'],
            'code' => ['required', 'string', 'max:8'],
            'color' => ['required', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'yearly_days' => ['nullable', 'numeric', 'between:0,366'],
            'granted' => ['required', 'boolean'],
            'counts_present' => ['required', 'boolean'],
            'active' => ['required', 'boolean'],
        ]);
    }

    private function dates(Request $request): array
    {
        return $request->validate([
            'from_date' => ['required', 'date_format:Y-m-d'],
            'to_date' => ['required', 'date_format:Y-m-d', 'after_or_equal:from_date', 'before:'.now()->addYears(2)->toDateString()],
            'half' => ['nullable', 'in:first,second'],
        ], ['to_date.after_or_equal' => 'The last day is before the first day.']);
    }

    private function year(Request $request): int
    {
        $request->validate(['year' => ['nullable', 'integer', 'between:2020,2100']]);

        return (int) ($request->query('year') ?: now(WorkCalendar::ZONE)->year);
    }

    private function admin(Request $request): void
    {
        abort_unless($request->user()->isFullAdmin(), 403, 'Only an administrator can change this.');
    }

    private function present(LeaveRequest $r): array
    {
        return [
            'id' => $r->id, 'user_id' => $r->user_id, 'leave_type_id' => $r->leave_type_id,
            'type' => $r->type?->name ?? 'Leave', 'code' => $r->type?->code ?? '', 'color' => $r->type?->color ?? '#64748b',
            'from_date' => $r->from_date->toDateString(), 'to_date' => $r->to_date->toDateString(), 'half' => $r->half, 'days' => $r->days,
            'reason' => $r->reason, 'status' => $r->status, 'remark' => $r->remark,
            'decided_by' => $r->relationLoaded('decider') ? $r->decider?->name : null,
            'decided_at' => $r->decided_at?->toIso8601String(), 'created_at' => $r->created_at?->toIso8601String(),
        ];
    }
}
