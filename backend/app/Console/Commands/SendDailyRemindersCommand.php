<?php

namespace App\Console\Commands;

use App\Models\Bill;
use App\Models\Inquiry;
use App\Models\LeaveRequest;
use App\Models\Notification;
use App\Models\PerformaInvoice;
use App\Models\Quotation;
use App\Models\Report;
use App\Models\Tender;
use App\Models\User;
use App\Services\AttendanceBook;
use App\Services\WorkCalendar;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * Morning reminders on working days (bell + phone; each kind has its own switch in Phone alerts):
 * enquiry follow-ups due, tenders closing in 3 days or today, invoices unpaid 30 / 60 / 90 days after their date,
 * lab reports pending more than 2 days, and approvals waiting more than a day.
 */
class SendDailyRemindersCommand extends Command
{
    protected $signature = 'notify:reminders {--force : Also on a holiday or weekly off}';

    protected $description = 'Morning reminders: follow-ups, tenders closing, unpaid invoices, pending reports and approvals';

    /** Enquiries with these are finished: no follow-up */
    private const ENQUIRY_CLOSED = ['won', 'lost'];

    private const TENDER_CLOSED = ['Submitted', 'Won', 'Lost', 'Not Participated'];

    private const REPORT_DONE = ['Complete', 'Cancel'];

    private string $today;

    /** @var Collection<int, User> */
    private Collection $users;

    public function handle(WorkCalendar $calendar): int
    {
        $this->today = WorkCalendar::today();
        if (! $this->option('force') && ($calendar->isWeeklyOff($this->today) || $calendar->holidays($this->today, $this->today))) {
            return self::SUCCESS;
        }
        $this->users = User::query()->get()->filter(fn (User $u) => $u->is_active !== false)->keyBy('id');
        $admins = AttendanceBook::admins()->pluck('id')->map(fn ($id) => (int) $id)->all();

        $this->followUps($admins);
        $this->tenders($admins);
        $this->invoices($admins);
        $this->reports($admins);
        $this->approvals();

        return self::SUCCESS;
    }

    /** @param  int[]  $admins */
    private function followUps(array $admins): void
    {
        $due = Inquiry::query()->whereNotIn('status', self::ENQUIRY_CLOSED)->whereNotNull('next_follow_up')
            ->where('next_follow_up', '<=', $this->today)->orderBy('next_follow_up')->get();
        if ($due->isEmpty()) {
            return;
        }
        $text = fn (Collection $list) => $list->take(8)->map(fn (Inquiry $i) => "{$i->inquiry_no} {$i->client_name}"
            .($i->next_follow_up->toDateString() < $this->today ? ' (overdue)' : ''))->implode(' · ').($list->count() > 8 ? ' · …' : '');

        // Each person their own; admins all of them
        foreach ($due->groupBy(fn (Inquiry $i) => (int) ($i->assigned_to ?: $i->created_by)) as $userId => $list) {
            if ($userId && ! in_array($userId, $admins, true)) {
                $this->send([$userId], 'remind_followup', $list->count().' enquiry follow-up'.($list->count() > 1 ? 's' : '').' due', $text($list));
            }
        }
        $this->send($admins, 'remind_followup', $due->count().' enquiry follow-up'.($due->count() > 1 ? 's' : '').' due', $text($due));
    }

    /** @param  int[]  $admins */
    private function tenders(array $admins): void
    {
        $in3 = Carbon::parse($this->today)->addDays(3)->toDateString();
        $closing = Tender::query()->whereIn('closing_date', [$this->today, $in3])
            ->where(fn ($q) => $q->whereNull('submission_status')->orWhereNotIn('submission_status', self::TENDER_CLOSED))->get();
        foreach ($closing as $t) {
            $when = substr((string) $t->closing_date, 0, 10) === $this->today ? 'closes today' : 'closes in 3 days';
            $time = $t->closing_time ? ' at '.substr((string) $t->closing_time, 0, 5) : '';
            $to = array_merge($admins, $t->created_by ? [(int) $t->created_by] : []);
            $this->send($to, 'remind_tender', 'Tender '.($t->tender_id ?: $t->sr_no)." {$when}{$time}",
                mb_strimwidth(implode(' · ', array_filter([$t->title, $t->department, $t->submission_status ? "status: {$t->submission_status}" : 'not submitted yet'])), 0, 380, '…'), ['id' => $t->id]);
        }
    }

