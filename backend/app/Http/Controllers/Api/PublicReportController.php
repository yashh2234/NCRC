<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Report;
use Illuminate\Http\JsonResponse;

/**
 * Public view of an approved report, opened from the QR code on the print
 * (reports.namotech.in/r/{token}). No login: the random token is the key.
 * Only approved reports, and only the fields the printed report shows.
 */
class PublicReportController extends Controller
{
    /** Report columns the print uses (header rows, ULR, dates, lab data) */
    private const REPORT_FIELDS = [
        'uid_no', 'ulr_no', 'customer_details', 'agency_name', 'reference_no', 'material_details',
        'source_location', 'work_order_no', 'sample_date', 'sample_tested_date', 'dispatch_date',
        'sampled_by', 'environment_condition', 'report_type', 'create_date', 'lab_data',
    ];

    /** Detail-row columns never shown on the report */
    private const HIDDEN_DETAIL_FIELDS = ['user_id', 'updated_by', 'created_by', 'iUserId', 'create_date', 'updated_date', 'created_at', 'updated_at'];

    public function show(string $token): JsonResponse
    {
        abort_unless(preg_match('/^[A-Za-z0-9]{16,40}$/', $token) === 1, 404);

        $report = Report::query()->where('public_token', $token)->first();
        abort_if(! $report || $report->status !== 'Complete', 404, 'Report not found or not valid');

        $type = (string) $report->report_type;
        $config = ReportController::REPORT_TYPES[$type] ?? null;
        abort_if(! $config, 404, 'Report not found or not valid');

        $detailModel = $config['model'];
        $details = $detailModel::query()
            ->where('iReportId', $report->iReportId)
            ->orderBy((new $detailModel())->getKeyName())
            ->get()
            ->map(fn ($row) => collect($row->toArray())->except(self::HIDDEN_DETAIL_FIELDS)->all());

        $data = [];
        foreach (self::REPORT_FIELDS as $field) {
            $value = $report->{$field};
            $data[$field] = $value instanceof \DateTimeInterface ? $value->format('Y-m-d') : $value;
        }

        return response()->json(['type' => $type, 'report' => $data, 'details' => $details])
            ->header('Cache-Control', 'no-store')
            ->header('X-Robots-Tag', 'noindex, nofollow');
    }
}
