<?php

namespace App\Services;

use App\Models\Attendance;
use App\Models\AttendanceCorrection;
use App\Models\Notification;
use App\Models\UsageDay;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/** Check in / check out and what each day of a user counts as. */
class AttendanceBook
{
    public function __construct(private WorkCalendar $calendar, private LeaveBook $leaves) {}

    /** @param array{lat?: ?float, lng?: ?float, accuracy?: ?int, note?: ?string} $place */
    public function punch(User $user, string $action, array $place, ?string $ip): Attendance
    {
        abort_if($user->isSuperAdmin(), 403, 'Attendance is kept for users only.');
        $this->closeForgotten($user->id);

        return DB::transaction(function () use ($user, $action, $place, $ip): Attendance {
            // Two clicks (or two tabs) at the same moment
            User::query()->whereKey($user->id)->lockForUpdate()->first();
            $open = Attendance::query()->where('user_id', $user->id)->whereNull('check_out_at')->latest('id')->first();
            $side = $action === 'in' ? 'in' : 'out';
            $values = [
                "{$side}_lat" => $place['lat'] ?? null, "{$side}_lng" => $place['lng'] ?? null, "{$side}_accuracy" => $place['accuracy'] ?? null,
                "{$side}_ip" => $ip, "{$side}_note" => $place['note'] ?? null,
            ];

            if ($action === 'in') {
                abort_if($open !== null, 422, 'You are already checked in.');

                return Attendance::create(['user_id' => $user->id, 'date' => WorkCalendar::today(), 'check_in_at' => now()] + $values);
            }
            abort_if($open === null, 422, 'You are not checked in.');
            $open->update(['check_out_at' => now()] + $values);

            return $open;
        });
    }

    /** A check out that was forgotten ends with the last activity of that day. */
    public function closeForgotten(?int $userId = null): int
    {
        $open = Attendance::query()->whereNull('check_out_at')->where('date', '<', WorkCalendar::today())
            ->when($userId, fn ($q) => $q->where('user_id', $userId))->get();
        foreach ($open as $row) {
            $last = UsageDay::query()->where('user_id', $row->user_id)->where('date', $row->date->toDateString())->value('last_active_at');
            $last = $last ? Carbon::parse($last) : null;
            $row->update(['check_out_at' => $last && $last->gt($row->check_in_at) ? $last : $row->check_in_at, 'auto_closed' => true]);
        }

        return $open->count();
    }

    /** @return Collection<int, User> the users whose attendance is kept */
    public function people(): Collection
    {
        $hidden = array_map('intval', $this->calendar->settings()['hidden_users']);

        return User::query()->where(fn ($q) => $q->whereNull('is_active')->orWhere('is_active', true))
            ->when($hidden, fn ($q) => $q->whereNotIn('id', $hidden))
            ->orderBy('firstname')->orderBy('lastname')->get()
            ->filter(fn (User $u) => $u->name !== '' && ! $u->isSuperAdmin())->values();
    }

