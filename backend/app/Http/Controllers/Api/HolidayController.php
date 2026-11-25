<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Holiday;
use App\Models\User;
use App\Services\AttendanceBook;
use App\Services\LeaveBook;
use App\Services\WorkCalendar;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/** The holiday calendar everyone sees; full admins change it. */
class HolidayController extends Controller
{
    public function __construct(private WorkCalendar $calendar) {}

    /** A year: holidays, weekly offs, who is on leave (names only) and birthdays (day and month only) */
    public function year(Request $request, LeaveBook $leaves, AttendanceBook $attendance): JsonResponse
    {
        $request->validate(['year' => ['nullable', 'integer', 'between:2020,2100']]);
        $year = (int) ($request->query('year') ?: now(WorkCalendar::ZONE)->year);
        [$from, $to] = ["{$year}-01-01", "{$year}-12-31"];
        $me = $request->user();

        $picked = DB::table('optional_holiday_picks')->where('user_id', $me->id)->pluck('holiday_id')->map(fn ($id) => (int) $id)->all();
        $holidays = Holiday::query()->whereBetween('date', [$from, $to])->orderBy('date')->orderBy('name')->get();
        $people = $attendance->people()->keyBy('id');

        $away = [];
        foreach ($leaves->approvedByDay($from, $to) as $userId => $days) {
            $name = $people->get($userId)?->name;
            foreach ($name ? $days : [] as $date => $leave) {
                if (! $leave['counts_present']) {
                    $away[$date][] = ['name' => $name, 'half' => $leave['half'] !== null];
                }
            }
        }

        $leap = (bool) date('L', strtotime($from));

        return response()->json(['data' => [
            'year' => $year,
            'today' => WorkCalendar::today(),
            'holidays' => $holidays->map(fn (Holiday $h) => $this->present($h) + ['picked' => in_array($h->id, $picked, true)]),
            'weekly_off' => array_values(array_filter(WorkCalendar::dates($from, $to), fn (string $d) => $this->calendar->isWeeklyOff($d))),
            'away' => (object) $away,
            'birthdays' => $people->filter(fn (User $u) => $u->date_of_birth !== null)->map(function (User $u) use ($year, $leap): array {
                $day = $u->date_of_birth->format('m-d');

                return ['date' => "{$year}-".($day === '02-29' && ! $leap ? '02-28' : $day), 'name' => $u->name];
            })->sortBy('date')->values(),
            'optional_limit' => (int) $this->calendar->settings()['optional_limit'],
            'optional_used' => $holidays->where('type', 'optional')->whereIn('id', $picked)->count(),
        ]]);
    }

    public function pick(Request $request, Holiday $holiday): JsonResponse
    {
        $me = $request->user();
        $on = $request->validate(['on' => ['required', 'boolean']])['on'];
        abort_if($me->isSuperAdmin(), 403, 'Optional holidays are for users only.');
        abort_unless($holiday->type === 'optional', 422, 'This is not an optional holiday.');
        abort_if($holiday->date->toDateString() <= WorkCalendar::today(), 422, 'This day is no longer ahead. Ask the admin.');

        DB::transaction(function () use ($me, $holiday, $on): void {
            User::query()->whereKey($me->id)->lockForUpdate()->first();
            $mine = DB::table('optional_holiday_picks')->where('user_id', $me->id);
            if (! $on) {
                (clone $mine)->where('holiday_id', $holiday->id)->delete();

                return;
            }
            $used = (clone $mine)->whereIn('holiday_id', Holiday::query()->where('type', 'optional')->whereYear('date', $holiday->date->year)->pluck('id'))
                ->where('holiday_id', '!=', $holiday->id)->count();
            $limit = (int) $this->calendar->settings()['optional_limit'];
            abort_if($used >= $limit, 422, "You can choose {$limit} optional holiday(s) in a year.");
            DB::table('optional_holiday_picks')->updateOrInsert(['user_id' => $me->id, 'holiday_id' => $holiday->id], ['created_at' => now(), 'updated_at' => now()]);
        });

        return response()->json(['message' => 'Saved']);
    }

    public function store(Request $request): JsonResponse
    {
        $this->admin($request);

        return response()->json(['data' => $this->present(Holiday::create($this->values($request)))], 201);
    }

    public function update(Request $request, Holiday $holiday): JsonResponse
    {
        $this->admin($request);
        $holiday->update($this->values($request, $holiday));

        return response()->json(['data' => $this->present($holiday)]);
    }

    public function destroy(Request $request, Holiday $holiday): JsonResponse
    {
        $this->admin($request);
        DB::table('optional_holiday_picks')->where('holiday_id', $holiday->id)->delete();
        $holiday->delete();

        return response()->json(['message' => 'Holiday deleted']);
    }

    private function values(Request $request, ?Holiday $holiday = null): array
    {
        return $request->validate([
            'date' => ['required', 'date_format:Y-m-d'],
            'name' => ['required', 'string', 'max:120', Rule::unique('holidays', 'name')->where('date', (string) $request->input('date'))->ignore($holiday?->id)],
            'type' => ['required', 'in:holiday,optional'],
            'tentative' => ['required', 'boolean'],
        ], ['name.unique' => 'This holiday is already on that date.']);
    }

    private function admin(Request $request): void
    {
        abort_unless($request->user()->isFullAdmin(), 403, 'Only an administrator can change holidays.');
    }

    private function present(Holiday $h): array
    {
        return ['id' => $h->id, 'date' => $h->date->toDateString(), 'name' => $h->name, 'type' => $h->type, 'tentative' => $h->tentative];
    }
}
