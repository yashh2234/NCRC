<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Attendance;
use App\Models\AttendanceCorrection;
use App\Services\AttendanceBook;
use App\Services\WorkCalendar;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

/** A user's own attendance: check in / out, month, correction requests. */
class AttendanceController extends Controller
{
    public function __construct(private AttendanceBook $book) {}

    public function status(Request $request): JsonResponse
    {
        $user = $request->user();
        $this->book->closeForgotten($user->id);
        $today = WorkCalendar::today();
        $rows = Attendance::query()->where('user_id', $user->id)->where('date', $today)->orderBy('check_in_at')->get();
        $last = Attendance::query()->where('user_id', $user->id)->where('date', '<', $today)->latest('date')->latest('id')->first();

        return response()->json(['data' => [
            'date' => $today,
            'checked_in' => $rows->contains(fn (Attendance $a) => $a->check_out_at === null),
            'seconds' => $this->book->worked($rows),
            'spells' => $rows->map(fn (Attendance $a) => $this->book->present($a)),
            // The last day ended without a check out: the user can ask for a correction
            'forgot_on' => $last?->auto_closed ? $last->date->toDateString() : null,
            'kept' => $this->book->people()->contains('id', $user->id),
        ]]);
    }

    public function punch(Request $request): JsonResponse
    {
        $values = $request->validate([
            'action' => ['required', 'in:in,out'],
            'lat' => ['nullable', 'numeric', 'between:-90,90'],
            'lng' => ['nullable', 'numeric', 'between:-180,180'],
            'accuracy' => ['nullable', 'numeric', 'min:0', 'max:10000000'],
            'note' => ['nullable', 'string', 'max:250'],
        ]);
        $located = isset($values['lat'], $values['lng']);
        abort_if($values['action'] === 'in' && ! $located && blank($values['note'] ?? null), 422, 'Allow the location, or write where you are working today.');

        $row = $this->book->punch($request->user(), $values['action'], [
            'lat' => $located ? (float) $values['lat'] : null,
            'lng' => $located ? (float) $values['lng'] : null,
            'accuracy' => $located && isset($values['accuracy']) ? (int) round((float) $values['accuracy']) : null,
            'note' => $values['note'] ?? null,
        ], $request->ip());

        return response()->json(['data' => $this->book->present($row)]);
    }

    public function month(Request $request): JsonResponse
    {
        [$from, $to] = self::monthRange($request);
        $user = $request->user();
        $this->book->closeForgotten($user->id);
        $spells = Attendance::query()->where('user_id', $user->id)->whereBetween('date', [$from, $to])->orderBy('check_in_at')->get();

        return response()->json(['data' => [
            'days' => array_values($this->book->days([$user->id], $from, $to)[$user->id] ?? []),
            'spells' => $spells->map(fn (Attendance $a) => $this->book->present($a)),
            'corrections' => AttendanceCorrection::query()->with('decider')->where('user_id', $user->id)->whereBetween('date', [$from, $to])->latest('id')->get()
                ->map(fn (AttendanceCorrection $c) => self::presentCorrection($c)),
        ]]);
    }

    /** Asks for other check in / check out times of a day. */
    public function requestCorrection(Request $request): JsonResponse
    {
        $values = $request->validate([
            'date' => ['required', 'date_format:Y-m-d'],
            'check_in' => ['required', 'date_format:H:i'],
            'check_out' => ['nullable', 'date_format:H:i'],
            'reason' => ['required', 'string', 'max:480'],
        ]);
        $user = $request->user();
        abort_if($user->isSuperAdmin(), 403, 'Attendance is kept for users only.');
        $today = WorkCalendar::today();
        abort_if($values['date'] > $today, 422, 'This day has not come yet.');
        abort_if($values['date'] < Carbon::parse($today)->subDays(45)->toDateString(), 422, 'A correction can be asked for up to 45 days back.');

        $at = fn (string $time) => Carbon::parse("{$values['date']} {$time}", WorkCalendar::ZONE)->utc();
        $in = $at($values['check_in']);
        $out = filled($values['check_out'] ?? null) ? $at($values['check_out']) : null;
        abort_if($out === null && $values['date'] < $today, 422, 'Enter the check out time too.');
        // A shift that went past midnight
        if ($out && $out->lte($in)) {
            $out->addDay();
        }
        abort_if($in->isFuture() || $out?->isFuture(), 422, 'This time has not come yet.');
        abort_if(AttendanceCorrection::query()->where('user_id', $user->id)->where('date', $values['date'])->where('status', 'pending')->exists(),
            422, 'A correction for this day is already waiting.');

        $row = AttendanceCorrection::create([
            'user_id' => $user->id, 'date' => $values['date'], 'check_in_at' => $in, 'check_out_at' => $out, 'reason' => $values['reason'], 'status' => 'pending',
        ]);
        foreach (AttendanceBook::admins() as $admin) {
            if ($admin->id !== $user->id) {
                $this->book->notify($admin->id, 'Attendance correction to check', "{$user->name} · {$row->date->format('d-m-Y')} · {$values['reason']}");
            }
        }

        return response()->json(['data' => self::presentCorrection($row)], 201);
    }

    public function withdrawCorrection(Request $request, AttendanceCorrection $correction): JsonResponse
    {
        abort_unless($correction->user_id === $request->user()->id, 403);
        $done = AttendanceCorrection::query()->whereKey($correction->id)->where('status', 'pending')->update(['status' => 'cancelled', 'updated_at' => now()]);
        abort_unless($done, 422, 'This request was already decided.');

        return response()->json(['message' => 'Request withdrawn']);
    }

    /** @return array{0: string, 1: string} first and last date of ?month=YYYY-MM */
    public static function monthRange(Request $request): array
    {
        $request->validate(['month' => ['nullable', 'date_format:Y-m']]);
        $first = Carbon::parse(($request->query('month') ?: now(WorkCalendar::ZONE)->format('Y-m')).'-01', 'UTC');

        return [$first->toDateString(), $first->copy()->endOfMonth()->toDateString()];
    }

    public static function presentCorrection(AttendanceCorrection $c): array
    {
        return [
            'id' => $c->id, 'user_id' => $c->user_id, 'user_name' => $c->relationLoaded('user') ? $c->user?->name : null,
            'date' => $c->date->toDateString(),
            'check_in_at' => $c->check_in_at->toIso8601String(), 'check_out_at' => $c->check_out_at?->toIso8601String(),
            'reason' => $c->reason, 'status' => $c->status, 'remark' => $c->remark,
            'decided_by' => $c->relationLoaded('decider') ? $c->decider?->name : null,
            'created_at' => $c->created_at?->toIso8601String(),
        ];
    }
}
