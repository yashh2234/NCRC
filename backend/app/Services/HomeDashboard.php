<?php

namespace App\Services;

use App\Http\Controllers\Api\MobileController;
use App\Models\Attendance;
use App\Models\Bill;
use App\Models\Holiday;
use App\Models\HrSetting;
use App\Models\Inquiry;
use App\Models\LeaveRequest;
use App\Models\Notification;
use App\Models\Quotation;
use App\Models\Report;
use App\Models\Tender;
use App\Models\User;
use App\Models\WorkOrder;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * The home dashboard: cards each user can pick and order (one layout for the computer and the phone).
 * A user only gets the cards of pages they can open; without a saved layout they see all of those.
 * The numbers follow the period: this month (so far), last month, or this year (so far); each is compared with
 * the same stretch of the period before.
 *
 * A card's data can hold (the app draws each kind):
 *  tiles  [{label, value, hint?, tone?, module?, spark?: number[], change?: %}]
 *  list   [{title, detail?, tone?, module?}]
 *  donut  {center, centerLabel, slices: [{label, value, color, module?}]}
 *  bars   [{label, value, max, text}]            progress bars
 *  funnel [{label, value}]
 *  stack  {parts: [{label, value, text}]}         one bar cut into parts
 *  hbars  [{label, value, text}]                  ranked bars
 *  people {keys: [{key, label, color}], rows: [{name, …counts}]}
 *  chart  [{month, enquiries, quotations, billed, received}]
 *  table  {columns, rows}
 * tone: good | warn | bad | null. color: a named colour the app maps (c1…c3, good, warn, bad, muted, age1…age4).
 */
class HomeDashboard
{
    /** key => [title, group, wide]. The order is the default order. */
    public const CARDS = [
        'my_day' => ['My day', 'For me', false],
        'approvals' => ['Waiting for my approval', 'For me', false],
        'my_work' => ['My work', 'For me', false],
        'quick_actions' => ['Quick actions', 'For me', false],
        'team_today' => ['Team today', 'Admin', false],
        'sales' => ['Sales', 'Business', false],
        'money' => ['Money', 'Business', false],
        'outstanding_age' => ['Outstanding by age', 'Business', false],
        'lab_reports' => ['Lab reports', 'Business', false],
        'tenders_wo' => ['Tenders & work orders', 'Business', false],
        'top_clients' => ['Top clients', 'Business', false],
        'enquiry_sources' => ['Enquiry sources', 'Business', false],
        'activity' => ['Recent activity', 'Admin', false],
        'attendance_month' => ['Attendance', 'Admin', true],
        'trends' => ['Trends', 'Admin', true],
        'who_did_what' => ['Who did what', 'Admin', true],
    ];

    /** Quick periods; "custom" takes from / to. Year and quarters are the financial year (April to March). */
    public const PERIODS = [
        'today' => 'Today', 'week' => 'This week', 'month' => 'This month', 'last_month' => 'Last month',
        'quarter' => 'This quarter', 'prev_quarter' => 'Previous quarter', 'year' => 'This year', 'custom' => 'Custom dates',
    ];

    /** What the ↑ / ↓ compare with */
    public const COMPARES = ['previous' => 'Previous period', 'last_year' => 'Same dates last year', 'none' => 'Off'];

    private const ENQUIRY_CLOSED = ['won', 'lost'];

    private const TENDER_CLOSED = ['Submitted', 'Won', 'Lost', 'Not Participated'];

    private const REPORT_DONE = ['Complete', 'Cancel'];

    /** The full value of an invoice, as the Invoice list shows it */
    private const FULL = 'ROUND(subtotal + cgst + sgst + igst + transport)';

    private string $today;

    private string $period = 'month';

    /** The period: from (inclusive) to (exclusive), and the same stretch before it */
    private string $from;

    private string $to;

    private string $prevFrom;

    private string $prevTo;

    private string $compare = 'previous';

    public function __construct(private AttendanceBook $book, private LeaveBook $leave)
    {
        $this->today = WorkCalendar::today();
        $this->setPeriod('month');
    }

