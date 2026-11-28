<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Attendance;
use App\Models\AttendanceCorrection;
use App\Models\HrSetting;
use App\Models\User;
use App\Services\AdminAlert;
use App\Services\AttendanceBook;
use App\Services\WorkCalendar;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

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
            // The app shows the check in popup and does not let it be closed
            'must_check_in' => $this->book->mustCheckIn($user),
            // No check out on an earlier day: its time is typed before checking in
            'missed_out' => ($missed = $this->book->missedCheckOut($user->id)) ? [
                'id' => $missed->id, 'date' => $missed->date->toDateString(), 'check_in_at' => $missed->check_in_at->toIso8601String(),
            ] : null,
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
            // From the phone app: a photo taken with the front camera, as a data URL
            'selfie' => ['nullable', 'string', 'max:3000000'],
            // The time the user left on a day they forgot to check out, typed before checking in
            'missed_out' => ['nullable', 'date_format:H:i'],
        ]);
        $user = $request->user();
        $typed = $values['action'] === 'in' ? $this->typeMissedOut($user, $values['missed_out'] ?? null) : null;
        $selfie = isset($values['selfie']) ? $this->selfieImage($values['selfie']) : null;
        $located = isset($values['lat'], $values['lng']);
        abort_if($values['action'] === 'in' && ! $located && blank($values['note'] ?? null), 422, 'Allow the location, or write where you are working today.');

        $row = $this->book->punch($request->user(), $values['action'], [
            'lat' => $located ? (float) $values['lat'] : null,
            'lng' => $located ? (float) $values['lng'] : null,
            'accuracy' => $located && isset($values['accuracy']) ? (int) round((float) $values['accuracy']) : null,
            'note' => $values['note'] ?? null,
        ], $request->ip());
        if ($selfie !== null) {
            $side = $values['action'] === 'in' ? 'in' : 'out';
            $path = 'attendance-selfies/'.$row->date->format('Y-m').'/'.$row->id.'-'.$side.'-'.Str::random(8).'.jpg';
            Storage::disk('local')->put($path, $selfie);
            $row->forceFill(["{$side}_selfie" => $path])->save();
        }

        $side = $values['action'] === 'in' ? 'in' : 'out';
        $time = ($side === 'in' ? $row->check_in_at : $row->check_out_at)->setTimezone(WorkCalendar::ZONE)->format('H:i');
        AdminAlert::send('team_'.$side, "{$user->name} checked {$side} {$time}", $this->book->placeText($row, $side), ['user_id' => $user->id], $user->id);
        if ($side === 'in' && ($late = $this->book->lateBy($row))) {
            $start = HrSetting::values()['office_start'];
            AdminAlert::send('team_late', "{$user->name} is late: in at {$time}",
                ($late >= 60 ? intdiv($late, 60).' h '.($late % 60).' min' : "{$late} min").' after '.$start, ['user_id' => $user->id], $user->id);
        }
        if ($typed) {
            AdminAlert::send('team_missed', "{$user->name} typed a missed check out",
                "{$typed->date->format('d-m-Y')}: left at {$typed->check_out_at->setTimezone(WorkCalendar::ZONE)->format('H:i')} (entered later)", ['user_id' => $user->id], $user->id);
        }

        return response()->json(['data' => $this->book->present($row)]);
    }

    /** Before checking in: the check out time of the last day that had none, typed by the user */
    private function typeMissedOut(User $user, ?string $time): ?Attendance
    {
        $this->book->closeForgotten($user->id);
        $missed = $this->book->missedCheckOut($user->id);
        if (! $missed) {
            return null;
        }
        abort_if(blank($time), 422, 'You did not check out on '.$missed->date->format('d-m-Y').'. Enter the time you left that day.');
        $out = Carbon::parse($missed->date->toDateString().' '.$time, WorkCalendar::ZONE);
        $in = $missed->check_in_at->copy()->setTimezone(WorkCalendar::ZONE);
        abort_unless($out->gt($in), 422, 'The time you left must be after you checked in that day ('.$in->format('H:i').').');
        $missed->update(['check_out_at' => $out, 'out_entered' => true]);

        return $missed;
    }

    /** The punch photo: for the user and for administrators only */
    public function selfie(Request $request, Attendance $attendance, string $side)
    {
        abort_unless(in_array($side, ['in', 'out'], true), 404);
        $user = $request->user();
        abort_unless((int) $attendance->user_id === (int) $user->id || $user->isFullAdmin(), 403);
        $path = $attendance->{"{$side}_selfie"};
        abort_unless($path && Storage::disk('local')->exists($path), 404);

        return response(Storage::disk('local')->get($path), 200, ['Content-Type' => 'image/jpeg', 'Cache-Control' => 'private, max-age=86400']);
    }

    private function selfieImage(string $dataUrl): string
    {
        abort_unless(preg_match('#^data:image/(jpeg|png|webp);base64,#', $dataUrl, $m), 422, 'The photo could not be read. Take it again.');
        $bytes = base64_decode(substr($dataUrl, strlen($m[0])), true);
        abort_unless($bytes !== false && strlen($bytes) <= 2 * 1024 * 1024 && @getimagesizefromstring($bytes) !== false, 422, 'The photo could not be read. Take it again.');

        return $bytes;
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
