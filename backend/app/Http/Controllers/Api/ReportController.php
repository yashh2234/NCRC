<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CubeReport;
use App\Models\Notification;
use App\Models\Company;
use App\Models\Report;
use App\Services\ReportApproval;
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

    public const EXCEL_TEMPLATES = [
        'acc_block' => 'ACC Block',
        'bitumen_sample_dbm_bc' => 'Bitumen Sample',
        'bm_ii_mix' => 'BM-II Mix',
        'cement_opc_43' => 'Cement OPC-43',
        'chequered_tile_22mm' => 'Chequered Tile 22 mm',
        'clay_bricks' => 'Clay Bricks',
        'flyash_bricks' => 'Fly Ash Bricks',
        'dbm_bc_density' => 'Bitumen Core Density',
        'fcdc_ferro_cover' => 'FCDC Ferro Cover',
        'grit_10mm' => 'Grit 10mm',
        'grit_20mm' => 'Grit 20mm',
        'gsb_iii_mix' => 'GSB-III Mix',
        'interlocking_60mm' => 'Interlocking 60mm',
        'interlocking_80mm' => 'Interlocking 80mm',
        'interlocking_100mm' => 'Interlocking 100mm',
        'kerb_stone' => 'Kerb Stone',
        'm30_mix' => 'M-30 Mix',
        'main_hole_cover_hd20' => 'Main Hole Cover HD 20',
        'sand' => 'Sand',
        'soil_omc_mdd_cbr' => 'Soil OMC MDD & CBR',
        'steel_fe415' => 'Steel Fe-415',
        'steel_fe415d' => 'Steel Fe-415D',
        'steel_fe500' => 'Steel Fe-500',
        'steel_fe500d' => 'Steel Fe-500D',
        'steel_fe550' => 'Steel Fe-550',
        'steel_fe550d' => 'Steel Fe-550D',
        'verified_floor_tile' => 'Verified Floor Tile',
        'water' => 'Water',
        'wmm_mix' => 'WMM Mix OMC MDD',
    ];

    public function printReport(Request $request, string $type, int $reportId)
    {
        abort_if(! isset(self::REPORT_TYPES[$type]), 404, "Unknown report type: $type");

        $report = Report::query()->where('iReportId', $reportId)->where('report_type', $type)->firstOrFail();
        $config = self::REPORT_TYPES[$type];
        $detailModel = $config['model'];
        $pk = (new $detailModel())->getKeyName();
        $details = $detailModel::query()->where('iReportId', $reportId)->orderBy($pk)->get();
        $company = Company::query()->first();

        $payload = [
            'report' => $report,
            'details' => $details,
            'company' => $company,
        ];

        return response()->json($payload);
    }

    public function types(): JsonResponse
    {
        $user = request()->user();
        $counts = function (string $key) use ($user): array {
            $query = $this->typeQuery($key);
            return [
                'total' => (clone $query)->count(),
                'pending' => (clone $query)->where('status', 'Pending')->count(),
                'testing' => (clone $query)->where('status', 'Testing')->count(),
                'generated' => (clone $query)->where('status', 'Report Generated')->count(),
                'assigned_to_me' => $user ? (clone $query)->where('assigned_to', $user->id)->whereNotIn('status', ['Complete', 'Cancel'])->count() : 0,
            ];
        };

        $types = [['key' => 'all', 'label' => 'All tests', 'is_all' => true] + $counts('all')];
        foreach (self::REPORT_TYPES as $key => $config) {
            $types[] = ['key' => $key, 'label' => $config['label']] + $counts($key);
        }
        foreach (self::EXCEL_TEMPLATES as $key => $label) {
            $types[] = ['key' => 'template:' . $key, 'label' => $label, 'is_template' => true, 'template_key' => $key] + $counts('template:' . $key);
        }

        return response()->json(['data' => $types]);
    }

    /** Reports for a list selection: 'all', a report type, or 'template:<format key>' */
    private function typeQuery(string $type): \Illuminate\Database\Eloquent\Builder
    {
        if ($type === 'all') {
            return Report::query();
        }
        if (str_starts_with($type, 'template:')) {
            return Report::query()->where('lab_data->_template', substr($type, strlen('template:')));
        }

        return Report::query()->where('report_type', $type);
    }

    public function index(Request $request, string $type): JsonResponse
    {
        // 'all' = every test; 'template:<key>' = reports saved in that lab-report format
        $templateKey = str_starts_with($type, 'template:') ? substr($type, strlen('template:')) : null;
        abort_if(
            $type !== 'all' && ! isset(self::REPORT_TYPES[$type]) && ! isset(self::EXCEL_TEMPLATES[$templateKey ?? '']),
            404,
            "Unknown report type: $type",
        );

        $startDate = $request->query('start_date');
        $endDate = $request->query('end_date');
        $statusFilter = $request->query('status');
        $assignedToMe = $request->query('assigned_to_me');
        $search = trim((string) $request->query('search', ''));
        $perPage = 50;
        $page = max(1, (int) $request->query('page', 1));

        $query = $this->typeQuery($type)
            ->when($startDate && $endDate, function ($query) use ($startDate, $endDate): void {
                $query->whereDate('create_date', '>=', $startDate)
                    ->whereDate('create_date', '<=', $endDate);
            })
            ->when($statusFilter, fn ($q, $s) => $q->where('status', $s))
            ->when($search !== '', function ($q) use ($search): void {
                $q->where(function ($query) use ($search): void {
                    $query->where('uid_no', 'like', '%' . $search . '%')
                        ->orWhere('agency_name', 'like', '%' . $search . '%')
                        ->orWhere('customer_details', 'like', '%' . $search . '%')
                        ->orWhere('material_details', 'like', '%' . $search . '%');
                });
            })
            ->when($assignedToMe, fn ($q) => $q->where('assigned_to', $request->user()->id));

        $total = (clone $query)->count();
        $rows = $query
            ->orderByDesc('create_date')
            ->orderByDesc('iReportId')
            ->forPage($page, $perPage)
            ->get();

        // Old software's cube list also showed Date of casting / Date of testing (first cube set).
        $cubeDates = $type === 'cc_cube'
            ? CubeReport::query()->whereIn('iReportId', $rows->pluck('iReportId'))->orderBy('iCubeId')
                ->get(['iReportId', 'date_of_casting', 'date_of_testing'])->unique('iReportId')->keyBy('iReportId')
            : collect();

        $reports = $rows->map(fn (Report $report): array => [
                'iReportId' => $report->iReportId,
                'report_type' => $report->report_type,
                'type_label' => self::REPORT_TYPES[$report->report_type]['label'] ?? $report->report_type,
                'format_label' => self::EXCEL_TEMPLATES[($report->lab_data ?? [])['_template'] ?? ''] ?? null,
                'uid_no' => $report->uid_no,
                'ulr_no' => $report->ulr_no,
                'job_id' => $report->job_id,
                'create_date' => optional($report->create_date)->format('Y-m-d'),
                'customer_details' => $report->customer_details,
                'agency_name' => $report->agency_name,
                'reference_no' => $report->reference_no,
                'material_details' => $report->material_details,
                'source_location' => $report->source_location,
                'work_order_no' => $report->work_order_no,
                'sample_date' => $report->sample_date,
                'sample_tested_date' => $report->sample_tested_date,
                'date_of_casting' => $cubeDates[$report->iReportId]->date_of_casting ?? null,
                'date_of_testing' => $cubeDates[$report->iReportId]->date_of_testing ?? null,
                'status' => $report->status,
                'assigned_to' => $report->assigned_to,
            ]);

        return response()->json([
            'count' => $total,
            'page' => $page,
            'per_page' => $perPage,
            'last_page' => max(1, (int) ceil($total / $perPage)),
            'data' => $reports,
            'type' => $type,
            'config' => self::REPORT_TYPES[$type] ?? null,
        ]);
    }

    public function show(string $type, int $reportId): JsonResponse
    {
        abort_if(! isset(self::REPORT_TYPES[$type]), 404, "Unknown report type: $type");

        $report = Report::query()->where('iReportId', $reportId)->where('report_type', $type)->firstOrFail();
        $config = self::REPORT_TYPES[$type];
        $detailModel = $config['model'];
        // Rows in entry order (results screen and print number them 1, 2, 3…)
        $details = $detailModel::query()->where('iReportId', $reportId)->orderBy((new $detailModel())->getKeyName())->get();

        $assignedUser = null;
        if ($report->assigned_to) {
            $assignedUser = User::query()->find($report->assigned_to, ['id', 'firstname', 'lastname', 'username']);
        }
        // Approved reports carry the public link (QR on the print); older approved reports get it on first open
        if ($report->status === 'Complete') {
            $report->ensurePublicToken();
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

        ReportApproval::notify($report, 'Report pending approval', "Report {$report->uid_no} has been generated and needs approval.");

        return response()->json(['message' => 'Report generated']);
    }

    public function approve(int $reportId): JsonResponse
    {
        abort_unless(request()->user()?->canApproveReports(), 403, 'You cannot approve reports.');
        $report = Report::query()->where('iReportId', $reportId)->firstOrFail();
        // Old software: "Approved Report" works from any status (confirm popup on the edit page).
        abort_if($report->status === 'Complete', 422, 'Report is already approved');
        abort_if($report->status === 'Cancel', 422, 'Reapprove the cancelled report first');

        $report->update([
            'status' => 'Complete',
            'approved_at' => now(),
            'approved_by' => request()->user()?->id,
            'updated_date' => now(),
            'updated_by' => request()->user()?->id,
        ]);
        $report->ensurePublicToken();

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

        $plain = fn ($v) => trim(str_replace("\r\n", "\n", (string) $v));
        $changed = false;
        foreach ($validated['details'] as $index => $item) {
            $pk = $config['pk'];
            $detail = $details->get($index);
            if ($detail) {
                $old = $detail->getAttributes();
                $detail->update($item);
                foreach ($detail->getChanges() as $key => $value) {
                    $changed = $changed || $plain($old[$key] ?? '') !== $plain($value);
                }
            } else {
                // The edit screen's stand-in row ({ set_count }) is not a result
                $changed = $changed || array_filter(array_diff_key($item, ['set_count' => 1]), fn ($v) => $plain($v) !== '') !== [];
                $item['iReportId'] = $reportId;
                $item[$pk] = ((int) ($detailModel::query()->max($pk) ?? 0)) + $index + 1;
                $detailModel::query()->create($item);
            }
        }

        if ($changed) {
            ReportApproval::changed($report, $request->user());
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

            ReportApproval::notify($report, 'Report pending approval', "Report {$report->uid_no} has been generated and needs approval.");

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
            'lab_data' => ['nullable', 'array'],
        ]);

        // Legacy `reports` columns are NOT NULL varchar: an emptied box (sent as null) is saved as ''.
        foreach ($validated as $key => $value) {
            if ($value === null && $key !== 'lab_data') $validated[$key] = '';
        }

        $before = ReportApproval::content($report);
        $report->update(array_merge($validated, [
            'updated_date' => now(),
            'updated_by' => $request->user()?->id,
        ]));
        if ($before !== ReportApproval::content($report->fresh())) {
            ReportApproval::changed($report, $request->user());
        }

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
            // Old software (cubereport/create) required only UID and ULR; the rest is optional.
            'uid_no' => ['required', 'string'],
            'ulr_no' => ['required', 'string'],
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
            'lab_data' => ['nullable', 'array'],
            // Cube sets entered while creating
            'sets' => ['nullable', 'array', 'max:40'],
            'sets.*.location' => ['nullable', 'string'],
            'sets.*.size_of_cube' => ['nullable', 'string'],
            'sets.*.date_of_casting' => ['nullable', 'string'],
            'sets.*.date_of_testing' => ['nullable', 'string'],
            'sets.*.age_of_specimen' => ['nullable', 'string'],
            'sets.*.load_1' => ['nullable', 'string'],
            'sets.*.load_2' => ['nullable', 'string'],
            'sets.*.load_3' => ['nullable', 'string'],
            'sets.*.comp_strength_1' => ['nullable', 'string'],
            'sets.*.comp_strength_2' => ['nullable', 'string'],
            'sets.*.comp_strength_3' => ['nullable', 'string'],
            'sets.*.avg_comp_strength' => ['nullable', 'string'],
            'sets.*.is_code_comp_strength' => ['nullable', 'string'],
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
                'reference_no' => $validated['reference_no'] ?? '',
                'material_details' => $validated['material_details'],
                'source_location' => $validated['source_location'] ?? '',
                'work_order_no' => $validated['work_order_no'] ?? '',
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
                'lab_data' => $validated['lab_data'] ?? null,
            ]);

            // One cube row per set (old software: countset rows); defaults when no sets were sent.
            $sets = $validated['sets'] ?? [[]];
            $setCount = max(1, count($sets));
            foreach (array_values($sets) as $i => $set) {
                CubeReport::query()->create([
                    'iCubeId' => $nextCubeId + $i,
                    'iReportId' => $report->iReportId,
                    'uid_no' => $validated['uid_no'],
                    'location' => ($set['location'] ?? '') !== '' ? $set['location'] : ($validated['source_location'] ?? ''),
                    'size_of_cube' => ($set['size_of_cube'] ?? '') !== '' ? $set['size_of_cube'] : '150',
                    'date_of_casting' => ($set['date_of_casting'] ?? '') !== '' ? $set['date_of_casting'] : $validated['sample_date'],
                    'date_of_testing' => ($set['date_of_testing'] ?? '') !== '' ? $set['date_of_testing'] : $validated['sample_tested_date'],
                    'age_of_specimen' => ($set['age_of_specimen'] ?? '') !== '' ? $set['age_of_specimen'] : '28',
                    'avg_comp_strength' => ($set['avg_comp_strength'] ?? '') !== '' ? $set['avg_comp_strength'] : '0',
                    'is_code_comp_strength' => ($set['is_code_comp_strength'] ?? '') !== '' ? $set['is_code_comp_strength'] : '0',
                    'load_1' => ($set['load_1'] ?? '') !== '' ? $set['load_1'] : '0',
                    'load_2' => ($set['load_2'] ?? '') !== '' ? $set['load_2'] : '0',
                    'load_3' => ($set['load_3'] ?? '') !== '' ? $set['load_3'] : '0',
                    'comp_strength_1' => ($set['comp_strength_1'] ?? '') !== '' ? $set['comp_strength_1'] : '0',
                    'comp_strength_2' => ($set['comp_strength_2'] ?? '') !== '' ? $set['comp_strength_2'] : '0',
                    'comp_strength_3' => ($set['comp_strength_3'] ?? '') !== '' ? $set['comp_strength_3'] : '0',
                    'set_count' => $setCount,
                    'create_date' => now(),
                ]);
            }

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
            'lab_data' => ['nullable', 'array'],
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
                'lab_data' => $validated['lab_data'] ?? null,
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

            // Legacy detail tables have NOT NULL columns without defaults: start every column empty
            // (dates/set count get real values) so the blank results row can be inserted.
            $columns = DB::select(
                'SELECT COLUMN_NAME c, DATA_TYPE t, IS_NULLABLE n, COLUMN_DEFAULT d FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
                [$config['table']]
            );
            foreach ($columns as $col) {
                // Column names are case-insensitive in MySQL (e.g. iBitumenLid vs iBitumenLId)
                if (in_array(strtolower($col->c), array_map('strtolower', array_keys($detailData)), true) || $col->n === 'YES' || $col->d !== null) continue;
                $detailData[$col->c] = match (true) {
                    in_array($col->t, ['int', 'bigint', 'smallint', 'tinyint', 'decimal', 'float', 'double'], true) => $col->c === 'set_count' ? 1 : 0,
                    in_array($col->t, ['date', 'datetime', 'timestamp'], true) => now(),
                    default => '',
                };
            }

            // Add common default fields if they exist on the model
            if (in_array($config['table'], ['concretecore_report', 'concretebeam_report'])) {
                $detailData['create_date'] = now();
            }

            // Straight insert: the models' $fillable lists don't cover every legacy column.
            DB::table($config['table'])->insert($detailData);

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