    /**
     * The period from (inclusive) to (exclusive), and what it is compared with: the same length just before it,
     * or the same dates a year earlier. A period still running ends today, and is compared up to the same day.
     */
    private function setPeriod(string $period, ?string $from = null, ?string $to = null, string $compare = 'previous'): void
    {
        $this->period = array_key_exists($period, self::PERIODS) ? $period : 'month';
        $this->compare = array_key_exists($compare, self::COMPARES) ? $compare : 'previous';
        $today = Carbon::parse($this->today);
        $tomorrow = $today->copy()->addDay();
        // Financial year: from 1 April; its quarters start in April, July, October and January
        $fyStart = $today->copy()->month(4)->startOfMonth();
        if ($today->month < 4) {
            $fyStart->subYear();
        }
        $quarterStart = $fyStart->copy()->addMonths(intdiv($fyStart->diffInMonths($today->copy()->startOfMonth()), 3) * 3);

        if ($this->period === 'custom') {
            $a = $this->date($from) ?? $today->copy()->startOfMonth();
            $b = $this->date($to) ?? $today->copy();
            [$a, $b] = $a->gt($b) ? [$b, $a] : [$a, $b];
            [$start, $end] = [$a, $b->copy()->addDay()];
        } else {
            [$start, $end] = match ($this->period) {
                'today' => [$today->copy(), $tomorrow],
                'week' => [$today->copy()->startOfWeek(Carbon::MONDAY), $tomorrow],
                'last_month' => [$today->copy()->startOfMonth()->subMonth(), $today->copy()->startOfMonth()],
                'quarter' => [$quarterStart, $tomorrow],
                'prev_quarter' => [$quarterStart->copy()->subMonths(3), $quarterStart],
                'year' => [$fyStart, $tomorrow],
                default => [$today->copy()->startOfMonth(), $tomorrow],
            };
        }

        if ($this->compare === 'last_year') {
            [$prevStart, $prevEnd] = [$start->copy()->subYearNoOverflow(), $end->copy()->subYearNoOverflow()];
        } else {
            // Whole months / quarters: the whole one before; a running one: the one before up to the same day; else the same number of days
            [$prevStart, $prevEnd] = match ($this->period) {
                'week' => [$start->copy()->subWeek(), $end->copy()->subWeek()],
                'month', 'last_month' => [$start->copy()->subMonthNoOverflow(), $end->copy()->subMonthNoOverflow()],
                'quarter', 'prev_quarter' => [$start->copy()->subMonthsNoOverflow(3), $end->copy()->subMonthsNoOverflow(3)],
                'year' => [$start->copy()->subYearNoOverflow(), $end->copy()->subYearNoOverflow()],
                default => [$start->copy()->subDays($start->diffInDays($end)), $start->copy()],
            };
        }
        $this->from = $start->toDateString();
        $this->to = $end->toDateString();
        $this->prevFrom = $prevStart->toDateString();
        $this->prevTo = $prevEnd->toDateString();
    }

