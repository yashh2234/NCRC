<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Registration;
use App\Models\Report;
use App\Models\Client;
use App\Models\Jobs;
use App\Models\JobStageTracking;
use App\Models\User;
use App\Models\Billing;
use App\Models\Invoice;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class AnalyticsController extends Controller
{
    public function summary(Request $request)
    {
        $year = $request->input('year', date('Y'));
        $months = $request->input('months', 12);

        return response()->json([
            'revenue' => $this->revenueAnalytics($year, $months),
            'tests' => $this->testAnalytics($year, $months),
            'turnaround' => $this->turnaroundAnalytics($year, $months),
            'productivity' => $this->productivityAnalytics($year, $months),
            'clients' => $this->clientAnalytics($year, $months),
            'delays' => $this->delayAnalytics(),
            'overview' => $this->overviewStats(),
        ]);
    }

    protected function overviewStats(): array
    {
        return [
            'total_registrations' => Registration::count(),
            'total_reports' => Report::count(),
            'pending_reports' => Report::whereIn('status', ['Pending', 'Testing'])->count(),
            'total_clients' => Client::count(),
            'active_jobs' => Jobs::where('status', 'active')->count(),
            'overdue_jobs' => JobStageTracking::whereNull('exited_at')
                ->where('is_overdue', true)->count(),
            'total_billing' => Billing::sum('bill_amount') ?? 0,
            'total_received' => Billing::sum('amount_received') ?? 0,
            'total_invoiced' => Invoice::sum('net_amount') ?? 0,
        ];
    }

    protected function revenueAnalytics(int $year, int $months): array
    {
        $start = now()->subMonths($months)->startOfMonth();

        $monthly = Registration::selectRaw(
            "DATE_FORMAT(STR_TO_DATE(received_date, '%d-%m-%Y'), '%Y-%m') as month,
             COUNT(*) as total,
             COALESCE(SUM(CAST(REPLACE(total_payment, ',', '') AS DECIMAL(12,2))), 0) as total_amount,
             COALESCE(SUM(CAST(REPLACE(advance_payment, ',', '') AS DECIMAL(12,2))), 0) as advance_amount,
             COALESCE(SUM(CAST(REPLACE(balance_dues, ',', '') AS DECIMAL(12,2))), 0) as balance_amount"
        )
            ->whereNotNull('received_date')
            ->where('received_date', '!=', '')
            ->groupByRaw("DATE_FORMAT(STR_TO_DATE(received_date, '%d-%m-%Y'), '%Y-%m')")
            ->orderBy('month')
            ->get();

        $invoiceMonthly = Invoice::selectRaw(
            "DATE_FORMAT(date, '%Y-%m') as month,
             COUNT(*) as invoice_count,
             COALESCE(SUM(net_amount), 0) as net_amount,
             COALESCE(SUM(gst_amount), 0) as gst_amount"
        )
            ->whereNotNull('date')
            ->groupBy('month')
            ->orderBy('month')
            ->get()
            ->keyBy('month');

        return [
            'monthly_registrations' => $monthly,
            'monthly_invoices' => $invoiceMonthly,
            'year_total' => $monthly->sum('total_amount'),
            'year_invoiced' => $invoiceMonthly->sum('net_amount'),
        ];
    }

    protected function testAnalytics(int $year, int $months): array
    {
        $reportModels = [
            'cc_cube' => \App\Models\CubeReport::class,
            'cc_core' => \App\Models\ConcretecoreReport::class,
            'cc_beam' => \App\Models\ConcretebeamReport::class,
            'bitumen_core' => \App\Models\BitumencoreReport::class,
            'bitumen_loose' => \App\Models\BitumenlooseReport::class,
            'bricks' => \App\Models\BricksReport::class,
            'ferro_cover' => \App\Models\FerrocoverReport::class,
            'interlocking' => \App\Models\InterlockingtilesReport::class,
            'mainhole_cover' => \App\Models\MainholecoverReport::class,
            'mes' => \App\Models\MesReport::class,
            'sand' => \App\Models\SandReport::class,
            'water' => \App\Models\WaterReport::class,
        ];

        $testVolume = [];
        $statusBreakdown = [];
        $totalAll = 0;

        foreach ($reportModels as $key => $modelClass) {
            $count = $modelClass::count();
            $totalAll += $count;
            $testVolume[] = ['type' => $key, 'total' => $count];

            $statuses = $modelClass::selectRaw('status, COUNT(*) as count')
                ->groupBy('status')
                ->pluck('count', 'status');

            foreach ($statuses as $s => $c) {
                $statusBreakdown[$s] = ($statusBreakdown[$s] ?? 0) + $c;
            }
        }

        // By month
        $reportDateColumn = $this->reportDateColumn();
        $monthlyTests = Report::selectRaw(
            "report_type, DATE_FORMAT({$reportDateColumn}, '%Y-%m') as month, COUNT(*) as total"
        )
            ->whereNotNull($reportDateColumn)
            ->groupBy('report_type', 'month')
            ->orderBy('month')
            ->get()
            ->groupBy('month');

        return [
            'by_type' => $testVolume,
            'by_status' => collect($statusBreakdown),
            'monthly' => $monthlyTests,
            'total' => $totalAll,
        ];
    }

    protected function turnaroundAnalytics(int $year, int $months): array
    {
        $start = now()->subMonths($months);
        $reportDateColumn = $this->reportDateColumn();

        $averages = DB::table('reports')
            ->selectRaw(
                "report_type,
                 AVG(TIMESTAMPDIFF(HOUR, {$reportDateColumn}, COALESCE(report_generated_at, approved_at, updated_at))) as avg_hours,
                 MIN(TIMESTAMPDIFF(HOUR, {$reportDateColumn}, COALESCE(report_generated_at, approved_at, updated_at))) as min_hours,
                 MAX(TIMESTAMPDIFF(HOUR, {$reportDateColumn}, COALESCE(report_generated_at, approved_at, updated_at))) as max_hours,
                 COUNT(*) as count"
            )
            ->whereNotNull($reportDateColumn)
            ->whereIn('status', ['Complete', 'Approved', 'Report Generated', 'Dispatched'])
            ->groupBy('report_type')
            ->get();

        return ['by_type' => $averages];
    }

    protected function productivityAnalytics(int $year, int $months): array
    {
        $users = User::withCount([
            'activities as reports_generated' => function ($q) {
                $q->where('action', 'like', '%generate%');
            },
        ])
            ->withCount([
                'activities as tests_completed' => function ($q) {
                    $q->where('action', 'like', '%test%')
                      ->orWhere('action', 'like', '%observation%');
                },
            ])
            ->limit(20)
            ->get(['id', 'firstname', 'lastname', 'is_admin']);

        return $users->map(fn ($u) => [
            'name' => $u->name,
            'is_admin' => $u->is_admin,
            'reports_generated' => (int) $u->reports_generated,
            'tests_completed' => (int) $u->tests_completed,
        ]);
    }

    protected function clientAnalytics(int $year, int $months): array
    {
        $topByRegistrations = Registration::selectRaw(
            'agency_name, COUNT(*) as total, COALESCE(SUM(CAST(REPLACE(total_payment, ",", "") AS DECIMAL(12,2))), 0) as total_amount'
        )
            ->whereNotNull('agency_name')
            ->where('agency_name', '!=', '')
            ->groupBy('agency_name')
            ->orderBy('total', 'desc')
            ->limit(10)
            ->get();

        $topByRevenue = Registration::selectRaw(
            'agency_name, COALESCE(SUM(CAST(REPLACE(total_payment, ",", "") AS DECIMAL(12,2))), 0) as total_amount, COUNT(*) as total'
        )
            ->whereNotNull('agency_name')
            ->where('agency_name', '!=', '')
            ->groupBy('agency_name')
            ->orderBy('total_amount', 'desc')
            ->limit(10)
            ->get();

        return [
            'top_by_volume' => $topByRegistrations,
            'top_by_revenue' => $topByRevenue,
        ];
    }

    protected function delayAnalytics(): array
    {
        $overdueTrackings = JobStageTracking::whereNull('exited_at')
            ->where('is_overdue', true)
            ->with(['job', 'stage'])
            ->limit(20)
            ->get()
            ->map(fn ($t) => [
                'uid' => $t->job?->uid_no,
                'stage' => $t->stage?->name,
                'overdue_minutes' => $t->overdue_minutes,
                'overdue_hours' => round($t->overdue_minutes / 60, 1),
                'sla_deadline' => $t->sla_deadline?->toDateTimeString(),
            ]);

        $oldReports = Report::selectRaw(
            "uid_no, report_type, status, {$this->reportDateColumn()} as report_date, DATEDIFF(NOW(), {$this->reportDateColumn()}) as days_pending"
        )
            ->whereIn('status', ['Pending', 'Testing'])
            ->whereNotNull('create_date')
            ->having('days_pending', '>', 7)
            ->orderBy('days_pending', 'desc')
            ->limit(10)
            ->get();

        return [
            'overdue_stages' => $overdueTrackings,
            'long_pending_reports' => $oldReports,
        ];
    }

    private function reportDateColumn(): string
    {
        return Schema::hasColumn('reports', 'create_date') ? 'create_date' : 'created_at';
    }

    /**
     * Export analytics data as CSV.
     */
    public function exportCsv(Request $request)
    {
        $type = $request->input('type', 'revenue');

        $headers = [];
        $rows = [];

        switch ($type) {
            case 'revenue':
                $data = $this->revenueAnalytics((int) $request->input('year', date('Y')), 12);
                $headers = ['Month', 'Registrations', 'Total Amount', 'Advance', 'Balance'];
                foreach ($data['monthly_registrations'] as $row) {
                    $rows[] = [$row->month, $row->total, $row->total_amount, $row->advance_amount, $row->balance_amount];
                }
                break;

            case 'tests':
                $data = $this->testAnalytics((int) $request->input('year', date('Y')), 12);
                $headers = ['Test Type', 'Total'];
                foreach ($data['by_type'] as $row) {
                    $rows[] = [$row['type'], $row['total']];
                }
                break;

            case 'turnaround':
                $data = $this->turnaroundAnalytics((int) $request->input('year', date('Y')), 12);
                $headers = ['Test Type', 'Avg Hours', 'Min Hours', 'Max Hours', 'Count'];
                foreach ($data['by_type'] as $row) {
                    $rows[] = [$row->report_type, round($row->avg_hours, 1), $row->min_hours, $row->max_hours, $row->count];
                }
                break;

            case 'clients':
                $data = $this->clientAnalytics((int) $request->input('year', date('Y')), 12);
                $headers = ['Agency', 'Total Projects', 'Total Amount'];
                foreach ($data['top_by_volume'] as $row) {
                    $rows[] = [$row->agency_name, $row->total, $row->total_amount];
                }
                break;

            default:
                return response()->json(['message' => 'Invalid export type'], 422);
        }

        $csv = implode(',', $headers) . "\n";
        foreach ($rows as $row) {
            $csv .= implode(',', array_map(fn ($v) => '"' . str_replace('"', '""', $v) . '"', $row)) . "\n";
        }

        return response($csv, 200, [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="analytics-' . $type . '.csv"',
        ]);
    }
}
