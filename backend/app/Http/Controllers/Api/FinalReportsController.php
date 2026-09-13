<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Report;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FinalReportsController extends Controller
{
    private const REPORT_TYPE_LABELS = [
        'cc_cube' => 'CC Cube',
        'cc_core' => 'Concrete Core',
        'cc_beam' => 'Concrete Beam',
        'bitumen_core' => 'Bitumen Core',
        'bitumen_loose' => 'Bitumen Loose',
        'bricks' => 'Bricks',
        'ferro_cover' => 'Ferro Cover',
        'interlocking' => 'Interlocking Tiles',
        'mainhole_cover' => 'Mainhole Cover',
        'mes' => 'MES',
        'sand' => 'Sand',
        'water' => 'Water',
    ];

    public function index(Request $request): JsonResponse
    {
        $startDate = $request->query('start_date');
        $endDate = $request->query('end_date');
        $statusFilter = $request->query('status');
        $typeFilter = $request->query('type');

        $reports = Report::query()
            ->when($startDate && $endDate, function ($query) use ($startDate, $endDate): void {
                $query->whereDate('create_date', '>=', $startDate)
                    ->whereDate('create_date', '<=', $endDate);
            })
            ->when($statusFilter, fn ($q, $s) => $q->where('status', $s))
            ->when($typeFilter, fn ($q, $t) => $q->where('report_type', $t))
            ->orderByDesc('create_date')
            ->orderByDesc('iReportId')
            ->limit(200)
            ->get()
            ->map(fn (Report $report): array => [
                'iReportId' => $report->iReportId,
                'uid_no' => $report->uid_no,
                'create_date' => optional($report->create_date)->format('d M Y'),
                'agency_name' => $report->agency_name,
                'report_type' => $report->report_type,
                'report_type_label' => self::REPORT_TYPE_LABELS[$report->report_type] ?? $report->report_type,
                'status' => $report->status,
                'material_details' => $report->material_details,
                'reference_no' => $report->reference_no,
            ]);

        return response()->json(['data' => $reports]);
    }

    public function destroy(int $id): JsonResponse
    {
        $report = Report::query()->where('iReportId', $id)->firstOrFail();

        $config = ReportController::REPORT_TYPES[$report->report_type] ?? null;
        if ($config) {
            $config['model']::query()->where('iReportId', $id)->delete();
        }

        $report->delete();

        return response()->json(['message' => 'Report deleted']);
    }

    public function export(Request $request): JsonResponse
    {
        $startDate = $request->query('start_date');
        $endDate = $request->query('end_date');
        $statusFilter = $request->query('status');
        $typeFilter = $request->query('type');

        $reports = Report::query()
            ->when($startDate && $endDate, function ($query) use ($startDate, $endDate): void {
                $query->whereDate('create_date', '>=', $startDate)
                    ->whereDate('create_date', '<=', $endDate);
            })
            ->when($statusFilter, fn ($q, $s) => $q->where('status', $s))
            ->when($typeFilter, fn ($q, $t) => $q->where('report_type', $t))
            ->orderByDesc('create_date')
            ->orderByDesc('iReportId')
            ->limit(5000)
            ->get()
            ->map(fn (Report $report): array => [
                'iReportId' => $report->iReportId,
                'uid_no' => $report->uid_no,
                'create_date' => optional($report->create_date)->format('d M Y'),
                'agency_name' => $report->agency_name,
                'report_type' => $report->report_type,
                'report_type_label' => self::REPORT_TYPE_LABELS[$report->report_type] ?? $report->report_type,
                'status' => $report->status,
                'material_details' => $report->material_details,
                'reference_no' => $report->reference_no,
                'customer_details' => $report->customer_details,
                'source_location' => $report->source_location,
            ]);

        return response()->json(['data' => $reports]);
    }
}