    /**
     * Every day of the range for each user.
     *
     * @param  int[]  $userIds
     * @return array<int, array<string, array>> user id => date => day
     */
    public function days(array $userIds, string $from, string $to): array
    {
        $today = WorkCalendar::today();
        // When attendance began to be kept: a correction of an earlier day does not move that back
        $kept = Attendance::query()->min('created_at');
        $started = min(array_filter([
            substr((string) Attendance::query()->whereNull('correction_id')->min('date'), 0, 10),
            $kept ? Carbon::parse($kept)->setTimezone(WorkCalendar::ZONE)->toDateString() : '',
        ]) ?: ['9999-12-31']);
        $since = User::query()->whereIn('id', $userIds)->pluck('created_at', 'id');

        $spells = Attendance::query()->whereIn('user_id', $userIds)->whereBetween('date', [$from, $to])->orderBy('check_in_at')->get()
            ->groupBy(fn (Attendance $a) => $a->user_id.'|'.$a->date->toDateString());
        $usage = UsageDay::query()->whereIn('user_id', $userIds)->whereBetween('date', [$from, $to])->get()
            ->keyBy(fn (UsageDay $u) => $u->user_id.'|'.$u->date->toDateString());
        $holidays = $this->calendar->holidays($from, $to);
        $picks = $this->calendar->optionalPicks($from, $to);
        $leaves = $this->leaves->approvedByDay($from, $to);

        $result = [];
        foreach ($userIds as $id) {
            $joined = isset($since[$id]) ? Carbon::parse($since[$id])->setTimezone(WorkCalendar::ZONE)->toDateString() : null;
            foreach (WorkCalendar::dates($from, $to) as $date) {
                $rows = $spells->get("{$id}|{$date}", collect());
                $used = $usage->get("{$id}|{$date}");
                $leave = $leaves[$id][$date] ?? null;
                $closed = $holidays[$date] ?? $picks[$id][$date] ?? null;
                $off = $closed !== null ? 'holiday' : ($this->calendar->isWeeklyOff($date) ? 'weekly_off' : null);

                $status = match (true) {
                    $rows->isNotEmpty() && $leave && ! $leave['half'] && ! $leave['counts_present'] => 'leave',
                    $rows->isNotEmpty() => 'present',
                    $off !== null => $off,
                    $leave !== null && $leave['counts_present'] && ! $leave['half'] => 'on_duty',
                    $leave !== null && ! $leave['half'] => 'leave',
                    $leave !== null => $date < $today ? 'half_leave' : ($date === $today ? 'not_in' : 'half_leave'),
                    $date > $today => 'future',
                    // Before attendance was kept, or before this user was added, nobody was absent
                    $date < $started || ($joined && $date < $joined) => 'none',
                    $date === $today => 'not_in',
                    default => 'absent',
                };

                $result[$id][$date] = [
                    'date' => $date,
                    'status' => $status,
                    'off' => $off,
                    'off_name' => $closed ?? ($off ? 'Weekly off' : null),
                    'leave' => $leave,
                    'in' => $rows->first()?->check_in_at->toIso8601String(),
                    'out' => $rows->isNotEmpty() && $rows->every(fn (Attendance $a) => $a->check_out_at !== null) ? $rows->max('check_out_at')->toIso8601String() : null,
                    'seconds' => $this->worked($rows),
                    'auto_closed' => $rows->contains('auto_closed', true),
                    'corrected' => $rows->contains(fn (Attendance $a) => $a->correction_id !== null),
                    'no_location' => $rows->contains(fn (Attendance $a) => $a->in_lat === null && $a->correction_id === null),
                    'active' => $used?->active_seconds ?? 0,
                    'idle' => $used?->idle_seconds ?? 0,
                ];
            }
        }

        return $result;
    }

    /** Seconds between check in and check out; a spell still open counts till now */
    public function worked(Collection $spells): int
    {
        return (int) $spells->sum(fn (Attendance $a) => max(0, ($a->check_out_at ?? now())->getTimestamp() - $a->check_in_at->getTimestamp()));
    }

    public function present(Attendance $a): array
    {
        return [
            'id' => $a->id,
            'date' => $a->date->toDateString(),
            'check_in_at' => $a->check_in_at->toIso8601String(),
            'check_out_at' => $a->check_out_at?->toIso8601String(),
            'in' => $this->place($a, 'in'),
            'out' => $a->check_out_at ? $this->place($a, 'out') : null,
            'auto_closed' => $a->auto_closed,
            'corrected' => $a->correction_id !== null,
        ];
    }

