<?php

namespace App\Services;

use App\Models\LeaveQuota;
use App\Models\LeaveRequest;
use App\Models\LeaveType;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/** Leave applications and balances. A leave year is a calendar year. */
class LeaveBook
{
    /** How far back a leave can be applied for (sick leave is often applied for afterwards) */
    private const BACK_DAYS = 45;

    public function __construct(private WorkCalendar $calendar) {}

    /** @return Collection<int, array> per leave type */
    public function balances(int $userId, int $year): Collection
    {
        $quotas = LeaveQuota::query()->where('user_id', $userId)->where('year', $year)->pluck('days', 'leave_type_id');
        $used = LeaveRequest::query()->where('user_id', $userId)->whereYear('from_date', $year)->whereIn('status', ['approved', 'pending'])
            ->selectRaw('leave_type_id, status, sum(days) as days')->groupBy('leave_type_id', 'status')->toBase()->get();

        return LeaveType::query()->orderBy('sort_order')->orderBy('id')->get()->map(function (LeaveType $type) use ($quotas, $used): array {
            $of = fn (string $status) => (float) ($used->first(fn ($u) => (int) $u->leave_type_id === $type->id && $u->status === $status)->days ?? 0);
            $own = isset($quotas[$type->id]) ? (float) $quotas[$type->id] : null;
            $quota = $own ?? ($type->granted ? 0.0 : $type->yearly_days);

            return [
                'leave_type_id' => $type->id, 'name' => $type->name, 'code' => $type->code, 'color' => $type->color,
                'active' => $type->active, 'granted' => $type->granted, 'counts_present' => $type->counts_present,
                'quota' => $quota, 'own_quota' => $own, 'taken' => $of('approved'), 'pending' => $of('pending'),
                'left' => $quota === null ? null : $quota - $of('approved') - $of('pending'),
            ];
        })->filter(fn (array $b) => $b['active'] || $b['taken'] > 0)->values();
    }

    /** Days a leave counts as: office holidays and weekly offs inside it are free. */
    public function days(int $userId, string $from, string $to, ?string $half): float
    {
        $days = count($this->calendar->workingDays($userId, $from, $to));

        return $half && $days ? 0.5 : (float) $days;
    }

    /** @param array{leave_type_id: int, from_date: string, to_date: string, half?: ?string, reason: string} $values */
    public function apply(User $user, array $values): LeaveRequest
    {
        $fail = fn (string $message) => throw ValidationException::withMessages(['leave' => $message]);
        abort_if($user->isSuperAdmin(), 403, 'Leave is for users only.');
        ['from_date' => $from, 'to_date' => $to] = $values;
        $half = $values['half'] ?? null;

        if ($half && $from !== $to) {
            $fail('A half day leave is for one day only.');
        }
        if (substr($from, 0, 4) !== substr($to, 0, 4)) {
            $fail('Apply separately for the days in each year.');
        }
        if ($from < now(WorkCalendar::ZONE)->subDays(self::BACK_DAYS)->toDateString()) {
            $fail('Leave can be applied for up to '.self::BACK_DAYS.' days back. Please ask the admin.');
        }
        $type = LeaveType::query()->where('active', true)->find($values['leave_type_id']) ?? $fail('Choose a leave type.');
        $days = $this->days($user->id, $from, $to, $half);
        if ($days <= 0) {
            $fail('All of these days are holidays or weekly offs.');
        }

        $request = DB::transaction(function () use ($user, $type, $from, $to, $half, $days, $values, $fail): LeaveRequest {
            // Two applications at the same moment must not both use the last day of the balance
            User::query()->whereKey($user->id)->lockForUpdate()->first();

            $clash = LeaveRequest::query()->where('user_id', $user->id)->whereIn('status', ['pending', 'approved'])
                ->where('from_date', '<=', $to)->where('to_date', '>=', $from)
                ->get()->first(fn (LeaveRequest $r) => ! ($half && $r->half && $r->half !== $half));
            if ($clash) {
                $fail("You already have a leave from {$clash->from_date->format('d-m-Y')} to {$clash->to_date->format('d-m-Y')} ({$clash->status}).");
            }
            $left = $this->balances($user->id, (int) substr($from, 0, 4))->firstWhere('leave_type_id', $type->id)['left'] ?? null;
            if ($left !== null && $days > $left) {
                $fail("{$this->number(max(0, $left))} day(s) of {$type->name} left; this leave needs {$this->number($days)}.");
            }

            return LeaveRequest::create([
                'user_id' => $user->id, 'leave_type_id' => $type->id, 'from_date' => $from, 'to_date' => $to,
                'half' => $half, 'days' => $days, 'reason' => $values['reason'], 'status' => 'pending',
            ]);
        });

        foreach ($this->approvers() as $approver) {
            if ($approver->id !== $user->id) {
                $this->notify($approver->id, $request, 'Leave to approve', "{$user->name} · ".$this->describe($request));
            }
        }

        return $request;
    }