    /** @param  int[]  $admins */
    private function invoices(array $admins): void
    {
        $dates = array_map(fn ($d) => Carbon::parse($this->today)->subDays($d)->toDateString(), [30, 60, 90]);
        $bills = Bill::query()->whereNull('cancelled_at')->whereIn('invoice_date', $dates)->get();
        foreach ($bills as $b) {
            $full = round($b->subtotal + $b->cgst + $b->sgst + $b->igst + $b->transport);
            $due = round(max(0, $full - $b->amount_received), 2);
            if ($due <= 0) {
                continue;
            }
            $days = Carbon::parse($b->invoice_date->toDateString())->diffInDays(Carbon::parse($this->today));
            $this->send($admins, 'remind_invoice', "Invoice {$b->invoice_no} unpaid {$days} days",
                implode(' · ', array_filter([$b->client_name, '₹'.number_format($due).' due', $b->uid_no ? "UID {$b->uid_no}" : null])), ['bill_id' => $b->id]);
        }
    }

    /** @param  int[]  $admins */
    private function reports(array $admins): void
    {
        $before = Carbon::now()->subDays(2);
        $pending = Report::query()->whereNotIn('status', self::REPORT_DONE)->where('create_date', '<', $before)->orderBy('create_date')->get();
        if ($pending->isEmpty()) {
            return;
        }
        $text = fn (Collection $list) => $list->take(10)->map(fn (Report $r) => "{$r->uid_no} ({$r->status})")->implode(' · ').($list->count() > 10 ? ' · …' : '');
        foreach ($pending->groupBy(fn (Report $r) => (int) $r->assigned_to) as $userId => $list) {
            if ($userId && ! in_array($userId, $admins, true)) {
                $this->send([$userId], 'remind_report', $list->count().' report'.($list->count() > 1 ? 's' : '').' pending more than 2 days', $text($list));
            }
        }
        $this->send($admins, 'remind_report', $pending->count().' report'.($pending->count() > 1 ? 's' : '').' pending more than 2 days', $text($pending));
    }

    /** One message to each approver: what has waited more than a day */
    private function approvals(): void
    {
        $before = Carbon::now()->subDay();
        $waiting = [
            ['Quotation', fn (User $u) => $u->canApproveQuotations(), Quotation::query()->where('approval', 'pending')->where('approval_requested_at', '<', $before)->pluck('quotation_no')],
            ['Invoice', fn (User $u) => $u->canApproveBills(), Bill::query()->where('approval', 'pending')->where('approval_requested_at', '<', $before)->pluck('invoice_no')],
            ['Credit note', fn (User $u) => $u->canApproveBills(), Bill::query()->where('cn_approval', 'pending')->where('cn_approval_requested_at', '<', $before)->pluck('credit_note_no')],
            ['Performa', fn (User $u) => $u->canApproveBills(), PerformaInvoice::query()->where('approval', 'pending')->where('approval_requested_at', '<', $before)->pluck('invoice_no')],
            ['Leave', fn (User $u) => $u->canApproveLeave(), LeaveRequest::query()->where('status', 'pending')->where('created_at', '<', $before)->pluck('id')->map(fn () => '')],
        ];
        foreach ($this->users as $user) {
            $parts = [];
            $total = 0;
            foreach ($waiting as [$label, $can, $list]) {
                if ($list->isNotEmpty() && $can($user)) {
                    $total += $list->count();
                    $nos = $list->filter()->take(5)->implode(', ');
                    $parts[] = $list->count().' '.strtolower($label).($list->count() > 1 ? 's' : '').($nos !== '' ? " ({$nos})" : '');
                }
            }
            if ($total) {
                $this->send([(int) $user->id], 'remind_approval', "{$total} waiting for your approval more than a day", implode(' · ', $parts));
            }
        }
    }

    /** @param  int[]  $userIds */
    private function send(array $userIds, string $type, string $title, string $message, array $data = []): void
    {
        foreach (array_unique($userIds) as $userId) {
            if (! $this->users->has($userId)) {
                continue;
            }
            Notification::create([
                'user_id' => $userId, 'type' => $type, 'title' => mb_strimwidth($title, 0, 250, '…'),
                'message' => $message === '' ? null : mb_strimwidth($message, 0, 400, '…'), 'data' => $data ?: null, 'created_at' => now(),
            ]);
        }
    }
}
