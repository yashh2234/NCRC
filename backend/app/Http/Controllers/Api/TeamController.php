<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Attendance;
use App\Models\AttendanceCorrection;
use App\Models\FailedLogin;
use App\Models\HrSetting;
use App\Models\LoginSession;
use App\Models\UsageDay;
use App\Models\User;
use App\Models\UserActivity;
use App\Services\AttendanceBook;
use App\Services\LoginSecurity;
use App\Services\WorkCalendar;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/** Attendance, software use, work done and logins of all users: full admins only. */
class TeamController extends Controller
{
    /** What a user made, counted per table: label => [table, who column, when column] */
    private const WORK = [
        'Enquiries' => ['inquiries', 'created_by', 'created_at'],
        'Quotations' => ['quotations', 'created_by', 'created_at'],
        'Proposals' => ['proposals', 'created_by', 'created_at'],
        'Tenders' => ['tenders', 'created_by', 'created_at'],
        'Invoices' => ['bills', 'created_by', 'created_at'],
        'Performa invoices' => ['performa_invoices', 'created_by', 'created_at'],
        'Work orders' => ['work_orders', 'created_by', 'created_at'],
    ];

    public function __construct(private AttendanceBook $book) {}

    public function today(Request $request): JsonResponse
    {
        $this->admin($request);
        $this->book->closeForgotten();
        $request->validate(['date' => ['nullable', 'date_format:Y-m-d']]);
        $date = $request->query('date') ?: WorkCalendar::today();
        $people = $this->book->people();
        $ids = $people->pluck('id')->all();
        $days = $this->book->days($ids, $date, $date);
        $spells = Attendance::query()->whereIn('user_id', $ids)->where('date', $date)->orderBy('check_in_at')->get()->groupBy('user_id');
        $online = now()->subMinutes(3);

        return response()->json(['data' => [
            'date' => $date,
            'users' => $people->map(fn (User $u): array => [
                'user_id' => $u->id,
                'name' => $u->name,
                'online' => $u->last_activity_at !== null && Carbon::parse($u->last_activity_at)->gte($online),
                'last_seen' => $u->last_activity_at ? Carbon::parse($u->last_activity_at)->toIso8601String() : null,
                'day' => $days[$u->id][$date],
                'spells' => ($spells->get($u->id) ?? collect())->map(fn (Attendance $a) => $this->book->present($a))->values(),
            ]),
            'corrections' => AttendanceCorrection::query()->where('status', 'pending')->count(),
        ]]);
    }

    public function register(Request $request): JsonResponse
    {
        $this->admin($request);
        $this->book->closeForgotten();
        [$from, $to] = AttendanceController::monthRange($request);
        $people = $this->book->people();
        $days = $this->book->days($people->pluck('id')->all(), $from, $to);

        return response()->json(['data' => [
            'from' => $from,
            'to' => $to,
            'users' => $people->map(fn (User $u) => ['user_id' => $u->id, 'name' => $u->name, 'days' => array_values($days[$u->id])]),
        ]]);
    }

    /** Time in the software per user, with the modules it was spent in */
    public function usage(Request $request): JsonResponse
    {
        $this->admin($request);
        [$from, $to] = $this->range($request);
        $people = $this->book->people();
        $rows = UsageDay::query()->whereBetween('date', [$from, $to])->get()->groupBy('user_id');
        $modules = DB::table('usage_modules')->whereBetween('date', [$from, $to])
            ->selectRaw('user_id, module, sum(active_seconds) as seconds')->groupBy('user_id', 'module')->orderByDesc('seconds')->get()->groupBy('user_id');
        $attendance = Attendance::query()->whereBetween('date', [$from, $to])->get()->groupBy('user_id');

        return response()->json(['data' => $people->map(function (User $u) use ($rows, $modules, $attendance): array {
            $days = $rows->get($u->id) ?? collect();

            return [
                'user_id' => $u->id, 'name' => $u->name,
                'active' => (int) $days->sum('active_seconds'),
                'idle' => (int) $days->sum('idle_seconds'),
                'days' => $days->filter(fn (UsageDay $d) => $d->active_seconds > 0)->count(),
                'worked' => $this->book->worked($attendance->get($u->id) ?? collect()),
                'last_active_at' => $days->max('last_active_at')?->toIso8601String(),
                'modules' => ($modules->get($u->id) ?? collect())->map(fn ($m) => ['module' => $m->module, 'seconds' => (int) $m->seconds])->values(),
            ];
        })]);
    }