    private function date(?string $value): ?Carbon
    {
        return $value && preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) ? Carbon::parse($value) : null;
    }

    /** "1 Nov – 28 Nov 2026" */
    private function rangeText(string $from, string $to): string
    {
        $a = Carbon::parse($from);
        $b = Carbon::parse($to)->subDay();
        if ($a->isSameDay($b)) {
            return $a->format('j M Y');
        }

        return $a->format($a->year === $b->year ? 'j M' : 'j M Y').' – '.$b->format('j M Y');
    }

    /** Cards this user may pick */
    public function available(User $user): array
    {
        $admin = $user->isFullAdmin();
        $can = [
            'my_day' => true,
            'approvals' => $admin || $user->canApproveQuotations() || $user->canApproveBills() || $user->canApproveReports() || $user->canApproveLeave(),
            'my_work' => true,
            'quick_actions' => true,
            'team_today' => $admin,
            'sales' => $user->canOpen('inquiries') || $user->canOpen('quotations'),
            'money' => $user->canOpen('billing'),
            'outstanding_age' => $user->canOpen('billing'),
            'lab_reports' => $user->canOpen('reports'),
            'tenders_wo' => $user->canOpen('tenders') || $user->canOpen('work_orders'),
            'top_clients' => $user->canOpen('billing'),
            'enquiry_sources' => $user->canOpen('inquiries'),
            'activity' => $admin,
            'attendance_month' => $admin,
            'trends' => $admin,
            'who_did_what' => $admin,
        ];

        return array_keys(array_filter($can));
    }

    /** The saved order, without cards the user can no longer see; all available ones when nothing is saved */
    public function layout(User $user): array
    {
        $available = $this->available($user);
        $saved = $user->app_prefs['dashboard'] ?? null;
        if (! is_array($saved)) {
            return $available;
        }
        // Cards added to the app after the user saved their choice come at the end (switching them off is remembered)
        $seen = $user->app_prefs['dashboard_seen'] ?? $saved;
        $new = array_diff($available, (array) $seen);

        return array_values(array_merge(array_intersect($saved, $available), $new));
    }

    public function build(User $user, Request $request): array
    {
        $this->setPeriod((string) $request->query('period', 'month'), $request->query('from'), $request->query('to'), (string) $request->query('compare', 'previous'));
        $layout = $this->layout($user);
        $data = [];
        foreach ($layout as $key) {
            try {
                $data[$key] = $this->{'card'.str_replace('_', '', ucwords($key, '_'))}($user, $request);
            } catch (\Throwable $e) {
                report($e);
                $data[$key] = ['error' => 'Could not load this card.'];
            }
        }

        return [
            'cards' => collect($this->available($user))->map(fn ($key) => [
                'key' => $key, 'title' => self::CARDS[$key][0], 'group' => self::CARDS[$key][1], 'wide' => self::CARDS[$key][2],
            ])->values()->all(),
            'layout' => $layout,
            'customised' => is_array($user->app_prefs['dashboard'] ?? null),
            'period' => $this->period,
            'periods' => collect(self::PERIODS)->map(fn ($label, $key) => ['key' => $key, 'label' => $label])->values()->all(),
            'from' => $this->from,
            'to' => Carbon::parse($this->to)->subDay()->toDateString(),
            'range' => $this->rangeText($this->from, $this->to),
            'compareMode' => $this->compare,
            'compares' => collect(self::COMPARES)->map(fn ($label, $key) => ['key' => $key, 'label' => $label])->values()->all(),
            'compare' => $this->compare === 'none' ? '' : 'vs '.$this->rangeText($this->prevFrom, $this->prevTo),
            'data' => $data,
        ];
    }

    // ─── For me ──────────────────────────────────────────────────────

    private function cardMyDay(User $user): array
    {
        $tiles = [];
        $bars = [];
        if ($this->book->people()->contains('id', $user->id)) {
            $rows = Attendance::query()->where('user_id', $user->id)->where('date', $this->today)->orderBy('check_in_at')->get();
            $in = $rows->contains(fn (Attendance $a) => $a->check_out_at === null);
            $seconds = $this->book->worked($rows);
            $bars[] = ['label' => 'Worked today', 'value' => round($seconds / 3600, 1), 'max' => 8,
                'text' => $this->hours($seconds).($rows->isEmpty() ? ' · not checked in' : ($in ? ' · in since '.$rows->first()->check_in_at->setTimezone(WorkCalendar::ZONE)->format('H:i') : ' · checked out')),
                'tone' => $rows->isEmpty() ? 'warn' : 'good', 'module' => 'my_attendance'];
        }
        if (! $user->isSuperAdmin()) {
            $balances = $this->leave->balances($user->id, (int) substr($this->today, 0, 4))->filter(fn ($b) => $b['quota'] !== null && $b['quota'] > 0 && ! $b['granted']);
            if ($balances->isNotEmpty()) {
                $used = $balances->sum(fn ($b) => $b['taken'] + $b['pending']);
                $total = $balances->sum('quota');
                $bars[] = ['label' => 'Leave used this year', 'value' => $used, 'max' => $total,
                    'text' => $this->num($used).' of '.$this->num($total).' days · '.$balances->map(fn ($b) => $b['code'].' '.$this->num((float) $b['left']).' left')->implode(', '), 'module' => 'leave'];
            }
            $mine = LeaveRequest::query()->where('user_id', $user->id)->where('status', 'pending')->count();
            if ($mine) {
                $tiles[] = ['label' => 'My leave waiting', 'value' => $mine, 'tone' => 'warn', 'module' => 'leave'];
            }
        }
        $holiday = Holiday::query()->where('type', 'holiday')->where('date', '>=', $this->today)->orderBy('date')->first();
        if ($holiday) {
            $days = Carbon::parse($this->today)->diffInDays($holiday->date);
            $tiles[] = ['label' => 'Next holiday', 'value' => $holiday->date->format('d M'), 'hint' => $holiday->name.($days ? " · in {$days} days" : ' · today'), 'module' => 'holidays'];
        }

        return ['bars' => $bars, 'tiles' => $tiles];
    }

    private function cardApprovals(User $user, Request $request): array
    {
        $res = app(MobileController::class)->approvals($request)->getData(true);
        $items = collect($res['data'] ?? []);
        $labels = ['quotation' => 'Quotations', 'bill' => 'Invoices', 'credit_note' => 'Credit notes', 'performa' => 'Performa', 'report' => 'Reports', 'leave' => 'Leave', 'attendance' => 'Attendance'];
        $modules = ['quotation' => 'quotations', 'bill' => 'billing', 'credit_note' => 'credit_notes', 'performa' => 'performa', 'report' => 'reports', 'leave' => 'leave', 'attendance' => 'team'];
        $tiles = $items->countBy('kind')->map(fn ($n, $kind) => ['label' => $labels[$kind] ?? ucfirst($kind), 'value' => $n, 'tone' => 'warn', 'module' => $modules[$kind] ?? null])->values()->all();

        return [
            'tiles' => $tiles ?: [['label' => 'Waiting for me', 'value' => 0, 'hint' => 'All done', 'tone' => 'good']],
            'list' => $items->take(4)->map(fn ($i) => ['title' => $i['title'], 'detail' => $i['detail'] ?? null, 'module' => $i['module'] ?? null])->values()->all(),
            'approvals' => true,
        ];
    }

    private function cardMyWork(User $user): array
    {
        $tiles = [];
        $list = [];
        if ($user->canOpen('inquiries')) {
            $mine = Inquiry::query()->where('assigned_to', $user->id)->whereNotIn('status', self::ENQUIRY_CLOSED);
            $due = (clone $mine)->whereNotNull('next_follow_up')->where('next_follow_up', '<=', $this->today)->orderBy('next_follow_up')->get();
            $tiles[] = ['label' => 'Enquiries with me', 'value' => (clone $mine)->count(), 'module' => 'inquiries'];
            $tiles[] = ['label' => 'Follow-ups due', 'value' => $due->count(), 'tone' => $due->isNotEmpty() ? 'warn' : 'good', 'module' => 'inquiries'];
            foreach ($due->take(3) as $i) {
                $late = $i->next_follow_up->toDateString() < $this->today;
                $list[] = ['title' => "{$i->inquiry_no} · {$i->client_name}", 'detail' => $late ? 'Overdue since '.$i->next_follow_up->format('d M') : 'Today', 'tone' => $late ? 'bad' : 'warn', 'module' => 'inquiries'];
            }
        }
        if ($user->canOpen('reports') || $user->canOpen('lab')) {
            $reports = Report::query()->where('assigned_to', $user->id)->whereNotIn('status', self::REPORT_DONE)->count();
            $tiles[] = ['label' => 'Reports with me', 'value' => $reports, 'module' => $user->canOpen('lab') ? 'lab' : 'reports'];
        }
        $back = Quotation::query()->where('approval', 'returned')->where('approval_requested_by', $user->id)->get(['quotation_no', 'approval_remark']);
        $backBills = Bill::query()->where('approval', 'returned')->where('approval_requested_by', $user->id)->get(['invoice_no', 'approval_remark']);
        if ($back->isNotEmpty() || $backBills->isNotEmpty()) {
            $tiles[] = ['label' => 'Sent back to me', 'value' => $back->count() + $backBills->count(), 'tone' => 'bad', 'module' => $back->isNotEmpty() ? 'quotations' : 'billing'];
            foreach ($back->take(2) as $q) {
                $list[] = ['title' => "Quotation {$q->quotation_no} sent back", 'detail' => $q->approval_remark, 'tone' => 'bad', 'module' => 'quotations'];
            }
            foreach ($backBills->take(2) as $b) {
                $list[] = ['title' => "Invoice {$b->invoice_no} sent back", 'detail' => $b->approval_remark, 'tone' => 'bad', 'module' => 'billing'];
            }
        }

        return ['tiles' => $tiles, 'list' => $list, 'empty' => $tiles ? null : 'Nothing assigned to you right now.'];
    }

    /** The buttons are made in the app (from the pages the user can open) */
    private function cardQuickActions(): array
    {
        return [];
    }

    // ─── Business ────────────────────────────────────────────────────

    private function cardSales(User $user): array
    {
        $tiles = [];
        $funnel = [];
        $bars = [];
        if ($user->canOpen('inquiries')) {
            $count = fn (string $from, string $to) => Inquiry::query()->where('created_at', '>=', $from)->where('created_at', '<', $to)->count();
            $made = $count($this->from, $this->to);
            $tiles[] = $this->compared('New enquiries', $made, $count($this->prevFrom, $this->prevTo), $this->monthly($count), 'inquiries');
            $funnel[] = ['label' => 'Enquiries', 'value' => $made];
            $period = Inquiry::query()->where('created_at', '>=', $this->from)->where('created_at', '<', $this->to);
            $won = (clone $period)->where('status', 'won')->count();
            $lost = (clone $period)->where('status', 'lost')->count();
            if ($won + $lost) {
                $bars[] = ['label' => 'Conversion rate', 'value' => $won, 'max' => $won + $lost, 'text' => round($won / ($won + $lost) * 100)."% · {$won} converted, {$lost} not interested", 'tone' => 'good', 'module' => 'inquiries'];
            }
        }
        if ($user->canOpen('quotations')) {
            $sent = fn (string $from, string $to) => Quotation::query()->where('date', '>=', $from)->where('date', '<', $to)->whereIn('status', ['sent', 'accepted', 'rejected'])->count();
            $value = fn (string $from, string $to) => (float) Quotation::query()->where('date', '>=', $from)->where('date', '<', $to)->where('status', 'accepted')->sum('net_amount');
            $sentNow = $sent($this->from, $this->to);
            $accepted = Quotation::query()->where('date', '>=', $this->from)->where('date', '<', $this->to)->where('status', 'accepted')->count();
            $tiles[] = $this->compared('Quotations sent', $sentNow, $sent($this->prevFrom, $this->prevTo), $this->monthly($sent), 'quotations');
            $tiles[] = $this->compared('Accepted value', $value($this->from, $this->to), $value($this->prevFrom, $this->prevTo), $this->monthly($value), 'quotations', true);
            $funnel[] = ['label' => 'Quotations sent', 'value' => $sentNow];
            $funnel[] = ['label' => 'Accepted', 'value' => $accepted];
        }

        return ['tiles' => $tiles, 'funnel' => count($funnel) > 1 ? $funnel : [], 'bars' => $bars, 'module' => $user->canOpen('inquiries') ? 'inquiries' : 'quotations'];
    }

    private function cardMoney(): array
    {
        $live = fn () => Bill::query()->whereNull('cancelled_at');
        $billed = fn (string $from, string $to) => (float) $live()->where('invoice_date', '>=', $from)->where('invoice_date', '<', $to)->sum(DB::raw(self::FULL));
        $received = fn (string $from, string $to) => (float) $live()->where('received_date', '>=', $from)->where('received_date', '<', $to)->sum('amount_received');
        $b = $billed($this->from, $this->to);
        $r = $received($this->from, $this->to);
        $due = $this->dueRows();

        return [
            'tiles' => [
                $this->compared('Billed', $b, $billed($this->prevFrom, $this->prevTo), $this->monthly($billed), 'billing', true),
                $this->compared('Received', $r, $received($this->prevFrom, $this->prevTo), $this->monthly($received), 'billing', true, 'good'),
                ['label' => 'Outstanding now', 'value' => $this->money($due->sum('due')), 'hint' => $due->count().' invoices', 'tone' => $due->isNotEmpty() ? 'warn' : 'good', 'module' => 'billing'],
            ],
            'bars' => $b > 0 ? [['label' => 'Received of billed', 'value' => min($r, $b), 'max' => $b, 'text' => round(min($r, $b) / $b * 100).'% · '.$this->money($r).' of '.$this->money($b), 'tone' => 'good', 'module' => 'billing']] : [],
            'module' => 'billing',
        ];
    }

    private function cardOutstandingAge(): array
    {
        $due = $this->dueRows();
        $age = fn ($row) => $row['date'] ? Carbon::parse($row['date'])->diffInDays(Carbon::parse($this->today)) : 0;
        $buckets = [['0–30 days', 0, 30], ['31–60 days', 31, 60], ['61–90 days', 61, 90], ['90+ days', 91, PHP_INT_MAX]];
        $parts = [];
        foreach ($buckets as $i => [$label, $min, $max]) {
            $sum = $due->filter(fn ($r) => $age($r) >= $min && $age($r) <= $max)->sum('due');
            $parts[] = ['label' => $label, 'value' => round($sum), 'text' => $this->money($sum), 'color' => 'age'.($i + 1)];
        }
        $old = $due->filter(fn ($r) => $age($r) > 30)->sortBy('date');

        return [
            'stack' => ['parts' => $parts, 'total' => $this->money($due->sum('due')).' outstanding'],
            'list' => $old->take(3)->map(fn ($r) => ['title' => "{$r['no']} · {$r['client']}", 'detail' => $this->money($r['due']).' · '.$age($r).' days', 'tone' => 'bad', 'module' => 'billing'])->values()->all(),
            'empty' => $due->isEmpty() ? 'Nothing outstanding.' : null,
            'module' => 'billing',
        ];
    }

    private function cardTopClients(): array
    {
        $rows = Bill::query()->whereNull('cancelled_at')->where('invoice_date', '>=', $this->from)->where('invoice_date', '<', $this->to)
            ->whereNotNull('client_name')->selectRaw('client_name, SUM('.self::FULL.') total, COUNT(*) n')->groupBy('client_name')->orderByDesc('total')->limit(5)->get();

        return [
            'hbars' => $rows->map(fn ($r) => ['label' => (string) $r->client_name, 'value' => round((float) $r->total), 'text' => $this->money((float) $r->total).' · '.$r->n.' invoice'.($r->n > 1 ? 's' : '')])->values()->all(),
            'empty' => $rows->isEmpty() ? 'No invoices in this period.' : null,
            'module' => 'billing',
        ];
    }

    private function cardEnquirySources(): array
    {
        $rows = Inquiry::query()->where('created_at', '>=', $this->from)->where('created_at', '<', $this->to)
            ->selectRaw("COALESCE(NULLIF(TRIM(source), ''), 'Not recorded') src, COUNT(*) n")->groupBy('src')->orderByDesc('n')->get();
        $total = max(1, (int) $rows->sum('n'));

        return [
            'hbars' => $rows->take(6)->map(fn ($r) => ['label' => (string) $r->src, 'value' => (int) $r->n, 'text' => $r->n.' · '.round($r->n / $total * 100).'%'])->values()->all(),
            'empty' => $rows->isEmpty() ? 'No enquiries in this period.' : null,
            'module' => 'inquiries',
        ];
    }

    private function cardLabReports(): array
    {
        $open = Report::query()->whereNotIn('status', self::REPORT_DONE);
        $counts = (clone $open)->selectRaw('status, count(*) c')->groupBy('status')->pluck('c', 'status');
        $oldest = (clone $open)->orderBy('create_date')->limit(3)->get(['uid_no', 'status', 'create_date']);
        $approved = fn (string $from, string $to) => Report::query()->where('status', 'Complete')->where('approved_at', '>=', $from)->where('approved_at', '<', $to)->count();
        $slices = [
            ['label' => 'Pending', 'value' => (int) ($counts['Pending'] ?? 0), 'color' => 'c1', 'module' => 'reports'],
            ['label' => 'Testing', 'value' => (int) ($counts['Testing'] ?? 0), 'color' => 'c2', 'module' => 'reports'],
            ['label' => 'Waiting approval', 'value' => (int) ($counts['Report Generated'] ?? 0), 'color' => 'c3', 'module' => 'reports'],
        ];

        return [
            'donut' => ['center' => array_sum(array_column($slices, 'value')), 'centerLabel' => 'open now', 'slices' => $slices],
            'tiles' => [$this->compared('Approved', $approved($this->from, $this->to), $approved($this->prevFrom, $this->prevTo), $this->monthly($approved), 'reports', false, 'good')],
            'list' => $oldest->map(fn (Report $r) => ['title' => "{$r->uid_no} · {$r->status}",
                'detail' => $r->create_date ? 'Since '.$r->create_date->format('d M').' ('.$r->create_date->diffInDays(now()).' days)' : null,
                'tone' => $r->create_date && $r->create_date->lt(now()->subDays(2)) ? 'bad' : null, 'module' => 'reports'])->values()->all(),
            'module' => 'reports',
        ];
    }

    private function cardTendersWo(User $user): array
    {
        $tiles = [];
        $list = [];
        if ($user->canOpen('tenders')) {
            $open = Tender::query()->where('closing_date', '>=', $this->today)
                ->where(fn ($q) => $q->whereNull('submission_status')->orWhereNotIn('submission_status', self::TENDER_CLOSED));
            $week = (clone $open)->where('closing_date', '<=', Carbon::parse($this->today)->addDays(7)->toDateString())->orderBy('closing_date')->get();
            $tiles[] = ['label' => 'Closing in 7 days', 'value' => $week->count(), 'tone' => $week->isNotEmpty() ? 'warn' : null, 'module' => 'tenders'];
            $tiles[] = ['label' => 'Open tenders', 'value' => (clone $open)->count(), 'module' => 'tenders'];
            foreach ($week->take(3) as $t) {
                $date = substr((string) $t->closing_date, 0, 10);
                $list[] = ['title' => ($t->tender_id ?: $t->sr_no).' · '.mb_strimwidth((string) $t->title, 0, 60, '…'),
                    'detail' => $date === $this->today ? 'Closes today' : 'Closes '.Carbon::parse($date)->format('d M'), 'tone' => $date === $this->today ? 'bad' : 'warn', 'module' => 'tenders'];
            }
        }
        if ($user->canOpen('work_orders')) {
            $made = fn (string $from, string $to) => WorkOrder::query()->where('created_at', '>=', $from)->where('created_at', '<', $to)->count();
            $tiles[] = ['label' => 'Open work orders', 'value' => WorkOrder::query()->whereNotIn('status', ['completed', 'cancelled', 'closed'])->count(), 'module' => 'work_orders'];
            $tiles[] = $this->compared('New work orders', $made($this->from, $this->to), $made($this->prevFrom, $this->prevTo), $this->monthly($made), 'work_orders');
        }

        return ['tiles' => $tiles, 'list' => $list, 'module' => $user->canOpen('tenders') ? 'tenders' : 'work_orders'];
    }

    // ─── Admin ───────────────────────────────────────────────────────

    private function cardTeamToday(): array
    {
        $groups = $this->book->daySummary($this->today);
        if ($groups === null) {
            return ['empty' => 'Today is a holiday.', 'module' => 'team'];
        }
        $late = [];
        $firsts = Attendance::query()->where('date', $this->today)->orderBy('check_in_at')->get()->unique('user_id');
        $names = User::query()->whereIn('id', $firsts->pluck('user_id'))->get()->keyBy('id');
        foreach ($firsts as $row) {
            if ($this->book->lateBy($row)) {
                $late[] = $names[$row->user_id]?->name;
            }
        }
        $late = array_values(array_filter($late));
        $onTime = count($groups['present']) - count($late);
        $away = count($groups['on_leave']) + count($groups['on_duty']);

        return [
            'donut' => ['center' => count($groups['present']), 'centerLabel' => 'of '.(count($groups['present']) + $away + count($groups['not_in'])).' in', 'slices' => [
                ['label' => 'On time', 'value' => max(0, $onTime), 'color' => 'good', 'module' => 'team'],
                ['label' => 'Late', 'value' => count($late), 'color' => 'warn', 'module' => 'team'],
                ['label' => 'Leave / on duty', 'value' => $away, 'color' => 'muted', 'module' => 'leave'],
                ['label' => 'Not in yet', 'value' => count($groups['not_in']), 'color' => 'bad', 'module' => 'team'],
            ]],
            'list' => array_values(array_filter([
                $groups['not_in'] ? ['title' => 'Not in yet', 'detail' => implode(', ', $groups['not_in']), 'tone' => 'bad', 'module' => 'team'] : null,
                $late ? ['title' => 'Late', 'detail' => implode(', ', $late), 'tone' => 'warn', 'module' => 'team'] : null,
            ])),
            'module' => 'team',
        ];
    }

    /** Per person in the period: days present (on time / late), on leave, absent */
    private function cardAttendanceMonth(): array
    {
        $people = $this->book->people();
        $until = min(Carbon::parse($this->to)->subDay()->toDateString(), $this->today);
        if ($people->isEmpty() || $until < $this->from) {
            return ['empty' => 'No attendance in this period.', 'module' => 'team'];
        }
        $days = $this->book->days($people->pluck('id')->all(), $this->from, $until);
        $start = HrSetting::values()['office_start'] ?? '09:30';
        // First check in of each person each day
        $firsts = Attendance::query()->whereIn('user_id', $people->pluck('id'))->whereBetween('date', [$this->from, $until])
            ->selectRaw('user_id, date, MIN(check_in_at) first_in')->groupBy('user_id', 'date')->get()
            ->mapWithKeys(fn ($r) => [$r->user_id.'|'.substr((string) $r->date, 0, 10) => $r->first_in]);
        $rows = [];
        foreach ($people as $user) {
            $row = ['name' => $user->name, 'on_time' => 0, 'late' => 0, 'leave' => 0, 'absent' => 0];
            foreach ($days[$user->id] ?? [] as $date => $day) {
                $status = $day['status'];
                if (in_array($status, ['present', 'on_duty'], true)) {
                    $first = $firsts[$user->id.'|'.$date] ?? null;
                    $isLate = $first && $day['off'] === null && Carbon::parse($first)->setTimezone(WorkCalendar::ZONE)->format('H:i') > $start;
                    $row[$isLate ? 'late' : 'on_time']++;
                } elseif ($status === 'leave') {
                    $row['leave']++;
                } elseif ($status === 'half_leave') {
                    $row['leave'] += 0.5;
                    $row['on_time'] += 0.5;
                } elseif (in_array($status, ['absent', 'not_in'], true) && $date < $this->today) {
                    $row['absent']++;
                }
            }
            $rows[] = $row;
        }

        return [
            'people' => ['keys' => [
                ['key' => 'on_time', 'label' => 'On time', 'color' => 'good'],
                ['key' => 'late', 'label' => 'Late', 'color' => 'warn'],
                ['key' => 'leave', 'label' => 'Leave', 'color' => 'muted'],
                ['key' => 'absent', 'label' => 'Absent', 'color' => 'bad'],
            ], 'rows' => $rows],
            'module' => 'team',
        ];
    }

    private function cardActivity(User $user): array
    {
        $rows = Notification::query()->where('user_id', $user->id)
            ->where(fn ($q) => $q->where('type', 'like', 'team\_%')->orWhere('type', 'like', 'activity\_%'))
            ->latest('id')->limit(8)->get();

        return [
            'list' => $rows->map(fn (Notification $n) => [
                'title' => $n->title, 'detail' => trim(($n->message ? $n->message.' · ' : '').$n->created_at?->setTimezone(WorkCalendar::ZONE)->format('d M H:i'), ' ·'),
                'module' => str_starts_with($n->type, 'team_') ? 'team' : substr($n->type, strlen('activity_')),
            ])->values()->all(),
            'empty' => $rows->isEmpty() ? 'Nothing new yet. New enquiries, quotations, check ins… show here.' : null,
        ];
    }

    /** By month: 12 months for "this year", else 6 */
    private function cardTrends(): array
    {
        $count = $this->period === 'year' || Carbon::parse($this->from)->diffInMonths(Carbon::parse($this->to)) > 6 ? 12 : 6;
        $end = Carbon::parse($this->to)->subDay()->startOfMonth();
        $months = [];
        for ($i = $count - 1; $i >= 0; $i--) {
            $months[] = $end->copy()->subMonths($i);
        }
        $from = $months[0]->toDateString();
        $to = $end->copy()->addMonth()->toDateString();
        $key = fn ($date) => substr((string) $date, 0, 7);
        $enquiries = Inquiry::query()->where('created_at', '>=', $from)->where('created_at', '<', $to)->pluck('created_at')->map($key)->countBy();
        $quotations = Quotation::query()->where('date', '>=', $from)->where('date', '<', $to)->pluck('date')->map($key)->countBy();
        $billed = Bill::query()->whereNull('cancelled_at')->where('invoice_date', '>=', $from)->where('invoice_date', '<', $to)->get(['invoice_date', 'subtotal', 'cgst', 'sgst', 'igst', 'transport'])
            ->groupBy(fn (Bill $b) => $key($b->invoice_date))->map(fn ($l) => $l->sum(fn (Bill $b) => round($b->subtotal + $b->cgst + $b->sgst + $b->igst + $b->transport)));
        $received = Bill::query()->whereNull('cancelled_at')->where('received_date', '>=', $from)->where('received_date', '<', $to)->get(['received_date', 'amount_received'])
            ->groupBy(fn (Bill $b) => $key($b->received_date))->map(fn ($l) => $l->sum('amount_received'));

        return ['chart' => collect($months)->map(fn (Carbon $m) => [
            'month' => $m->format($count > 6 ? 'M' : 'M y'),
            'enquiries' => (int) ($enquiries[$m->format('Y-m')] ?? 0),
            'quotations' => (int) ($quotations[$m->format('Y-m')] ?? 0),
            'billed' => round((float) ($billed[$m->format('Y-m')] ?? 0)),
            'received' => round((float) ($received[$m->format('Y-m')] ?? 0)),
        ])->values()->all()];
    }

    private function cardWhoDidWhat(): array
    {
        $per = fn ($query, string $column = 'created_by') => $query->whereNotNull($column)->selectRaw("{$column} as uid, count(*) c")->groupBy($column)->pluck('c', 'uid');
        $columns = [
            'enquiries' => $per(Inquiry::query()->where('created_at', '>=', $this->from)->where('created_at', '<', $this->to)),
            'quotations' => $per(Quotation::query()->where('date', '>=', $this->from)->where('date', '<', $this->to)),
            'invoices' => $per(Bill::query()->where('invoice_date', '>=', $this->from)->where('invoice_date', '<', $this->to)),
            'work_orders' => $per(WorkOrder::query()->where('created_at', '>=', $this->from)->where('created_at', '<', $this->to)),
            'reports' => $per(Report::query()->where('status', 'Complete')->where('approved_at', '>=', $this->from)->where('approved_at', '<', $this->to), 'assigned_to'),
        ];
        $ids = collect($columns)->flatMap(fn ($c) => $c->keys())->unique();
        $rows = User::query()->whereIn('id', $ids)->get()->map(fn (User $u) => ['name' => $u->name] + collect($columns)->map(fn ($c) => (int) ($c[$u->id] ?? 0))->all())
            ->sortByDesc(fn ($r) => $r['enquiries'] + $r['quotations'] + $r['invoices'] + $r['work_orders'] + $r['reports'])->values()->all();

        return [
            'table' => ['columns' => [['key' => 'enquiries', 'label' => 'Enquiries'], ['key' => 'quotations', 'label' => 'Quotations'], ['key' => 'invoices', 'label' => 'Invoices'],
                ['key' => 'work_orders', 'label' => 'Work orders'], ['key' => 'reports', 'label' => 'Reports done']], 'rows' => $rows],
            'empty' => $rows ? null : 'Nothing made in this period yet.',
        ];
    }

    // ─── Helpers ─────────────────────────────────────────────────────

    /** Unpaid invoices: [no, client, date, due] */
    private function dueRows(): Collection
    {
        return Bill::query()->whereNull('cancelled_at')->whereRaw(self::FULL.' - amount_received > 0')
            ->get(['invoice_no', 'client_name', 'invoice_date', 'subtotal', 'cgst', 'sgst', 'igst', 'transport', 'amount_received'])
            ->map(fn (Bill $b) => [
                'no' => $b->invoice_no, 'client' => $b->client_name, 'date' => $b->invoice_date?->toDateString(),
                'due' => max(0, round($b->subtotal + $b->cgst + $b->sgst + $b->igst + $b->transport) - $b->amount_received),
            ]);
    }

    /** A number tile with its change against the same stretch before, and a small line of the last months */
    private function compared(string $label, float $now, float $before, array $spark, string $module, bool $money = false, ?string $tone = null): array
    {
        return [
            'label' => $label, 'value' => $money ? $this->money($now) : (int) $now, 'tone' => $tone, 'module' => $module,
            'change' => $this->compare !== 'none' && $before > 0 ? (int) round(($now - $before) / $before * 100) : null,
            'hint' => $this->compare === 'none' || $before > 0 ? null : ($now > 0 ? 'none before' : null),
            'spark' => $spark,
        ];
    }

    /** The value of each of the last 6 months (up to the period's last month): for the small lines */
    private function monthly(\Closure $value): array
    {
        $end = Carbon::parse($this->to)->subDay()->startOfMonth();
        $out = [];
        for ($i = 5; $i >= 0; $i--) {
            $m = $end->copy()->subMonths($i);
            $out[] = round((float) $value($m->toDateString(), $m->copy()->addMonth()->toDateString()), 2);
        }

        return $out;
    }

    /** ₹2.4L, ₹1.2Cr, ₹45,000 */
    private function money(float $amount): string
    {
        return match (true) {
            $amount >= 10000000 => '₹'.$this->num($amount / 10000000, 2).'Cr',
            $amount >= 100000 => '₹'.$this->num($amount / 100000, 1).'L',
            default => '₹'.number_format($amount),
        };
    }

    private function num(float $n, int $decimals = 1): string
    {
        return rtrim(rtrim(number_format($n, $decimals, '.', ''), '0'), '.');
    }

    private function hours(int $seconds): string
    {
        return intdiv($seconds, 3600).'h '.str_pad((string) intdiv($seconds % 3600, 60), 2, '0', STR_PAD_LEFT).'m';
    }
}