    public function decide(LeaveRequest $request, User $by, bool $approve, ?string $remark): void
    {
        abort_unless($by->canApproveLeave(), 403, 'You cannot approve leave.');
        abort_if($request->user_id === $by->id && ! $by->isFullAdmin(), 403, 'Another approver has to decide your own leave.');

        // Only one of two approvers deciding at the same moment
        $done = LeaveRequest::query()->whereKey($request->id)->where('status', 'pending')->update([
            'status' => $approve ? 'approved' : 'rejected', 'decided_by' => $by->id, 'decided_at' => now(), 'remark' => $remark, 'updated_at' => now(),
        ]);
        abort_unless($done, 422, 'This application was already decided or cancelled.');

        if ($request->user_id !== $by->id) {
            $this->notify($request->user_id, $request, $approve ? 'Leave approved' : 'Leave not approved', $this->describe($request)." · {$by->name}".($remark ? ": {$remark}" : ''));
        }
    }

    public function cancel(LeaveRequest $request, User $by): void
    {
        $own = $request->user_id === $by->id;
        abort_unless($own || $by->canApproveLeave(), 403);
        abort_unless(in_array($request->status, ['pending', 'approved'], true), 422, 'This application is already closed.');
        // Leave that has started can only be taken back by another approver (a full admin also for themselves)
        abort_if($own && ! $by->isFullAdmin() && $request->status === 'approved' && $request->from_date->toDateString() <= WorkCalendar::today(), 422,
            'This leave has already started. Ask an approver to cancel it.');

        $request->update(['status' => 'cancelled', 'decided_by' => $by->id, 'decided_at' => now()]);
        if (! $own) {
            $this->notify($request->user_id, $request, 'Leave cancelled', $this->describe($request)." · by {$by->name}");
        }
    }

    /** @return array<int, array<string, array>> user id => date => the approved leave on that day */
    public function approvedByDay(string $from, string $to): array
    {
        $map = [];
        $leaves = LeaveRequest::query()->with('type')->where('status', 'approved')->where('from_date', '<=', $to)->where('to_date', '>=', $from)->get();
        foreach ($leaves as $leave) {
            $dates = WorkCalendar::dates(max($from, $leave->from_date->toDateString()), min($to, $leave->to_date->toDateString()));
            foreach ($dates as $date) {
                $before = $map[$leave->user_id][$date] ?? null;
                $map[$leave->user_id][$date] = [
                    'code' => $leave->type?->code ?? 'L', 'name' => $leave->type?->name ?? 'Leave', 'color' => $leave->type?->color ?? '#2563eb',
                    // Two half days of one date make a full one
                    'half' => $leave->half && ! $before ? $leave->half : null,
                    'counts_present' => (bool) $leave->type?->counts_present,
                ];
            }
        }

        return $map;
    }

    /** @return Collection<int, User> */
    public function approvers(): Collection
    {
        return User::query()->get()->filter(fn (User $u) => $u->is_active !== false && $u->canApproveLeave());
    }

    public function describe(LeaveRequest $request): string
    {
        $type = $request->type?->name ?? 'Leave';
        $dates = $request->from_date->format('d-m-Y').($request->from_date->eq($request->to_date) ? '' : ' to '.$request->to_date->format('d-m-Y'));

        return "{$type} · {$dates}".($request->half ? ' ('.($request->half === 'first' ? 'first' : 'second').' half)' : '')." · {$this->number($request->days)} day(s)";
    }

    private function number(float $n): string
    {
        return rtrim(rtrim(number_format($n, 1, '.', ''), '0'), '.');
    }

    private function notify(int $userId, LeaveRequest $request, string $title, string $message): void
    {
        Notification::create([
            'user_id' => $userId, 'type' => 'leave', 'title' => $title, 'message' => mb_strimwidth($message, 0, 400, '…'),
            'data' => ['leave_id' => $request->id], 'created_at' => now(),
        ]);
    }
}
