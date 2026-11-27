<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AttendanceCorrection;
use App\Models\Bill;
use App\Models\LeaveRequest;
use App\Models\Notification;
use App\Models\PerformaInvoice;
use App\Models\Quotation;
use App\Models\Report;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

/** What the phone app needs in one call: everything waiting for this user to approve */
class MobileController extends Controller
{
    private const LIMIT = 50;

    public function approvals(Request $request): JsonResponse
    {
        $user = $request->user();
        $items = [];

        if ($user->canApproveLeave()) {
            foreach (LeaveRequest::query()->with(['type', 'user'])->where('status', 'pending')->orderBy('from_date')->limit(self::LIMIT)->get() as $r) {
                if ((int) $r->user_id === (int) $user->id) {
                    continue;
                }
                $range = $r->from_date->format('d M').($r->to_date->ne($r->from_date) ? ' – '.$r->to_date->format('d M') : '');
                $items[] = $this->item('leave', $r->id, 'leave', ($r->user?->name ?? 'Someone').' · '.($r->type?->name ?? 'Leave'),
                    $range.' · '.rtrim(rtrim(number_format((float) $r->days, 1), '0'), '.').' day'.((float) $r->days === 1.0 ? '' : 's').($r->reason ? ' · '.$r->reason : ''),
                    $r->created_at, true);
            }
        }

        if ($user->isFullAdmin()) {
            foreach (AttendanceCorrection::query()->with('user')->where('status', 'pending')->orderBy('date')->limit(self::LIMIT)->get() as $c) {
                $times = collect([$c->check_in_at?->timezone('Asia/Kolkata')->format('H:i'), $c->check_out_at?->timezone('Asia/Kolkata')->format('H:i')])->filter()->implode(' – ');
                $items[] = $this->item('attendance', $c->id, 'team', ($c->user?->name ?? 'Someone').' · Attendance correction',
                    $c->date->format('d M').($times ? ' · '.$times : '').($c->reason ? ' · '.$c->reason : ''), $c->created_at, true);
            }
        }

        if ($user->canApproveQuotations()) {
            foreach (Quotation::query()->where('approval', 'pending')->orderBy('approval_requested_at')->limit(self::LIMIT)->get() as $q) {
                $items[] = $this->item('quotation', $q->id, 'quotations', 'Quotation '.$q->quotation_no,
                    $this->line($q->client_name, $q->net_amount, $q->approval_requested_by), $q->approval_requested_at);
            }
        }

        if ($user->canApproveBills()) {
            foreach (Bill::query()->where('approval', 'pending')->orderBy('approval_requested_at')->limit(self::LIMIT)->get() as $b) {
                $items[] = $this->item('bill', $b->id, 'billing', 'Invoice '.$b->invoice_no,
                    $this->line($b->client_name, $b->net_amount, $b->approval_requested_by), $b->approval_requested_at);
            }
            foreach (Bill::query()->where('cn_approval', 'pending')->orderBy('cn_approval_requested_at')->limit(self::LIMIT)->get() as $b) {
                $items[] = $this->item('credit_note', $b->id, 'credit_notes', 'Credit note '.($b->credit_note_no ?: $b->invoice_no),
                    $this->line($b->client_name, $b->credit_amount, $b->cn_approval_requested_by), $b->cn_approval_requested_at);
            }
            foreach (PerformaInvoice::query()->where('approval', 'pending')->orderBy('approval_requested_at')->limit(self::LIMIT)->get() as $p) {
                $items[] = $this->item('performa', $p->id, 'performa', 'Performa '.$p->invoice_no,
                    $this->line($p->client_name, $p->net_amount, $p->approval_requested_by), $p->approval_requested_at);
            }
        }

        if ($user->canApproveReports()) {
            foreach (Report::query()->where('status', 'Report Generated')->orderBy('report_generated_at')->limit(self::LIMIT)->get() as $r) {
                $items[] = $this->item('report', (int) $r->iReportId, 'reports', 'Report '.$r->uid_no,
                    trim(($r->report_type ? $r->report_type.' · ' : '').mb_strimwidth((string) ($r->agency_name ?: strtok((string) $r->customer_details, "\n")), 0, 80, '…'), ' ·'),
                    $r->report_generated_at ? Carbon::parse($r->report_generated_at) : null);
            }
        }

        usort($items, fn ($a, $b) => strcmp((string) $a['since'], (string) $b['since']));

        return response()->json([
            'data' => $items,
            'counts' => collect($items)->countBy('kind'),
            'unread_notifications' => Notification::query()->where('user_id', $user->id)->whereNull('read_at')->count(),
        ]);
    }

    /** Tabs of the bottom bar between Home and More, chosen by the user */
    public function prefs(Request $request): JsonResponse
    {
        return response()->json(['data' => ['tabs' => $request->user()->app_prefs['tabs'] ?? null]]);
    }

    public function savePrefs(Request $request): JsonResponse
    {
        $values = $request->validate([
            'tabs' => ['present', 'array', 'max:3'],
            'tabs.*' => ['string', 'max:40', 'regex:/^[a-z0-9_]+$/', 'distinct'],
        ]);
        $user = $request->user();
        $user->forceFill(['app_prefs' => array_merge($user->app_prefs ?? [], ['tabs' => array_values($values['tabs'])])])->save();

        return response()->json(['data' => ['tabs' => $user->app_prefs['tabs']]]);
    }

    private function item(string $kind, int $id, string $module, string $title, string $detail, $since, bool $quick = false): array
    {
        return [
            'key' => $kind.'-'.$id,
            'kind' => $kind,
            'id' => $id,
            // The screen where it is reviewed in full
            'module' => $module,
            'title' => $title,
            'detail' => $detail,
            'since' => $since?->toIso8601String(),
            'since_human' => $since?->diffForHumans(),
            // Approve / reject right in the list
            'quick' => $quick,
        ];
    }

    private array $names = [];

    private function line(?string $client, $amount, $requestedBy): string
    {
        $by = null;
        if ($requestedBy) {
            $by = $this->names[$requestedBy] ??= User::query()->find($requestedBy)?->name;
        }

        return collect([
            $client,
            $amount !== null ? '₹'.number_format((float) $amount, 0) : null,
            $by ? 'by '.$by : null,
        ])->filter()->implode(' · ');
    }
}