    private function place(Attendance $a, string $side): array
    {
        $lat = $a->{"{$side}_lat"};
        $lng = $a->{"{$side}_lng"};
        $s = $this->calendar->settings();
        $meters = $lat !== null && $lng !== null && $s['office_lat'] !== null && $s['office_lng'] !== null
            ? $this->distance((float) $s['office_lat'], (float) $s['office_lng'], $lat, $lng) : null;

        return [
            'lat' => $lat, 'lng' => $lng, 'accuracy' => $a->{"{$side}_accuracy"}, 'note' => $a->{"{$side}_note"}, 'ip' => $a->{"{$side}_ip"},
            'meters' => $meters,
            // The phone's own error counts in the user's favour, up to the office radius once more
            'at_office' => $meters === null ? null : $meters <= (int) $s['office_radius'] + min((int) $a->{"{$side}_accuracy"}, (int) $s['office_radius']),
        ];
    }

    private function distance(float $lat1, float $lng1, float $lat2, float $lng2): int
    {
        $h = sin(deg2rad($lat2 - $lat1) / 2) ** 2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin(deg2rad($lng2 - $lng1) / 2) ** 2;

        return (int) round(2 * 6371000 * asin(min(1, sqrt($h))));
    }

    /** Puts an approved correction in place of what was recorded for that day. */
    public function decideCorrection(AttendanceCorrection $row, User $by, bool $approve, ?string $remark): void
    {
        DB::transaction(function () use ($row, $by, $approve, $remark): void {
            $done = AttendanceCorrection::query()->whereKey($row->id)->where('status', 'pending')->update([
                'status' => $approve ? 'approved' : 'rejected', 'decided_by' => $by->id, 'decided_at' => now(), 'remark' => $remark, 'updated_at' => now(),
            ]);
            abort_unless($done, 422, 'This request was already decided.');
            if (! $approve) {
                return;
            }
            $old = Attendance::query()->where('user_id', $row->user_id)->where('date', $row->date->toDateString())->get();
            $row->refresh()->update(['before' => $old->map(fn (Attendance $a) => $a->getAttributes())->all()]);
            Attendance::query()->whereIn('id', $old->pluck('id'))->delete();
            $first = $old->sortBy('check_in_at')->first();
            Attendance::create([
                'user_id' => $row->user_id, 'date' => $row->date->toDateString(),
                'check_in_at' => $row->check_in_at, 'check_out_at' => $row->check_out_at, 'correction_id' => $row->id,
                'in_note' => mb_strimwidth($row->reason, 0, 250, '…'),
                // Where the user was is still what was recorded
                'in_lat' => $first?->in_lat, 'in_lng' => $first?->in_lng, 'in_accuracy' => $first?->in_accuracy, 'in_ip' => $first?->in_ip,
            ]);
        });

        if ($row->user_id !== $by->id) {
            $this->notify($row->user_id, $approve ? 'Attendance corrected' : 'Attendance correction not approved',
                $row->date->format('d-m-Y')." · {$by->name}".($remark ? ": {$remark}" : ''));
        }
    }

    /** @return array{present: string[], on_leave: string[], on_duty: string[], not_in: string[]}|null null on a closed day */
    public function daySummary(string $date): ?array
    {
        $people = $this->people();
        $days = $this->days($people->pluck('id')->all(), $date, $date);
        $groups = ['present' => [], 'on_leave' => [], 'on_duty' => [], 'not_in' => []];
        $open = false;
        foreach ($people as $user) {
            $day = $days[$user->id][$date];
            $open = $open || $day['off'] === null;
            $group = match ($day['status']) {
                'present' => 'present',
                'leave' => 'on_leave',
                'on_duty' => 'on_duty',
                'not_in', 'absent', 'half_leave' => 'not_in',
                default => null,
            };
            if ($group) {
                $groups[$group][] = $user->name;
            }
        }

        return $open ? $groups : null;
    }

    public function notify(int $userId, string $title, string $message): void
    {
        Notification::create([
            'user_id' => $userId, 'type' => 'attendance', 'title' => $title, 'message' => mb_strimwidth($message, 0, 400, '…'), 'created_at' => now(),
        ]);
    }

    /** @return Collection<int, User> */
    public static function admins(): Collection
    {
        return User::query()->get()->filter(fn (User $u) => $u->is_active !== false && $u->isFullAdmin())->values();
    }
}