    /** One user, day by day */
    public function user(Request $request, User $user): JsonResponse
    {
        $this->admin($request);
        [$from, $to] = $this->range($request);
        [$start, $end] = WorkCalendar::bounds($from, $to);
        $days = $this->book->days([$user->id], $from, $to)[$user->id];
        $usage = UsageDay::query()->where('user_id', $user->id)->whereBetween('date', [$from, $to])->get()->keyBy(fn (UsageDay $d) => $d->date->toDateString());

        return response()->json(['data' => [
            'user_id' => $user->id,
            'name' => $user->name,
            'days' => collect($days)->reverse()->map(fn (array $d) => $d + [
                'first_at' => $usage->get($d['date'])?->first_at?->toIso8601String(),
                'last_active_at' => $usage->get($d['date'])?->last_active_at?->toIso8601String(),
            ])->values(),
            'spells' => Attendance::query()->where('user_id', $user->id)->whereBetween('date', [$from, $to])->orderByDesc('check_in_at')->get()->map(fn (Attendance $a) => $this->book->present($a)),
            'modules' => DB::table('usage_modules')->where('user_id', $user->id)->whereBetween('date', [$from, $to])
                ->selectRaw('module, sum(active_seconds) as seconds')->groupBy('module')->orderByDesc('seconds')->get()->map(fn ($m) => ['module' => $m->module, 'seconds' => (int) $m->seconds]),
            'actions' => UserActivity::query()->where('user_id', $user->id)->where('action', '!=', 'page_visit')->where('created_at', '>=', $start)->where('created_at', '<', $end)
                ->orderByDesc('id')->limit(200)->get()->map(fn (UserActivity $a) => ['id' => $a->id, 'action' => $a->action, 'module' => $a->module, 'details' => $a->details, 'created_at' => $a->created_at?->toIso8601String()]),
        ]]);
    }

    /** What each user made in the range */
    public function work(Request $request): JsonResponse
    {
        $this->admin($request);
        [$start, $end] = WorkCalendar::bounds(...$this->range($request));
        // The super admin has no attendance, but makes things too
        $people = $this->book->people()->concat(User::query()->whereKey(1)->get());
        $counts = [];
        foreach (self::WORK as $label => [$table, $who, $when]) {
            if (Schema::hasTable($table) && Schema::hasColumn($table, $who)) {
                $counts[$label] = DB::table($table)->whereNotNull($who)->where($when, '>=', $start)->where($when, '<', $end)
                    ->selectRaw("{$who} as who, count(*) as n")->groupBy($who)->pluck('n', 'who');
            }
        }
        $activity = fn (array $actions) => UserActivity::query()->whereIn('action', $actions)->where('created_at', '>=', $start)->where('created_at', '<', $end)
            ->selectRaw('user_id, count(*) as n')->groupBy('user_id')->pluck('n', 'user_id');
        $counts['Registrations'] = $activity(['sample_registered']);
        $counts['Lab reports'] = $activity(['report_generated']);
        $counts['Report approvals'] = $activity(['report_approved']);
        $counts['Enquiry calls'] = DB::table('inquiry_activities')->whereNotNull('user_id')->where('created_at', '>=', $start)->where('created_at', '<', $end)
            ->where(fn ($q) => $q->whereNull('remark')->orWhereNotIn('remark', ['Enquiry created', 'Inquiry created', 'Details edited']))
            ->selectRaw('user_id, count(*) as n')->groupBy('user_id')->pluck('n', 'user_id');

        return response()->json(['data' => [
            'columns' => array_keys($counts),
            'users' => $people->map(fn (User $u) => [
                'user_id' => $u->id, 'name' => $u->name, 'attendance' => ! $u->isSuperAdmin(),
                'counts' => array_map(fn ($c) => (int) ($c[$u->id] ?? 0), $counts),
            ]),
        ]]);
    }

    // ─── Logins ──────────────────────────────────────────────────────────

    public function logins(Request $request): JsonResponse
    {
        $this->admin($request);
        [$start, $end] = WorkCalendar::bounds(...$this->range($request));
        $names = User::query()->get()->mapWithKeys(fn (User $u) => [$u->id => $u->name ?: $u->username]);
        $current = $request->user()->currentAccessToken()?->id;
        $tokens = DB::table('personal_access_tokens')->pluck('id')->flip();

        $sessions = LoginSession::query()
            ->where(fn ($q) => $q->where(fn ($q) => $q->where('logged_in_at', '>=', $start)->where('logged_in_at', '<', $end))
                // Still signed in from an earlier login
                ->orWhere(fn ($q) => $q->where('active', true)->where('last_seen_at', '>=', $start)))
            ->orderByDesc('logged_in_at')->limit(500)->get();

        return response()->json(['data' => [
            'sessions' => $sessions->map(fn (LoginSession $s): array => [
                'id' => $s->id, 'user_id' => $s->user_id, 'name' => $names[$s->user_id] ?? 'Deleted user',
                'device' => LoginSecurity::device($s->user_agent), 'ip' => $s->ip_address,
                'logged_in_at' => $s->logged_in_at?->toIso8601String(), 'last_seen_at' => $s->last_seen_at?->toIso8601String(), 'logged_out_at' => $s->logged_out_at?->toIso8601String(),
                'signed_in' => $s->active && isset($tokens[$s->personal_access_token_id]),
                'this_one' => $current !== null && (int) $s->personal_access_token_id === (int) $current,
            ]),
            'failed' => FailedLogin::query()->where('created_at', '>=', $start)->where('created_at', '<', $end)->orderByDesc('id')->limit(300)->get()
                ->map(fn (FailedLogin $f): array => [
                    'id' => $f->id, 'email' => $f->email, 'name' => $f->user_id ? ($names[$f->user_id] ?? null) : null,
                    'device' => LoginSecurity::device($f->user_agent), 'ip' => $f->ip_address, 'created_at' => $f->created_at->toIso8601String(),
                ]),
        ]]);
    }

