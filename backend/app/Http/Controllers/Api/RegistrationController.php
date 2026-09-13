<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Jobs as JobsModel;
use App\Models\AuditLog;
use App\Models\Document;
use App\Models\DocumentCategory;
use App\Models\DocumentVersion;
use App\Models\Registration;
use App\Models\Report;
use App\Models\StageLog;
use App\Models\UserActivity;
use App\Models\WorkflowStage;
use App\Models\WorkflowTemplate;
use App\Models\WorkflowTransition;
use App\Services\WorkflowEngine;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class RegistrationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $startDate = $request->query('start_date');
        $endDate = $request->query('end_date');
        $role = $request->query('role');
        $stage = $request->query('stage');
        $stuck = $request->query('stuck');
        $uidNo = $request->query('uid_no');

        $query = Registration::query();

        if ($uidNo) {
            $query->where('uid_no', $uidNo);
        }

        if ($startDate && $endDate) {
            $query->whereDate('received_date', '>=', $startDate)
                ->whereDate('received_date', '<=', $endDate);
        }

        if ($stage) {
            $query->where('current_stage', $stage);
        }

        if ($role) {
            switch (strtolower($role)) {
                case 'registration':
                    $query->whereIn('current_stage', ['1. Registered', '6. Report Dispatched']);
                    break;
                case 'lab':
                    $query->whereIn('current_stage', ['2. Field/Site Work', '3. Lab Testing']);
                    break;
                case 'report_staff':
                    $query->whereIn('current_stage', ['4. Report Drafting']);
                    break;
                case 'technical':
                    $query->whereIn('current_stage', ['5. Report Review']);
                    break;
                case 'manager':
                    $query->whereIn('current_stage', ['7. Payment Pending']);
                    break;
                case 'closed':
                    $query->whereIn('current_stage', ['8. Closed']);
                    break;
            }
        }

        $registrations = $query->orderByDesc('iClientId')
            ->limit(200)
            ->get()
            ->map(function (Registration $registration): array {
                return $this->presentRegistration($registration);
            });

        if ($stuck === 'true') {
            $registrations = $registrations->filter(function ($reg) {
                return ($reg['days_at_stage'] ?? 0) >= 2 && ($reg['current_stage'] ?? '') !== '8. Closed';
            })->values();
        }

        return response()->json([
            'data' => $registrations,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'uid_no' => ['required', 'string', 'max:255'],
            'received_date' => ['required', 'string', 'max:255'],
            'agency_name' => ['required', 'string', 'max:255'],
            'reporting_address' => ['required', 'string', 'max:255'],
            'mobile_no' => ['required', 'string', 'max:50'],
            'name_of_work' => ['required', 'string'],
            'work_order_no' => ['nullable', 'string', 'max:255'],
            'reference' => ['nullable', 'string', 'max:255'],
            'work' => ['nullable', 'string', 'max:255'],
            'report_status' => ['nullable', 'string', 'max:255'],
            'sample_details' => ['required', 'string'],
            'sample_details_1' => ['nullable', 'string'],
            'sample_details_2' => ['nullable', 'string'],
            'sample_details_3' => ['nullable', 'string'],
            'sample_details_4' => ['nullable', 'string'],
            'new_back' => ['nullable', 'string', 'max:255'],
            'new_back_1' => ['nullable', 'string', 'max:255'],
            'new_back_2' => ['nullable', 'string', 'max:255'],
            'new_back_3' => ['nullable', 'string', 'max:255'],
            'new_back_4' => ['nullable', 'string', 'max:255'],
            'total_payment' => ['nullable', 'numeric'],
            'advance_payment' => ['nullable', 'numeric'],
            'balance_dues' => ['nullable', 'numeric'],
            'payment_followup' => ['nullable', 'string', 'max:255'],
            'financial_remark' => ['nullable', 'string'],
            'mode_of_payment' => ['nullable', 'string', 'max:255'],
            'gst_no' => ['nullable', 'string', 'max:255'],
            'sample_nos' => ['nullable', 'string', 'max:255'],
            'remark' => ['nullable', 'string'],
            'qty' => ['nullable', 'string', 'max:255'],
            'qty_1' => ['nullable', 'string', 'max:255'],
            'qty_2' => ['nullable', 'string', 'max:255'],
            'qty_3' => ['nullable', 'string', 'max:255'],
            'qty_4' => ['nullable', 'string', 'max:255'],
            'witness' => ['nullable', 'string', 'max:255'],
            'sample_test' => ['nullable', 'string', 'max:255'],
            'sample_remark' => ['nullable', 'string'],
            'report_no' => ['nullable', 'string', 'max:255'],
            'field_person_name' => ['nullable', 'string', 'max:255'],
            'prepared_date' => ['nullable', 'string', 'max:255'],
            'dispatch_date' => ['nullable', 'string', 'max:255'],
            'assign_to' => ['nullable', 'string', 'max:255'],
            'current_stage' => ['nullable', 'string', 'max:255'],
            'currently_with' => ['nullable', 'string', 'max:255'],
            'priority' => ['nullable', 'string', 'max:255'],
            'target_date' => ['nullable', 'string', 'max:255'],
            'payment_status' => ['nullable', 'string', 'max:255'],
            'handover_note' => ['nullable', 'string'],
        ]);

        $registration = DB::transaction(function () use ($validated, $request) {
            $nextId = ((int) (DB::table('client_registration')->max('iClientId') ?? 0)) + 1;
            $nextSno = ((int) (DB::table('client_registration')->max('sno') ?? 0)) + 1;

            DB::table('client_registration')->insert([
                'iClientId' => $nextId,
                'sno' => $nextSno,
                'uid_no' => $validated['uid_no'],
                'ulr_no' => '',
                'month' => '',
                'received_date' => $this->normalizeLegacyDate($validated['received_date']),
                'agency_name' => $validated['agency_name'],
                'mobile_no' => $validated['mobile_no'],
                'reporting_address' => $validated['reporting_address'],
                'name_of_work' => $validated['name_of_work'],
                'work' => $validated['work'] ?? '',
                'work_order_no' => $validated['work_order_no'] ?? '',
                'reference' => $validated['reference'] ?? '',
                'dist' => '',
                'payment_followup' => $validated['payment_followup'] ?? '',
                'advance_payment' => (string) ($validated['advance_payment'] ?? 0),
                'balance_dues' => (string) ($validated['balance_dues'] ?? 0),
                'total_payment' => (string) ($validated['total_payment'] ?? 0),
                'financial_remark' => $validated['financial_remark'] ?? '',
                'mode_of_payment' => $validated['mode_of_payment'] ?? '',
                'new_back' => $validated['new_back'] ?? '',
                'new_back_1' => $validated['new_back_1'] ?? '',
                'new_back_2' => $validated['new_back_2'] ?? '',
                'new_back_3' => $validated['new_back_3'] ?? '',
                'new_back_4' => $validated['new_back_4'] ?? '',
                'sample_details' => $validated['sample_details'],
                'sample_details_1' => $validated['sample_details_1'] ?? '',
                'sample_details_2' => $validated['sample_details_2'] ?? '',
                'sample_details_3' => $validated['sample_details_3'] ?? '',
                'sample_details_4' => $validated['sample_details_4'] ?? '',
                'qty_1' => $validated['qty_1'] ?? '',
                'qty_2' => $validated['qty_2'] ?? '',
                'qty_3' => $validated['qty_3'] ?? '',
                'qty_4' => $validated['qty_4'] ?? '',
                'sample_test' => $validated['sample_test'] ?? '',
                'qty' => $validated['qty'] ?? '',
                'witness' => $validated['witness'] ?? '',
                'field_person_name' => $validated['field_person_name'] ?? '',
                'remark' => $validated['remark'] ?? '',
                'sample_remark' => $validated['sample_remark'] ?? '',
                'prepared_date' => $validated['prepared_date'] ? $this->normalizeLegacyDate($validated['prepared_date']) : '',
                'report_no' => $validated['report_no'] ?? '',
                'dispatch_date' => $validated['dispatch_date'] ? $this->normalizeLegacyDate($validated['dispatch_date']) : '',
                'report_status' => $validated['report_status'] ?? 'Pending',
                'report_copy' => '',
                'gst_no' => $validated['gst_no'] ?? '',
                'sample_nos' => $validated['sample_nos'] ?? '',
                'scan_copy' => '',
                'scan_copy_1' => '',
                'scan_copy_2' => '',
                'scan_copy_3' => '',
                'scan_copy_4' => '',
                'assign_to' => $validated['assign_to'] ?? 'lab',
                'current_stage' => $validated['current_stage'] ?? '1. Registered',
                'currently_with' => $validated['currently_with'] ?? '',
                'priority' => $validated['priority'] ?? 'Medium',
                'target_date' => !empty($validated['target_date']) ? $validated['target_date'] : null,
                'payment_status' => $validated['payment_status'] ?? 'Not Invoiced',
            ]);

            DB::table('stage_logs')->insert([
                'registration_id' => $nextId,
                'uid_no' => $validated['uid_no'],
                'stage_set' => $validated['current_stage'] ?? '1. Registered',
                'from_person' => $request->user()?->name ?? 'Registration',
                'to_person' => $validated['currently_with'] ?? '',
                'note' => $validated['handover_note'] ?? 'Job registered',
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            return DB::table('client_registration')->where('iClientId', $nextId)->first();
        });

        UserActivity::query()->create([
            'user_id' => $request->user()->id,
            'action' => 'sample_registered',
            'module' => 'registrations',
            'details' => "Registered sample {$validated['uid_no']}",
            'ip_address' => $request->ip(),
            'created_at' => now(),
        ]);

        $this->syncJobFromRegistration($registration, $request);

        return response()->json([
            'message' => 'Registration created successfully',
            'registration' => $this->presentRegistration($registration),
        ], 201);
    }

    public function update(Request $request, int $registrationId): JsonResponse
    {
        $validated = $request->validate([
            'uid_no' => ['required', 'string', 'max:255'],
            'received_date' => ['required', 'string', 'max:255'],
            'agency_name' => ['required', 'string', 'max:255'],
            'reporting_address' => ['required', 'string', 'max:255'],
            'mobile_no' => ['required', 'string', 'max:50'],
            'name_of_work' => ['required', 'string'],
            'work_order_no' => ['nullable', 'string', 'max:255'],
            'reference' => ['nullable', 'string', 'max:255'],
            'work' => ['nullable', 'string', 'max:255'],
            'report_status' => ['nullable', 'string', 'max:255'],
            'sample_details' => ['required', 'string'],
            'sample_details_1' => ['nullable', 'string'],
            'sample_details_2' => ['nullable', 'string'],
            'sample_details_3' => ['nullable', 'string'],
            'sample_details_4' => ['nullable', 'string'],
            'new_back' => ['nullable', 'string', 'max:255'],
            'new_back_1' => ['nullable', 'string', 'max:255'],
            'new_back_2' => ['nullable', 'string', 'max:255'],
            'new_back_3' => ['nullable', 'string', 'max:255'],
            'new_back_4' => ['nullable', 'string', 'max:255'],
            'total_payment' => ['nullable', 'numeric'],
            'advance_payment' => ['nullable', 'numeric'],
            'balance_dues' => ['nullable', 'numeric'],
            'payment_followup' => ['nullable', 'string', 'max:255'],
            'financial_remark' => ['nullable', 'string'],
            'mode_of_payment' => ['nullable', 'string', 'max:255'],
            'gst_no' => ['nullable', 'string', 'max:255'],
            'sample_nos' => ['nullable', 'string', 'max:255'],
            'remark' => ['nullable', 'string'],
            'qty' => ['nullable', 'string', 'max:255'],
            'qty_1' => ['nullable', 'string', 'max:255'],
            'qty_2' => ['nullable', 'string', 'max:255'],
            'qty_3' => ['nullable', 'string', 'max:255'],
            'qty_4' => ['nullable', 'string', 'max:255'],
            'witness' => ['nullable', 'string', 'max:255'],
            'sample_test' => ['nullable', 'string', 'max:255'],
            'sample_remark' => ['nullable', 'string'],
            'report_no' => ['nullable', 'string', 'max:255'],
            'field_person_name' => ['nullable', 'string', 'max:255'],
            'prepared_date' => ['nullable', 'string', 'max:255'],
            'dispatch_date' => ['nullable', 'string', 'max:255'],
            'assign_to' => ['nullable', 'string', 'max:255'],
            'current_stage' => ['nullable', 'string', 'max:255'],
            'currently_with' => ['nullable', 'string', 'max:255'],
            'priority' => ['nullable', 'string', 'max:255'],
            'target_date' => ['nullable', 'string', 'max:255'],
            'payment_status' => ['nullable', 'string', 'max:255'],
            'handover_note' => ['nullable', 'string'],
        ]);

        $existing = DB::table('client_registration')->where('iClientId', $registrationId)->first();
        abort_if(! $existing, 404, 'Registration not found');

        $oldStage = $existing->current_stage ?? '1. Registered';
        $oldWith = $existing->currently_with ?? '';
        $newStage = $validated['current_stage'] ?? $oldStage;
        $newWith = $validated['currently_with'] ?? $oldWith;
        $handoverNote = $validated['handover_note'] ?? '';

        DB::table('client_registration')->where('iClientId', $registrationId)->update([
            'uid_no' => $validated['uid_no'],
            'received_date' => $this->normalizeLegacyDate($validated['received_date']),
            'agency_name' => $validated['agency_name'],
            'reporting_address' => $validated['reporting_address'],
            'mobile_no' => $validated['mobile_no'],
            'name_of_work' => $validated['name_of_work'],
            'work_order_no' => $validated['work_order_no'] ?? '',
            'reference' => $validated['reference'] ?? '',
            'work' => $validated['work'] ?? '',
            'report_status' => $validated['report_status'] ?? '',
            'sample_details' => $validated['sample_details'],
            'sample_details_1' => $validated['sample_details_1'] ?? '',
            'sample_details_2' => $validated['sample_details_2'] ?? '',
            'sample_details_3' => $validated['sample_details_3'] ?? '',
            'sample_details_4' => $validated['sample_details_4'] ?? '',
            'new_back' => $validated['new_back'] ?? '',
            'new_back_1' => $validated['new_back_1'] ?? '',
            'new_back_2' => $validated['new_back_2'] ?? '',
            'new_back_3' => $validated['new_back_3'] ?? '',
            'new_back_4' => $validated['new_back_4'] ?? '',
            'total_payment' => (string) ($validated['total_payment'] ?? 0),
            'advance_payment' => (string) ($validated['advance_payment'] ?? 0),
            'balance_dues' => (string) ($validated['balance_dues'] ?? 0),
            'payment_followup' => $validated['payment_followup'] ?? '',
            'financial_remark' => $validated['financial_remark'] ?? '',
            'mode_of_payment' => $validated['mode_of_payment'] ?? '',
            'gst_no' => $validated['gst_no'] ?? '',
            'sample_nos' => $validated['sample_nos'] ?? '',
            'qty' => $validated['qty'] ?? '',
            'qty_1' => $validated['qty_1'] ?? '',
            'qty_2' => $validated['qty_2'] ?? '',
            'qty_3' => $validated['qty_3'] ?? '',
            'qty_4' => $validated['qty_4'] ?? '',
            'witness' => $validated['witness'] ?? '',
            'sample_test' => $validated['sample_test'] ?? '',
            'sample_remark' => $validated['sample_remark'] ?? '',
            'remark' => $validated['remark'] ?? '',
            'report_no' => $validated['report_no'] ?? '',
            'field_person_name' => $validated['field_person_name'] ?? '',
            'prepared_date' => $validated['prepared_date'] ? $this->normalizeLegacyDate($validated['prepared_date']) : '',
            'dispatch_date' => $validated['dispatch_date'] ? $this->normalizeLegacyDate($validated['dispatch_date']) : '',
            'assign_to' => $validated['assign_to'] ?? 'lab',
            'current_stage' => $newStage,
            'currently_with' => $newWith,
            'priority' => $validated['priority'] ?? ($existing->priority ?? 'Medium'),
            'target_date' => !empty($validated['target_date']) ? $validated['target_date'] : null,
            'payment_status' => $validated['payment_status'] ?? ($existing->payment_status ?? 'Not Invoiced'),
        ]);

        if ($newStage !== $oldStage || $newWith !== $oldWith || !empty($handoverNote)) {
            DB::table('stage_logs')->insert([
                'registration_id' => $registrationId,
                'uid_no' => $validated['uid_no'],
                'stage_set' => $newStage,
                'from_person' => $request->user()?->name ?? ($oldWith ?: 'Registration'),
                'to_person' => $newWith,
                'note' => $handoverNote ?: ("Stage updated to " . $newStage),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        $registration = DB::table('client_registration')->where('iClientId', $registrationId)->first();
        $this->syncJobFromRegistration($registration, $request);

        return response()->json([
            'message' => 'Registration updated',
            'data' => $this->presentRegistration($registration),
        ]);
    }

    private function presentRegistration(object $registration): array
    {
        $totalPayment = (float) ($registration->total_payment ?: 0);
        $advancePayment = (float) ($registration->advance_payment ?: 0);
        $balanceDues = (float) ($registration->balance_dues ?: 0);

        $regId = $registration->iClientId ?? ($registration->id ?? 0);
        $uidNo = $registration->uid_no ?? '';

        $logs = DB::table('stage_logs')
            ->where('registration_id', $regId)
            ->orderByDesc('created_at')
            ->get();

        $latestLog = $logs->first();
        $daysAtStage = 0;
        if ($latestLog && $latestLog->created_at) {
            $daysAtStage = (int) Carbon::parse($latestLog->created_at)->diffInDays(now());
        }

        return [
            'id' => $regId,
            'uid_no' => $uidNo,
            'received_date' => $this->formatLegacyDate($registration->received_date ?? ''),
            'agency_name' => $registration->agency_name ?? '',
            'reporting_address' => $registration->reporting_address ?? '',
            'mobile_no' => $registration->mobile_no ?? '',
            'name_of_work' => $registration->name_of_work ?? '',
            'work_order_no' => $registration->work_order_no ?? '',
            'reference' => $registration->reference ?? '',
            'work' => $registration->work ?? '',
            'report_status' => $registration->report_status ?? '',
            'sample_details' => $registration->sample_details ?? '',
            'sample_details_1' => $registration->sample_details_1 ?? '',
            'sample_details_2' => $registration->sample_details_2 ?? '',
            'sample_details_3' => $registration->sample_details_3 ?? '',
            'sample_details_4' => $registration->sample_details_4 ?? '',
            'new_back' => $registration->new_back ?? '',
            'new_back_1' => $registration->new_back_1 ?? '',
            'new_back_2' => $registration->new_back_2 ?? '',
            'new_back_3' => $registration->new_back_3 ?? '',
            'new_back_4' => $registration->new_back_4 ?? '',
            'total_payment' => $totalPayment,
            'advance_payment' => $advancePayment,
            'balance_dues' => $balanceDues,
            'payment_followup' => $registration->payment_followup ?? '',
            'financial_remark' => $registration->financial_remark ?? '',
            'mode_of_payment' => $registration->mode_of_payment ?? '',
            'gst_no' => $registration->gst_no ?? '',
            'sample_nos' => $registration->sample_nos ?? '',
            'remark' => $registration->remark ?? '',
            'qty' => $registration->qty ?? '',
            'qty_1' => $registration->qty_1 ?? '',
            'qty_2' => $registration->qty_2 ?? '',
            'qty_3' => $registration->qty_3 ?? '',
            'qty_4' => $registration->qty_4 ?? '',
            'witness' => $registration->witness ?? '',
            'sample_test' => $registration->sample_test ?? '',
            'sample_remark' => $registration->sample_remark ?? '',
            'report_no' => $registration->report_no ?? '',
            'field_person_name' => $registration->field_person_name ?? '',
            'prepared_date' => $this->formatLegacyDate($registration->prepared_date ?? ''),
            'dispatch_date' => $this->formatLegacyDate($registration->dispatch_date ?? ''),
            'assign_to' => $registration->assign_to ?? '',
            'report_copy' => $registration->report_copy ?? '',
            'scan_copy' => $registration->scan_copy ?? '',
            'scan_copy_1' => $registration->scan_copy_1 ?? '',
            'scan_copy_2' => $registration->scan_copy_2 ?? '',
            'scan_copy_3' => $registration->scan_copy_3 ?? '',
            'scan_copy_4' => $registration->scan_copy_4 ?? '',
            'status' => $balanceDues > 0 ? 'Pending' : 'Complete',
            'current_stage' => $registration->current_stage ?? '1. Registered',
            'currently_with' => $registration->currently_with ?? '',
            'priority' => $registration->priority ?? 'Medium',
            'target_date' => $registration->target_date ?? '',
            'payment_status' => $registration->payment_status ?? ($balanceDues <= 0 && $totalPayment > 0 ? 'Fully Received' : 'Not Invoiced'),
            'days_at_stage' => $daysAtStage,
            'stage_logs' => $logs->map(function ($log) {
                return [
                    'id' => $log->id,
                    'stage_set' => $log->stage_set,
                    'from_person' => $log->from_person ?? '',
                    'to_person' => $log->to_person ?? '',
                    'note' => $log->note ?? '',
                    'created_at' => (string) $log->created_at,
                ];
            })->toArray(),
        ];
    }

    public function destroy(Request $request, int $registrationId): JsonResponse
    {
        $registration = DB::table('client_registration')->where('iClientId', $registrationId)->first();
        abort_if(!$registration, 404, 'Registration not found');

        DB::transaction(function () use ($registration, $registrationId): void {
            // Delete associated reports
            Report::query()->where('uid_no', $registration->uid_no)->delete();

            // Delete associated billing records
            DB::table('billing')->where('uid_no', $registration->uid_no)->delete();

            // Delete the registration
            DB::table('client_registration')->where('iClientId', $registrationId)->delete();
        });

        UserActivity::query()->create([
            'user_id' => $request->user()->id,
            'action' => 'registration_deleted',
            'module' => 'registrations',
            'details' => "Deleted registration {$registration->uid_no}",
            'ip_address' => $request->ip(),
            'created_at' => now(),
        ]);

        return response()->json(['message' => 'Registration deleted successfully']);
    }

    public function export(Request $request): JsonResponse
    {
        $startDate = $request->query('start_date');
        $endDate = $request->query('end_date');

        $registrations = Registration::query()
            ->when($startDate && $endDate, function ($query) use ($startDate, $endDate): void {
                $query->whereDate('received_date', '>=', $startDate)
                    ->whereDate('received_date', '<=', $endDate);
            })
            ->orderByDesc('iClientId')
            ->limit(5000)
            ->get()
            ->map(function (Registration $r): array {
                return [
                    'uid_no' => $r->uid_no,
                    'received_date' => $this->formatLegacyDate($r->received_date),
                    'agency_name' => $r->agency_name,
                    'reporting_address' => $r->reporting_address,
                    'mobile_no' => $r->mobile_no,
                    'name_of_work' => $r->name_of_work,
                    'sample_details' => $r->sample_details,
                    'total_payment' => (float) ($r->total_payment ?: 0),
                    'advance_payment' => (float) ($r->advance_payment ?: 0),
                    'balance_dues' => (float) ($r->balance_dues ?: 0),
                    'mode_of_payment' => $r->mode_of_payment ?? '',
                    'gst_no' => $r->gst_no ?? '',
                    'remark' => $r->remark,
                    'report_status' => $r->report_status ?? '',
                ];
            });

        return response()->json(['data' => $registrations]);
    }

    public function searchCustomers(Request $request): JsonResponse
    {
        $query = $request->input('q', '');
        if (strlen($query) < 2) {
            return response()->json(['data' => []]);
        }

        $registrations = Registration::query()
            ->where('agency_name', 'like', "%{$query}%")
            ->orWhere('mobile_no', 'like', "%{$query}%")
            ->orWhere('uid_no', 'like', "%{$query}%")
            ->orderByDesc('iClientId')
            ->limit(10)
            ->get()
            ->map(fn ($r) => [
                'iClientId' => $r->iClientId,
                'uid_no' => $r->uid_no,
                'agency_name' => $r->agency_name,
                'reporting_address' => $r->reporting_address,
                'mobile_no' => $r->mobile_no,
                'name_of_work' => $r->name_of_work,
            ]);

        return response()->json(['data' => $registrations]);
    }

    public function generateUid(): JsonResponse
    {
        $year = now()->format('Y');
        $lastSno = (int) DB::table('client_registration')
            ->whereYear('received_date', $year)
            ->max('sno');

        $nextSno = max($lastSno, 0) + 1;
        $uid = sprintf('NAMO/MC/%s/%05d', $year, $nextSno);

        return response()->json([
            'uid_no' => $uid,
            'sno' => $nextSno,
            'year' => $year,
        ]);
    }

    public function history(int $registrationId): JsonResponse
    {
        $registration = Registration::query()->where('iClientId', $registrationId)->firstOrFail();

        $entries = [];

        // 1. Registration created
        if ($registration->received_date) {
            try {
                $d = \Carbon\Carbon::parse($registration->received_date);
                $entries[] = [
                    'event' => "Job Registered (UID: {$registration->uid_no})",
                    'timestamp' => $d->toIso8601String(),
                    'icon' => 'file',
                    'user' => $registration->assign_to ?? 'Registration',
                    'note' => $registration->name_of_work ?? null,
                ];
            } catch (\Throwable $e) {
                $entries[] = [
                    'event' => "Job Registered (UID: {$registration->uid_no})",
                    'timestamp' => null,
                    'icon' => 'file',
                    'user' => $registration->assign_to ?? 'Registration',
                    'note' => $registration->name_of_work ?? null,
                ];
            }
        }

        // 2. Stage Handover Logs (Audit trail from workflow handovers)
        $stageLogs = StageLog::query()
            ->where('registration_id', $registrationId)
            ->orWhere('uid_no', $registration->uid_no)
            ->orderByDesc('created_at')
            ->get();

        foreach ($stageLogs as $sLog) {
            $desc = "Stage: {$sLog->stage_set}";
            if ($sLog->from_person && $sLog->to_person) {
                $desc .= " (Handover: {$sLog->from_person} ➔ {$sLog->to_person})";
            } elseif ($sLog->to_person) {
                $desc .= " (Assigned to: {$sLog->to_person})";
            }

            $entries[] = [
                'event' => $desc,
                'timestamp' => $sLog->created_at ? $sLog->created_at->toIso8601String() : null,
                'icon' => 'audit',
                'user' => $sLog->from_person ?? 'System',
                'note' => $sLog->note,
            ];
        }

        // 3. Related Reports
        $reports = Report::query()->where('uid_no', $registration->uid_no)->get();
        foreach ($reports as $report) {
            $createTs = $report->create_date ? \Carbon\Carbon::parse($report->create_date)->toIso8601String() : null;
            $entries[] = [
                'event' => "Report {$report->uid_no} created ({$report->report_type})",
                'timestamp' => $createTs,
                'icon' => 'file_text',
                'user' => 'Lab',
            ];

            if ($report->assigned_at) {
                $entries[] = [
                    'event' => "Report assigned for testing",
                    'timestamp' => \Carbon\Carbon::parse($report->assigned_at)->toIso8601String(),
                    'icon' => 'user',
                ];
            }
            if ($report->testing_started_at) {
                $entries[] = [
                    'event' => "Testing started in lab",
                    'timestamp' => \Carbon\Carbon::parse($report->testing_started_at)->toIso8601String(),
                    'icon' => 'play',
                ];
            }
            if ($report->report_generated_at) {
                $entries[] = [
                    'event' => "Report generated",
                    'timestamp' => \Carbon\Carbon::parse($report->report_generated_at)->toIso8601String(),
                    'icon' => 'file_text',
                ];
            }
            if ($report->approved_at) {
                $entries[] = [
                    'event' => "Report approved by reviewer",
                    'timestamp' => \Carbon\Carbon::parse($report->approved_at)->toIso8601String(),
                    'icon' => 'check',
                ];
            }
            if ($report->status === 'Cancel') {
                $entries[] = [
                    'event' => "Report canceled: {$report->cancel_remark}",
                    'timestamp' => $report->updated_date ? \Carbon\Carbon::parse($report->updated_date)->toIso8601String() : null,
                    'icon' => 'x',
                ];
            }
        }

        // 4. Audit Logs
        $auditLogs = AuditLog::query()
            ->where('model_type', 'Registration')
            ->where('model_id', $registrationId)
            ->orderByDesc('created_at')
            ->limit(20)
            ->get();
        foreach ($auditLogs as $log) {
            $entries[] = [
                'event' => $log->description ?? $log->action,
                'timestamp' => $log->created_at ? $log->created_at->toIso8601String() : null,
                'icon' => 'audit',
                'user' => $log->user?->name ?? 'User',
            ];
        }

        // Sort descending by timestamp
        usort($entries, function ($a, $b) {
            $tA = $a['timestamp'] ?? '';
            $tB = $b['timestamp'] ?? '';
            return strcmp($tB, $tA);
        });

        return response()->json(['data' => $entries, 'uid_no' => $registration->uid_no]);
    }

    public function uploadScan(Request $request): JsonResponse
    {
        $request->validate([
            'file' => ['required', 'file', 'mimes:jpg,jpeg,png,pdf,docx,xlsx,csv', 'max:15360'],
            'field' => ['required', 'string', 'in:scan_copy,scan_copy_1,scan_copy_2,scan_copy_3,scan_copy_4,report_copy'],
            'registration_id' => ['required', 'integer'],
        ]);

        $file = $request->file('file');
        $field = $request->input('field');
        $regId = (int) $request->input('registration_id');

        $path = $file->store('scans', 'public');

        DB::table('client_registration')
            ->where('iClientId', $regId)
            ->update([$field => $path]);

        $registration = Registration::where('iClientId', $regId)->first();
        $uidNo = $registration?->uid_no ?? "ID-$regId";
        $agency = $registration?->agency_name ?? 'Client';

        $category = DocumentCategory::firstOrCreate(
            ['slug' => 'client-registrations'],
            ['name' => 'Client Registrations', 'icon' => 'Folder', 'is_active' => true]
        );

        $slotMap = [
            'scan_copy' => 'Doc #1',
            'scan_copy_1' => 'Doc #2',
            'scan_copy_2' => 'Doc #3',
            'scan_copy_3' => 'Doc #4',
            'scan_copy_4' => 'Doc #5',
            'report_copy' => 'Report Copy',
        ];
        $slotLabel = $slotMap[$field] ?? $field;

        $doc = Document::create([
            'category_id' => $category->id,
            'title' => "$uidNo - $slotLabel - $agency",
            'description' => "Registration scan attachment for UID: $uidNo ($agency)",
            'file_name' => $file->getClientOriginalName(),
            'file_path' => $path,
            'file_type' => $file->getMimeType(),
            'file_extension' => strtolower($file->getClientOriginalExtension() ?: pathinfo($path, PATHINFO_EXTENSION)),
            'file_size' => $file->getSize(),
            'tags' => "registration,scan,$uidNo,$agency",
            'linked_model_type' => Registration::class,
            'linked_model_id' => $regId,
            'created_by' => $request->user()?->id,
        ]);

        DocumentVersion::create([
            'document_id' => $doc->id,
            'version_number' => 1,
            'file_path' => $path,
            'file_name' => $file->getClientOriginalName(),
            'file_size' => $file->getSize(),
            'created_by' => $request->user()?->id,
        ]);

        return response()->json([
            'message' => 'File uploaded and archived successfully',
            'field' => $field,
            'path' => $path,
            'file_name' => $file->getClientOriginalName(),
            'url' => asset("storage/$path"),
            'document_id' => $doc->id,
        ]);
    }

    protected function syncJobFromRegistration(object $registration, Request $request): void
    {
        $template = WorkflowTemplate::where('is_active', true)->first();
        if (!$template) return;

        $existingJob = JobsModel::where('uid_no', $registration->uid_no)->first();
        if ($existingJob) {
            $this->linkJobToRegistration($registration, $existingJob);
            $regStage = WorkflowStage::where('template_id', $template->id)
                ->where('slug', 'registration')->first();
            if ($regStage && $existingJob->current_stage_id !== $regStage->id) {
                $transition = WorkflowTransition::where('template_id', $template->id)
                    ->where('from_stage_id', $existingJob->current_stage_id)
                    ->where('to_stage_id', $regStage->id)
                    ->first();
                if ($transition) {
                    app(WorkflowEngine::class)->transition(
                        $existingJob, $transition, $request->user(), 'Sample registered'
                    );
                }
            }
            return;
        }

        $job = JobsModel::create([
            'uid_no' => $registration->uid_no,
            'title' => 'Registration ' . $registration->uid_no,
            'priority' => 'normal',
            'workflow_template_id' => $template->id,
            'created_by' => $request->user()?->id,
            'status' => 'pending',
        ]);

        $this->linkJobToRegistration($registration, $job);

        app(WorkflowEngine::class)->startJob($job, $request->user());

        $regStage = WorkflowStage::where('template_id', $template->id)
            ->where('slug', 'registration')->first();
        if ($regStage && $job->current_stage_id !== $regStage->id) {
            $transition = WorkflowTransition::where('template_id', $template->id)
                ->where('from_stage_id', $job->current_stage_id)
                ->where('to_stage_id', $regStage->id)
                ->first();
            if ($transition) {
                app(WorkflowEngine::class)->transition(
                    $job, $transition, $request->user(), 'Sample registered'
                );
            }
        }
    }

    protected function linkJobToRegistration(object $registration, JobsModel $job): void
    {
        DB::table('client_registration')
            ->where('iClientId', $registration->iClientId)
            ->update(['job_id' => $job->id]);
    }

    private function normalizeLegacyDate(mixed $value): string
    {
        if ($value instanceof \DateTimeInterface) {
            return $value->format('Y-m-d');
        }

        $dateValue = trim((string) $value);

        foreach (['Y-m-d', 'd/m/Y'] as $format) {
            try {
                return Carbon::createFromFormat($format, $dateValue)->format('Y-m-d');
            } catch (\Throwable) {
                // Try the next format.
            }
        }

        return Carbon::parse($dateValue)->format('Y-m-d');
    }

    private function formatLegacyDate(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        if ($value instanceof \DateTimeInterface) {
            return $value->format('d/m/Y');
        }

        $dateValue = trim((string) $value);

        foreach (['Y-m-d', 'd/m/Y'] as $format) {
            try {
                return Carbon::createFromFormat($format, $dateValue)->format('d/m/Y');
            } catch (\Throwable) {
                // Try the next format.
            }
        }

        try {
            return Carbon::parse($dateValue)->format('d/m/Y');
        } catch (\Throwable) {
            return $dateValue;
        }
    }
}
