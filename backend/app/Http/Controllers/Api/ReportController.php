<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CubeReport;
use App\Models\Notification;
use App\Models\Company;
use App\Models\Report;
use App\Models\AuditLog;
use App\Models\User;
use App\Models\UserActivity;
use App\Services\WorkflowBridge;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ReportController extends Controller
{
    protected WorkflowBridge $bridge;

    public function __construct(WorkflowBridge $bridge)
    {
        $this->bridge = $bridge;
    }

    public const REPORT_TYPES = [
        'cc_cube' => [
            'model' => CubeReport::class,
            'table' => 'cube_reports',
            'pk' => 'iCubeId',
            'label' => 'CC Cube',
        ],
        'cc_core' => [
            'model' => \App\Models\ConcretecoreReport::class,
            'table' => 'concretecore_report',
            'pk' => 'iCoreId',
            'label' => 'Concrete Core',
        ],
        'cc_beam' => [
            'model' => \App\Models\ConcretebeamReport::class,
            'table' => 'concretebeam_report',
            'pk' => 'iBeamId',
            'label' => 'Concrete Beam',
        ],
        'bitumen_core' => [
            'model' => \App\Models\BitumencoreReport::class,
            'table' => 'bitumencore_report',
            'pk' => 'iBitumenCId',
            'label' => 'Bitumen Core',
        ],
        'bitumen_loose' => [
            'model' => \App\Models\BitumenlooseReport::class,
            'table' => 'bitumenloose_report',
            'pk' => 'iBitumenLId',
            'label' => 'Bitumen Loose',
        ],
        'bricks' => [
            'model' => \App\Models\BricksReport::class,
            'table' => 'bricks_report',
            'pk' => 'iBricksId',
            'label' => 'Bricks',
        ],
        'ferro_cover' => [
            'model' => \App\Models\FerrocoverReport::class,
            'table' => 'ferrocover_report',
            'pk' => 'iFerroId',
            'label' => 'Ferro Cover',
        ],
        'interlocking' => [
            'model' => \App\Models\InterlockingtilesReport::class,
            'table' => 'interlockingtiles_report',
            'pk' => 'iTilesId',
            'label' => 'Interlocking Tiles',
        ],
        'mainhole_cover' => [
            'model' => \App\Models\MainholecoverReport::class,
            'table' => 'mainholecover_report',
            'pk' => 'iMainholeId',
            'label' => 'Mainhole Cover',
        ],
        'mes' => [
            'model' => \App\Models\MesReport::class,
            'table' => 'mes_report',
            'pk' => 'iMesId',
            'label' => 'MES',
        ],
        'sand' => [
            'model' => \App\Models\SandReport::class,
            'table' => 'sand_report',
            'pk' => 'iSandId',
            'label' => 'Sand',
        ],
        'water' => [
            'model' => \App\Models\WaterReport::class,
            'table' => 'water_report',
            'pk' => 'iWaterId',
            'label' => 'Water',
        ],
    ];

    public function printReport(Request $request, string $type, int $reportId)
    {
        abort_if(! isset(self::REPORT_TYPES[$type]), 404, "Unknown report type: $type");

        $report = Report::query()->where('iReportId', $reportId)->where('report_type', $type)->firstOrFail();
        $config = self::REPORT_TYPES[$type];
        $detailModel = $config['model'];
        $details = $detailModel::query()->where('iReportId', $reportId)->get();
        $company = Company::query()->first();

        $payload = [
            'report' => $report,
            'details' => $details,
            'company' => $company,
        ];

        if ($request->query('format') === 'pdf') {
            $html = view('pdf.report', $payload)->render();
            return \Barryvdh\DomPDF\Facade\Pdf::loadHTML($html)
                ->download('report-' . $reportId . '.pdf');
        }

        return response()->json($payload);
    }

    public function types(): JsonResponse
    {
        $user = request()->user();
        $types = [];
        foreach (self::REPORT_TYPES as $key => $config) {
            $query = Report::query()->where('report_type', $key);
            $count = (clone $query)->count();
            $pending = (clone $query)->where('status', 'Pending')->count();
            $testing = (clone $query)->where('status', 'Testing')->count();
            $generated = (clone $query)->where('status', 'Report Generated')->count();
            $assignedToMe = $user ? (clone $query)->where('assigned_to', $user->id)->whereNotIn('status', ['Complete', 'Cancel'])->count() : 0;
            $types[] = [
                'key' => $key,
                'label' => $config['label'],
                'total' => $count,
                'pending' => $pending,
                'testing' => $testing,
                'generated' => $generated,
                'assigned_to_me' => $assignedToMe,
            ];
        }

        return response()->json(['data' => $types]);
    }

    public function index(Request $request, string $type): JsonResponse
    {
        abort_if(! isset(self::REPORT_TYPES[$type]), 404, "Unknown report type: $type");

        $startDate = $request->query('start_date');
        $endDate = $request->query('end_date');
        $statusFilter = $request->query('status');
        $assignedToMe = $request->query('assigned_to_me');

        $reports = Report::query()
            ->where('report_type', $type)
            ->when($startDate && $endDate, function ($query) use ($startDate, $endDate): void {
                $query->whereDate('create_date', '>=', $startDate)
                    ->whereDate('create_date', '<=', $endDate);
            })
            ->when($statusFilter, fn ($q, $s) => $q->where('status', $s))
            ->when($assignedToMe, fn ($q) => $q->where('assigned_to', $request->user()->id))
            ->orderByDesc('create_date')
            ->orderByDesc('iReportId')
            ->limit(50)
            ->get()
            ->map(fn (Report $report): array => [
                'iReportId' => $report->iReportId,
                'uid_no' => $report->uid_no,
                'job_id' => $report->job_id,
                'create_date' => optional($report->create_date)->format('d M Y'),
                'customer_details' => $report->customer_details,
                'agency_name' => $report->agency_name,
                'reference_no' => $report->reference_no,
                'material_details' => $report->material_details,
                'status' => $report->status,
                'assigned_to' => $report->assigned_to,
            ]);

        return response()->json([
            'count' => $reports->count(),
            'data' => $reports,
            'type' => $type,
            'config' => self::REPORT_TYPES[$type],
        ]);
    }

    public function show(string $type, int $reportId): JsonResponse
    {
        abort_if(! isset(self::REPORT_TYPES[$type]), 404, "Unknown report type: $type");

        $report = Report::query()->where('iReportId', $reportId)->where('report_type', $type)->firstOrFail();
        $config = self::REPORT_TYPES[$type];
        $detailModel = $config['model'];
        $details = $detailModel::query()->where('iReportId', $reportId)->get();

        $assignedUser = null;
        if ($report->assigned_to) {
            $assignedUser = User::query()->find($report->assigned_to, ['id', 'firstname', 'lastname', 'username']);
        }
        $approvedBy = null;
        if ($report->approved_by) {
            $approvedBy = User::query()->find($report->approved_by, ['id', 'firstname', 'lastname', 'username']);
        }

        return response()->json([
            'report' => $report,
            'details' => $details,
            'type' => $type,
            'config' => $config,
            'assigned_user' => $assignedUser,
            'approved_by_user' => $approvedBy,
        ]);
    }

    public function timeline(int $reportId): JsonResponse
    {
        $report = Report::query()->where('iReportId', $reportId)->firstOrFail();

        $entries = [];

        if ($report->create_date) {
            $entries[] = ['event' => 'Report Created', 'timestamp' => $report->create_date->toIso8601String(), 'icon' => 'file'];
        }

        if ($report->assigned_at) {
            $assignedUser = $report->assigned_to ? User::query()->find($report->assigned_to) : null;
            $entries[] = ['event' => 'Assigned to ' . ($assignedUser?->name ?? 'Lab Tech'), 'timestamp' => $report->assigned_at->toIso8601String(), 'icon' => 'user'];
        }

        if ($report->testing_started_at) {
            $entries[] = ['event' => 'Testing Started', 'timestamp' => $report->testing_started_at->toIso8601String(), 'icon' => 'play'];
        }

        if ($report->report_generated_at) {
            $entries[] = ['event' => 'Report Generated', 'timestamp' => $report->report_generated_at->toIso8601String(), 'icon' => 'file_text'];
        }

        if ($report->approved_at) {
            $approver = $report->approved_by ? User::query()->find($report->approved_by) : null;
            $entries[] = ['event' => 'Approved by ' . ($approver?->name ?? 'Approver'), 'timestamp' => $report->approved_at->toIso8601String(), 'icon' => 'check'];
        }

        if ($report->status === 'Cancel' && $report->cancel_remark) {
            $entries[] = ['event' => 'Canceled: ' . $report->cancel_remark, 'timestamp' => optional($report->updated_date)->toIso8601String() ?? now()->toIso8601String(), 'icon' => 'x'];
        }

        $auditLogs = AuditLog::query()
            ->where('model_type', 'Report')
            ->where('model_id', $reportId)
            ->orderByDesc('created_at')
            ->limit(20)
            ->get();

        foreach ($auditLogs as $log) {
            $entries[] = [
                'event' => $log->description ?? $log->action,
                'timestamp' => optional($log->created_at)->toIso8601String(),
                'icon' => 'audit',
                'user' => $log->user?->name ?? 'System',
            ];
        }

        usort($entries, fn (array $a, array $b) => ($b['timestamp'] ?? '') <=> ($a['timestamp'] ?? ''));

        return response()->json(['data' => $entries]);
    }

    public function assign(Request $request, int $reportId): JsonResponse
    {
        $validated = $request->validate([
            'assigned_to' => ['required', 'integer', 'exists:users,id'],
        ]);

        $report = Report::query()->where('iReportId', $reportId)->firstOrFail();
        $report->update([
            'assigned_to' => $validated['assigned_to'],
            'assigned_at' => now(),
            'status' => $report->status === 'Pending' ? 'Testing' : $report->status,
            'updated_date' => now(),
            'updated_by' => $request->user()?->id,
        ]);

        // Advance workflow job to 'assigned' stage
        $this->bridge->advanceToStage(
            $report->uid_no,
            'assigned',
            $request->user(),
            "Report #{$report->iReportId} assigned to user #{$validated['assigned_to']}"
        );

        UserActivity::query()->create([
            'user_id' => $request->user()->id,
            'action' => 'report_assigned',
            'module' => 'reports',
            'details' => "Assigned report {$report->uid_no} to user #{$validated['assigned_to']}",
            'ip_address' => $request->ip(),
            'created_at' => now(),
        ]);

        NotificationController::create(
            $validated['assigned_to'],
            'report_assigned',
            'Report assigned to you',
            "Report {$report->uid_no} has been assigned for testing.",
            ['report_id' => $report->iReportId, 'uid_no' => $report->uid_no],
        );

        return response()->json(['message' => 'Report assigned', 'status' => $report->fresh()->status]);
    }

    public function startTesting(int $reportId): JsonResponse
    {
        $report = Report::query()->where('iReportId', $reportId)->firstOrFail();
        abort_if($report->status !== 'Testing', 422, 'Report must be in Testing status');

        $report->update([
            'testing_started_at' => now(),
            'updated_date' => now(),
            'updated_by' => request()->user()?->id,
        ]);

        // Advance workflow job to 'testing' stage
        $this->bridge->advanceToStage(
            $report->uid_no,
            'testing',
            request()->user(),
            "Testing started for report #{$report->iReportId}"
        );

        UserActivity::query()->create([
            'user_id' => request()->user()->id,
            'action' => 'testing_started',
            'module' => 'reports',
            'details' => "Started testing for report {$report->uid_no}",
            'ip_address' => request()->ip(),
            'created_at' => now(),
        ]);

        return response()->json(['message' => 'Testing started']);
    }

    public function generateReport(Request $request, int $reportId): JsonResponse
    {
        $report = Report::query()->where('iReportId', $reportId)->firstOrFail();
        abort_if($report->status !== 'Testing', 422, 'Report must be in Testing status');

        $report->update([
            'status' => 'Report Generated',
            'report_generated_at' => now(),
            'updated_date' => now(),
            'updated_by' => $request->user()?->id,
        ]);

        // Advance workflow job to 'report-draft' stage
        $this->bridge->advanceToStage(
            $report->uid_no,
            'report-draft',
            $request->user(),
            "Report #{$report->iReportId} generated"
        );

        UserActivity::query()->create([
            'user_id' => $request->user()->id,
            'action' => 'report_generated',
            'module' => 'reports',
            'details' => "Generated report {$report->uid_no}",
            'ip_address' => $request->ip(),
            'created_at' => now(),
        ]);

        $adminIds = User::query()->where('is_admin', true)->pluck('id')->toArray();
        $groupAdminIds = DB::table('user_group')->where('group_id', 1)->pluck('user_id')->toArray();
        $admins = array_unique(array_merge($adminIds, $groupAdminIds));
        foreach ($admins as $adminId) {
            NotificationController::create(
                $adminId,
                'approval_needed',
                'Report pending approval',
                "Report {$report->uid_no} has been generated and needs approval.",
                ['report_id' => $report->iReportId, 'uid_no' => $report->uid_no],
            );
        }

        return response()->json(['message' => 'Report generated']);
    }

    public function approve(int $reportId): JsonResponse
    {
        $report = Report::query()->where('iReportId', $reportId)->firstOrFail();
        abort_if($report->status !== 'Report Generated', 422, 'Only generated reports can be approved');

        $report->update([
            'status' => 'Complete',
            'approved_at' => now(),
            'approved_by' => request()->user()?->id,
            'updated_date' => now(),
            'updated_by' => request()->user()?->id,
        ]);

        // Advance workflow job through 'technical-review' then 'approval' stage
        $this->bridge->advanceToStage(
            $report->uid_no,
            'technical-review',
            request()->user(),
            "Report #{$report->iReportId} submitted for technical review"
        );
        $this->bridge->advanceToStage(
            $report->uid_no,
            'approval',
            request()->user(),
            "Report #{$report->iReportId} approved"
        );

        UserActivity::query()->create([
            'user_id' => request()->user()->id,
            'action' => 'report_approved',
            'module' => 'reports',
            'details' => "Approved report {$report->uid_no}",
            'ip_address' => request()->ip(),
            'created_at' => now(),
        ]);

        if ($report->assigned_to) {
            NotificationController::create(
                $report->assigned_to,
                'report_approved',
                'Report approved',
                "Report {$report->uid_no} has been approved.",
                ['report_id' => $report->iReportId, 'uid_no' => $report->uid_no],
            );
        }

        return response()->json(['message' => 'Report approved']);
    }

    public function cancel(Request $request, int $reportId): JsonResponse
    {
        $validated = $request->validate([
            'cancel_remark' => ['nullable', 'string', 'max:255'],
        ]);

        $report = Report::query()->where('iReportId', $reportId)->firstOrFail();
        abort_if(in_array($report->status, ['Complete', 'Cancel'], true), 422, 'Report already completed or canceled');

        $report->update([
            'status' => 'Cancel',
            'cancel_remark' => $validated['cancel_remark'] ?? '',
            'updated_date' => now(),
            'updated_by' => $request->user()?->id,
        ]);

        return response()->json(['message' => 'Report canceled']);
    }

    public function myAssigned(Request $request): JsonResponse
    {
        $reports = Report::query()
            ->where('assigned_to', $request->user()->id)
            ->whereNotIn('status', ['Complete', 'Cancel'])
            ->orderByDesc('create_date')
            ->limit(50)
            ->get()
            ->map(fn (Report $report): array => [
                'iReportId' => $report->iReportId,
                'uid_no' => $report->uid_no,
                'report_type' => $report->report_type,
                'create_date' => optional($report->create_date)->format('d M Y'),
                'agency_name' => $report->agency_name,
                'material_details' => $report->material_details,
                'status' => $report->status,
            ]);

        return response()->json(['data' => $reports, 'count' => $reports->count()]);
    }

    public function export(Request $request, string $type): JsonResponse
    {
        abort_if(! isset(self::REPORT_TYPES[$type]), 404);

        $startDate = $request->query('start_date');
        $endDate = $request->query('end_date');

        $reports = Report::query()
            ->where('report_type', $type)
            ->when($startDate && $endDate, fn ($q) => $q->whereDate('create_date', '>=', $startDate)->whereDate('create_date', '<=', $endDate))
            ->orderByDesc('create_date')
            ->limit(1000)
            ->get([
                'iReportId',
                'uid_no',
                'customer_details',
                'agency_name',
                'reference_no',
                'material_details',
                'source_location',
                'status',
                'create_date',
            ]);

        return response()->json(['data' => $reports]);
    }

    public function reapprove(int $reportId): JsonResponse
    {
        $report = Report::query()->where('iReportId', $reportId)->firstOrFail();
        abort_if($report->status !== 'Cancel', 422, 'Only canceled reports can be reapproved');

        $report->update([
            'status' => 'Testing',
            'cancel_remark' => '',
            'testing_started_at' => null,
            'report_generated_at' => null,
            'approved_at' => null,
            'approved_by' => null,
            'updated_date' => now(),
            'updated_by' => request()->user()?->id,
        ]);

        UserActivity::query()->create([
            'user_id' => request()->user()->id,
            'action' => 'report_reapproved',
            'module' => 'reports',
            'details' => "Reapproved report {$report->uid_no}",
            'ip_address' => request()->ip(),
            'created_at' => now(),
        ]);

        return response()->json(['message' => 'Report reapproved', 'status' => 'Testing']);
    }

    public function saveObservations(Request $request, string $type, int $reportId): JsonResponse
    {
        abort_if(!isset(self::REPORT_TYPES[$type]), 404);

        $report = Report::query()->where('iReportId', $reportId)->where('report_type', $type)->firstOrFail();

        $config = self::REPORT_TYPES[$type];
        $detailModel = $config['model'];

        $details = $detailModel::query()->where('iReportId', $reportId)->get();

        $validated = $request->validate([
            'details' => ['required', 'array'],
        ]);

        foreach ($validated['details'] as $index => $item) {
            $pk = $config['pk'];
            $detail = $details->get($index);
            if ($detail) {
                $detail->update($item);
            } else {
                $item['iReportId'] = $reportId;
                $item[$pk] = ((int) ($detailModel::query()->max($pk) ?? 0)) + $index + 1;
                $detailModel::query()->create($item);
            }
        }

        if ($request->input('mark_complete')) {
            $report->update([
                'status' => 'Report Generated',
                'report_generated_at' => now(),
                'updated_date' => now(),
                'updated_by' => $request->user()?->id,
            ]);

            // Advance workflow job to 'report-draft' stage
            $this->bridge->advanceToStage(
                $report->uid_no,
                'report-draft',
                $request->user(),
                "Report #{$report->iReportId} observations complete — report generated"
            );

            $adminIds = User::query()->where('is_admin', true)->pluck('id')->toArray();
            $groupAdminIds = DB::table('user_group')->where('group_id', 1)->pluck('user_id')->toArray();
            $admins = array_unique(array_merge($adminIds, $groupAdminIds));
            foreach ($admins as $adminId) {
                NotificationController::create(
                    $adminId, 'approval_needed', 'Report pending approval',
                    "Report {$report->uid_no} has been generated and needs approval.",
                    ['report_id' => $report->iReportId, 'uid_no' => $report->uid_no],
                );
            }

            UserActivity::query()->create([
                'user_id' => $request->user()->id,
                'action' => 'report_generated',
                'module' => 'reports',
                'details' => "Generated report {$report->uid_no} from testing screen",
                'ip_address' => $request->ip(),
                'created_at' => now(),
            ]);
        }

        UserActivity::query()->create([
            'user_id' => $request->user()->id,
            'action' => 'observations_saved',
            'module' => 'reports',
            'details' => "Saved observations for report {$report->uid_no}",
            'ip_address' => $request->ip(),
            'created_at' => now(),
        ]);

        // Save report revision snapshot for version control (V1, V2, V3...)
        $this->snapshotVersion($report, 'Saved observation data', $request->user());

        return response()->json(['message' => 'Observations saved']);
    }

    public function versions(string $type, int $reportId): JsonResponse
    {
        $report = Report::query()->where('iReportId', $reportId)->firstOrFail();
        $versions = \App\Models\ReportVersion::query()
            ->with(['createdBy:id,firstname,lastname,username'])
            ->where('report_id', $reportId)
            ->orderByDesc('version_number')
            ->get();

        return response()->json([
            'data' => $versions,
            'current_version' => $versions->max('version_number') ?? 1,
        ]);
    }

    protected function snapshotVersion(Report $report, string $changeNotes = 'Report updated', ?User $user = null): void
    {
        $currentVersion = \App\Models\ReportVersion::where('report_id', $report->iReportId)->max('version_number') ?? 0;
        $nextVersion = $currentVersion + 1;

        $config = self::REPORT_TYPES[$report->report_type] ?? null;
        $details = [];
        if ($config) {
            $detailModel = $config['model'];
            $details = $detailModel::where('iReportId', $report->iReportId)->get()->toArray();
        }

        \App\Models\ReportVersion::create([
            'report_id' => $report->iReportId,
            'uid_no' => $report->uid_no,
            'report_type' => $report->report_type,
            'version_number' => $nextVersion,
            'change_notes' => $changeNotes,
            'snapshot_data' => [
                'report' => $report->toArray(),
                'details' => $details,
            ],
            'created_by' => $user?->id,
        ]);
    }

    public function update(Request $request, string $type, int $reportId): JsonResponse
    {
        abort_if(!isset(self::REPORT_TYPES[$type]), 404);
        
        $report = Report::query()->where('iReportId', $reportId)->where('report_type', $type)->firstOrFail();
        
        $validated = $request->validate([
            'reference_no' => ['nullable', 'string', 'max:255'],
            'work_order_no' => ['nullable', 'string', 'max:255'],
            'source_location' => ['nullable', 'string', 'max:255'],
            'customer_details' => ['nullable', 'string'],
            'material_details' => ['nullable', 'string'],
            'environment_condition' => ['nullable', 'string'],
            'sampled_by' => ['nullable', 'string', 'max:255'],
            'sample_date' => ['nullable', 'date'],
            'sample_tested_date' => ['nullable', 'date'],
            'dispatch_date' => ['nullable', 'date'],
        ]);

        $report->update(array_merge($validated, [
            'updated_date' => now(),
            'updated_by' => $request->user()?->id,
        ]));

        UserActivity::query()->create([
            'user_id' => $request->user()->id,
            'action' => 'report_updated',
            'module' => 'reports',
            'details' => "Updated core details for report {$report->uid_no}",
            'ip_address' => $request->ip(),
            'created_at' => now(),
        ]);

        return response()->json([
            'message' => 'Report updated successfully',
            'report' => $report,
        ]);
    }

    public function createCube(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'uid_no' => ['required', 'string'],
            'ulr_no' => ['required', 'string'],
            'customer_details' => ['required', 'string'],
            'agency_name' => ['required', 'string'],
            'reference_no' => ['required', 'string'],
            'material_details' => ['required', 'string'],
            'source_location' => ['required', 'string'],
            'work_order_no' => ['required', 'string'],
            'sample_date' => ['required', 'date'],
            'sample_tested_date' => ['required', 'date'],
            'dispatch_date' => ['nullable', 'date'],
            'sampled_by' => ['nullable', 'string'],
            'environment_condition' => ['nullable', 'string'],
        ]);
        $userId = (int) $request->user()->id;

        $reportId = DB::transaction(function () use ($validated, $userId, $request): int {
            $nextReportId = ((int) (Report::query()->max('iReportId') ?? 0)) + 1;
            $nextCubeId = ((int) (CubeReport::query()->max('iCubeId') ?? 0)) + 1;

            $report = Report::query()->create([
                'iReportId' => $nextReportId,
                'uid_no' => $validated['uid_no'],
                'ulr_no' => $validated['ulr_no'],
                'customer_details' => $validated['customer_details'],
                'agency_name' => $validated['agency_name'],
                'reference_no' => $validated['reference_no'],
                'material_details' => $validated['material_details'],
                'source_location' => $validated['source_location'],
                'work_order_no' => $validated['work_order_no'],
                'sample_date' => $validated['sample_date'],
                'sample_tested_date' => $validated['sample_tested_date'],
                'dispatch_date' => $validated['dispatch_date'] ?? '',
                'sampled_by' => $validated['sampled_by'] ?? '',
                'environment_condition' => $validated['environment_condition'] ?? '',
                'report_type' => 'cc_cube',
                'status' => 'Pending',
                'user_id' => $userId,
                'updated_by' => $userId,
                'updated_date' => now(),
                'create_date' => now(),
                'cancel_remark' => '',
            ]);

            CubeReport::query()->create([
                'iCubeId' => $nextCubeId,
                'iReportId' => $report->iReportId,
                'uid_no' => $validated['uid_no'],
                'location' => $validated['source_location'],
                'size_of_cube' => '150',
                'date_of_casting' => $validated['sample_date'],
                'date_of_testing' => $validated['sample_tested_date'],
                'age_of_specimen' => '28',
                'avg_comp_strength' => '0',
                'is_code_comp_strength' => '0',
                'load_1' => '0',
                'load_2' => '0',
                'load_3' => '0',
                'comp_strength_1' => '0',
                'comp_strength_2' => '0',
                'comp_strength_3' => '0',
                'set_count' => 1,
                'create_date' => now(),
            ]);

            // Advance workflow job to 'sample-received' stage
            $this->bridge->advanceToStage(
                $validated['uid_no'],
                'sample-received',
                $request->user(),
                "Cube report #{$nextReportId} created — sample received"
            );

            return $report->iReportId;
        });

        return response()->json([
            'message' => 'Cube report created',
            'iReportId' => $reportId,
        ], 201);
    }

    public function createReport(Request $request, string $type): JsonResponse
    {
        abort_if(!isset(self::REPORT_TYPES[$type]), 404, "Unknown report type: $type");

        // If cube, delegate to the existing dedicated method
        if ($type === 'cc_cube') {
            return $this->createCube($request);
        }

        $validated = $request->validate([
            'uid_no' => ['required', 'string'],
            'ulr_no' => ['nullable', 'string'],
            'customer_details' => ['required', 'string'],
            'agency_name' => ['required', 'string'],
            'reference_no' => ['nullable', 'string'],
            'material_details' => ['required', 'string'],
            'source_location' => ['nullable', 'string'],
            'work_order_no' => ['nullable', 'string'],
            'sample_date' => ['required', 'date'],
            'sample_tested_date' => ['required', 'date'],
            'dispatch_date' => ['nullable', 'date'],
            'sampled_by' => ['nullable', 'string'],
            'environment_condition' => ['nullable', 'string'],
        ]);

        $userId = (int) $request->user()->id;
        $config = self::REPORT_TYPES[$type];

        $reportId = DB::transaction(function () use ($validated, $userId, $type, $config, $request): int {
            $nextReportId = ((int) (Report::query()->max('iReportId') ?? 0)) + 1;

            $report = Report::query()->create([
                'iReportId' => $nextReportId,
                'uid_no' => $validated['uid_no'],
                'ulr_no' => $validated['ulr_no'] ?? '',
                'customer_details' => $validated['customer_details'],
                'agency_name' => $validated['agency_name'],
                'reference_no' => $validated['reference_no'] ?? '',
                'material_details' => $validated['material_details'],
                'source_location' => $validated['source_location'] ?? '',
                'work_order_no' => $validated['work_order_no'] ?? '',
                'sample_date' => $validated['sample_date'],
                'sample_tested_date' => $validated['sample_tested_date'],
                'dispatch_date' => $validated['dispatch_date'] ?? '',
                'sampled_by' => $validated['sampled_by'] ?? '',
                'environment_condition' => $validated['environment_condition'] ?? '',
                'report_type' => $type,
                'status' => 'Pending',
                'user_id' => $userId,
                'updated_by' => $userId,
                'updated_date' => now(),
                'create_date' => now(),
                'cancel_remark' => '',
            ]);

            // Create a default detail row in the type-specific table
            $detailModel = $config['model'];
            $pk = $config['pk'];
            $nextDetailId = ((int) ($detailModel::query()->max($pk) ?? 0)) + 1;

            $detailData = [
                $pk => $nextDetailId,
                'iReportId' => $report->iReportId,
                'uid_no' => $validated['uid_no'],
            ];

            // Add common default fields if they exist on the model
            if (in_array($config['table'], ['concretecore_report', 'concretebeam_report'])) {
                $detailData['create_date'] = now();
            }

            $detailModel::query()->create($detailData);

            // Advance workflow
            $this->bridge->advanceToStage(
                $validated['uid_no'],
                'sample-received',
                $request->user(),
                ucfirst($config['label']) . " report #{$nextReportId} created — sample received"
            );

            return $report->iReportId;
        });

        UserActivity::query()->create([
            'user_id' => $userId,
            'action' => 'report_created',
            'module' => 'reports',
            'details' => "Created {$config['label']} report for {$validated['uid_no']}",
            'ip_address' => $request->ip(),
            'created_at' => now(),
        ]);

        return response()->json([
            'message' => "{$config['label']} report created",
            'iReportId' => $reportId,
        ], 201);
    }

    public function destroy(Request $request, string $type, int $reportId): JsonResponse
    {
        abort_if(!isset(self::REPORT_TYPES[$type]), 404, "Unknown report type: $type");

        $report = Report::query()->where('iReportId', $reportId)->where('report_type', $type)->firstOrFail();
        $config = self::REPORT_TYPES[$type];

        DB::transaction(function () use ($report, $config, $reportId): void {
            // Delete type-specific detail rows
            $config['model']::query()->where('iReportId', $reportId)->delete();
            // Delete the main report
            $report->delete();
        });

        UserActivity::query()->create([
            'user_id' => $request->user()->id,
            'action' => 'report_deleted',
            'module' => 'reports',
            'details' => "Deleted {$config['label']} report #{$reportId} ({$report->uid_no})",
            'ip_address' => $request->ip(),
            'created_at' => now(),
        ]);

        return response()->json(['message' => "{$config['label']} report deleted"]);
    }
}