    public function signOut(Request $request, LoginSession $session, LoginSecurity $security): JsonResponse
    {
        $this->admin($request);
        $security->signOut($session);

        return response()->json(['message' => 'Signed out']);
    }

    /** Signs a user out everywhere (the admin's own current login stays) */
    public function signOutUser(Request $request, User $user, LoginSecurity $security): JsonResponse
    {
        $this->admin($request);
        $current = $request->user()->currentAccessToken()?->id;
        LoginSession::query()->where('user_id', $user->id)->where('active', true)->get()
            ->reject(fn (LoginSession $s) => $current !== null && (int) $s->personal_access_token_id === (int) $current)
            ->each(fn (LoginSession $s) => $security->signOut($s));
        $user->tokens()->when($current, fn ($q) => $q->where('id', '!=', $current))->delete();

        return response()->json(['message' => 'Signed out']);
    }

    // ─── Corrections ─────────────────────────────────────────────────────

    public function corrections(Request $request): JsonResponse
    {
        $this->admin($request);
        $rows = AttendanceCorrection::query()->with(['user', 'decider'])->orderByRaw("status = 'pending' desc")->orderByDesc('id')->limit(200)->get();
        $recorded = Attendance::query()->whereIn('user_id', $rows->pluck('user_id')->unique())->whereIn('date', $rows->map(fn ($r) => $r->date->toDateString())->unique())
            ->orderBy('check_in_at')->get()->groupBy(fn (Attendance $a) => $a->user_id.'|'.$a->date->toDateString());

        return response()->json(['data' => $rows->map(fn (AttendanceCorrection $c) => AttendanceController::presentCorrection($c) + [
            'recorded' => $c->status === 'pending' ? ($recorded->get($c->user_id.'|'.$c->date->toDateString()) ?? collect())->map(fn (Attendance $a) => $this->book->present($a))->values() : [],
        ])]);
    }

    public function decideCorrection(Request $request, AttendanceCorrection $correction): JsonResponse
    {
        $this->admin($request);
        $values = $request->validate(['approve' => ['required', 'boolean'], 'remark' => ['nullable', 'string', 'max:480']]);
        $this->book->decideCorrection($correction, $request->user(), (bool) $values['approve'], $values['remark'] ?? null);

        return response()->json(['message' => 'Saved']);
    }

    // ─── Settings ────────────────────────────────────────────────────────

    public function settings(Request $request): JsonResponse
    {
        $this->admin($request);

        return response()->json(['data' => HrSetting::values(), 'users' => User::query()->where(fn ($q) => $q->whereNull('is_active')->orWhere('is_active', true))->orderBy('firstname')->get()->reject(fn (User $u) => $u->isSuperAdmin())->values()
            ->map(fn (User $u) => ['id' => $u->id, 'name' => $u->name ?: $u->username])]);
    }

    public function saveSettings(Request $request): JsonResponse
    {
        $this->admin($request);
        $values = $request->validate([
            'weekly_off' => ['present', 'array'],
            'weekly_off.*' => ['integer', 'between:0,6'],
            'saturdays_off' => ['present', 'array'],
            'saturdays_off.*' => ['integer', 'between:1,5'],
            'optional_limit' => ['required', 'integer', 'between:0,30'],
            'hidden_users' => ['present', 'array'],
            'hidden_users.*' => ['integer'],
            'office_lat' => ['nullable', 'numeric', 'between:-90,90', 'required_with:office_lng'],
            'office_lng' => ['nullable', 'numeric', 'between:-180,180', 'required_with:office_lat'],
            'office_radius' => ['required', 'integer', 'between:20,10000'],
            'daily_summary' => ['required', 'boolean'],
            'office_start' => ['required', 'date_format:H:i'],
        ]);
        foreach (['weekly_off', 'saturdays_off', 'hidden_users'] as $key) {
            $values[$key] = array_values(array_unique(array_map('intval', $values[$key])));
        }
        foreach (['office_lat', 'office_lng'] as $key) {
            $values[$key] = isset($values[$key]) ? (float) $values[$key] : null;
        }
        $values['optional_limit'] = (int) $values['optional_limit'];
        $values['office_radius'] = (int) $values['office_radius'];
        $values['daily_summary'] = (bool) $values['daily_summary'];
        HrSetting::put($values);

        return response()->json(['data' => HrSetting::values()]);
    }

    /** @return array{0: string, 1: string} */
    private function range(Request $request): array
    {
        $request->validate(['from' => ['required', 'date_format:Y-m-d'], 'to' => ['required', 'date_format:Y-m-d', 'after_or_equal:from']]);
        [$from, $to] = [(string) $request->query('from'), (string) $request->query('to')];
        abort_if(Carbon::parse($from)->diffInDays(Carbon::parse($to)) > 370, 422, 'Choose a year at most.');

        return [$from, $to];
    }

    private function admin(Request $request): void
    {
        abort_unless($request->user()->isFullAdmin(), 403, 'Only an administrator can see this.');
    }
}
