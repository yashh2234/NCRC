<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DueReportsController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = '
            SELECT 
                cr.iClientId,
                cr.uid_no,
                cr.received_date,
                cr.agency_name,
                cr.reporting_address,
                cr.mobile_no,
                cr.name_of_work,
                cr.sample_details,
                cr.total_payment,
                cr.advance_payment,
                cr.balance_dues,
                cr.scan_copy,
                cr.report_copy
            FROM client_registration cr
            WHERE cr.uid_no NOT IN (
                SELECT DISTINCT uid_no FROM reports
            )
            AND (cr.report_no IS NULL OR cr.report_no = \'\')
            AND (cr.report_copy IS NULL OR cr.report_copy = \'\')
            AND cr.received_date < DATE_SUB(NOW(), INTERVAL 7 DAY)
        ';

        $bindings = [];

        $startDate = $request->query('start_date');
        $endDate = $request->query('end_date');
        if ($startDate && $endDate) {
            $query .= ' AND cr.received_date >= ? AND cr.received_date <= ?';
            $bindings[] = $startDate;
            $bindings[] = $endDate;
        }

        $query .= ' ORDER BY cr.received_date DESC';

        $registrations = DB::select($query, $bindings);

        return response()->json(['data' => $registrations]);
    }
}
