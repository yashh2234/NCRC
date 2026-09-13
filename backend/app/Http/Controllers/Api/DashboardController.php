<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Jobs;
use App\Models\Registration;
use App\Models\Report;
use App\Models\WorkflowStage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    /**
     * Map group names to tracker roles.
     * Matches the Namotech Job Tracker Excel roles.
     */
    private function detectTrackerRole($user): string
    {
        if (!$user) return 'staff';

        $groups = $user->groups;

        // Check for admin first
        if ($user->is_admin || $groups->contains(fn ($g) => (int) $g->id === 1 || strtolower($g->group_name) === 'administrator')) {
            return 'admin';
        }

        // Map group names to tracker roles
        $roleMap = [
            'technical'    => 'technical',
            'report staff' => 'report_staff',
            'lab employee' => 'lab',
            'lab'          => 'lab',
            'registerar'   => 'registration',
            'registration' => 'registration',
            'hr group'     => 'manager',
            'manager'      => 'manager',
            'accounts'     => 'manager',
        ];

        foreach ($groups as $group) {
            $name = strtolower(trim($group->group_name));
            if (isset($roleMap[$name])) {
                return $roleMap[$name];
            }
        }

        return 'staff';
    }

    /**
     * Get the workflow stages owned by a tracker role.
     * Based on the Namotech Job Tracker Excel:
     *   Registration → stages 1 (Registered) & 6 (Report Dispatched)
     *   Lab          → stages 2 (Field/Site Work) & 3 (Lab Testing)
     *   Report Staff → stage 4 (Report Drafting)
     *   Technical    → stage 5 (Report Review)
     *   Manager      → stage 7 (Payment Pending)
     */
    private function getOwnedStages(string $role): array
    {
        $stageMap = [
            'registration' => ['registered', 'report-dispatched', 'registration', 'dispatch'],
            'lab'          => ['field-site-work', 'lab-testing', 'field-work', 'lab', 'testing', 'sample-collection'],
            'report_staff' => ['report-drafting', 'report-draft', 'drafting'],
            'technical'    => ['report-review', 'technical-review', 'review', 'approval'],
            'manager'      => ['payment-pending', 'billing', 'payment', 'invoicing'],
            'admin'        => [], // admin sees all
        ];

        return $stageMap[$role] ?? [];
    }

    public function summary(Request $request): JsonResponse
    {
        $user = $request->user();
        $isAdmin = (bool) ($user?->isLegacyAdmin() ?? $user?->is_admin ?? false);
        $today = now()->toDateString();
        $trackerRole = $this->detectTrackerRole($user);

        // Legacy metrics (existing)
        $totalRegistration = Registration::query()->count();
        $totalAmount = (float) Registration::query()->sum('total_payment');
        $totalReceivedAmount = (float) Registration::query()->sum('advance_payment');
        $totalBalanceAmount = (float) Registration::query()->sum('balance_dues');
        $todayRegistration = Registration::query()->whereDate('received_date', $today)->count();
        $todayAmount = (float) Registration::query()->whereDate('received_date', $today)->sum('total_payment');
        $todayReceivedAmount = (float) Registration::query()->whereDate('received_date', $today)->sum('advance_payment');
        $todayBalanceAmount = (float) Registration::query()->whereDate('received_date', $today)->sum('balance_dues');
        $totalReports = Report::query()->count();
        $pendingReports = Report::query()->where('status', 'Pending')->count();
        $todayReports = Report::query()->whereDate('create_date', $today)->count();

        // Job-based metrics (new workflow)
        $jobsToday = Jobs::whereDate('created_at', $today)->count();
        $jobsPendingReview = Jobs::whereHas('currentStage', fn ($q) => $q->where('slug', 'technical-review'))->count();
        $jobsPendingApproval = Jobs::whereHas('currentStage', fn ($q) => $q->where('slug', 'approval'))->count();
        $jobsPendingBilling = Jobs::whereHas('currentStage', fn ($q) => $q->where('slug', 'billing'))->count();
        $jobsPendingDispatch = Jobs::whereHas('currentStage', fn ($q) => $q->where('slug', 'dispatch'))->count();
        $jobsCompleted = Jobs::where('status', 'completed')->count();
        $jobsActive = Jobs::where('status', 'active')->count();
        $jobsCompletedToday = Jobs::where('status', 'completed')->whereDate('completed_at', $today)->count();

        // Overdue jobs (SLA breach)
        $overdueJobs = Jobs::whereHas('activeStageTracking', fn ($q) => $q->where('is_overdue', true))->count();

        // My pending tasks (based on assigned user)
        $myPendingJobs = Jobs::where('assigned_to', $user?->id)
            ->whereIn('status', ['pending', 'active'])
            ->count();

        // My pending review (if user is a reviewer/approver)
        $myPendingReviews = Jobs::whereHas('currentStage', fn ($q) => $q->whereIn('slug', ['technical-review', 'approval']))
            ->where('assigned_to', $user?->id)
            ->whereIn('status', ['pending', 'active'])
            ->count();

        // Role-specific queue counts (for dashboard role cards)
        $ownedStageSlugs = $this->getOwnedStages($trackerRole);
        $myQueueCount = 0;
        if ($trackerRole !== 'admin' && !empty($ownedStageSlugs)) {
            $myQueueCount = Jobs::whereHas('currentStage', fn ($q) => $q->whereIn('slug', $ownedStageSlugs))
                ->whereIn('status', ['pending', 'active'])
                ->count();
        }

        // All role queue counts (for admin/manager)
        $roleQueueCounts = [];
        if ($trackerRole === 'admin' || $trackerRole === 'manager') {
            foreach (['registration', 'lab', 'report_staff', 'technical', 'manager'] as $role) {
                $slugs = $this->getOwnedStages($role);
                $roleQueueCounts[$role] = !empty($slugs)
                    ? Jobs::whereHas('currentStage', fn ($q) => $q->whereIn('slug', $slugs))
                        ->whereIn('status', ['pending', 'active'])
                        ->count()
                    : 0;
            }
        }

        // Stuck jobs (> 2 days at current stage)
        $stuckJobs = Jobs::whereHas('activeStageTracking', function ($q) {
            $q->where('entered_at', '<=', now()->subDays(2))
              ->whereNull('exited_at');
        })->whereIn('status', ['pending', 'active'])->count();

        // Financial snapshot (for manager/admin)
        $financialSnapshot = null;
        if (in_array($trackerRole, ['admin', 'manager'])) {
            $totalBilled = (float) Registration::query()
                ->where('total_payment', '>', 0)
                ->sum('total_payment');
            $totalReceived = (float) Registration::query()->sum('advance_payment');
            $outstanding = $totalBilled - $totalReceived;
            $avgJobValue = Registration::query()->where('total_payment', '>', 0)->avg('total_payment') ?? 0;
            $activeJobValue = (float) Registration::query()
                ->where('current_stage', '!=', '8. Closed')
                ->sum('total_payment');

            $financialSnapshot = [
                'total_billed' => $totalBilled,
                'total_received' => $totalReceived,
                'outstanding' => $outstanding,
                'avg_job_value' => (float) $avgJobValue,
                'active_job_value' => $activeJobValue,
            ];
        }

        // Attention needed items (for admin/manager)
        $attentionNeeded = null;
        if (in_array($trackerRole, ['admin', 'manager'])) {
            $attentionNeeded = [
                'overdue_jobs' => $overdueJobs,
                'stuck_jobs' => $stuckJobs,
                'reports_awaiting' => $jobsPendingReview + Jobs::whereHas('currentStage', fn ($q) => $q->whereIn('slug', ['report-drafting', 'drafting']))->count(),
                'payment_followup' => (int) Registration::query()
                    ->whereIn('payment_status', ['Invoiced', 'Partial Received'])
                    ->count(),
            ];
        }

        $stage1 = Registration::where('current_stage', '1. Registered')->count();
        $stage2 = Registration::where('current_stage', '2. Field/Site Work')->count();
        $stage3 = Registration::where('current_stage', '3. Lab Testing')->count();
        $stage4 = Registration::where('current_stage', '4. Report Drafting')->count();
        $stage5 = Registration::where('current_stage', '5. Report Review')->count();
        $stage6 = Registration::where('current_stage', '6. Report Dispatched')->count();
        $stage7 = Registration::where('current_stage', '7. Payment Pending')->count();
        $stage8 = Registration::where('current_stage', '8. Closed')->count();

        $regQueueCount = $stage1 + $stage6;
        $labQueueCount = $stage2 + $stage3;
        $reportStaffQueueCount = $stage4;
        $technicalQueueCount = $stage5;
        $managerQueueCount = $stage7;
        $closedCount = $stage8;

        return response()->json([
            'page_title' => 'Dashboard',
            'is_admin' => $isAdmin,
            'user_role' => $trackerRole,
            'all_stage_counts' => [
                '1. Registered' => $stage1,
                '2. Field/Site Work' => $stage2,
                '3. Lab Testing' => $stage3,
                '4. Report Drafting' => $stage4,
                '5. Report Review' => $stage5,
                '6. Report Dispatched' => $stage6,
                '7. Payment Pending' => $stage7,
                '8. Closed' => $stage8,
            ],
            'metrics' => [
                // Legacy
                'total_registration' => $totalRegistration,
                'total_reports' => $totalReports,
                'pending_reports' => $pendingReports,
                'total_amount' => $totalAmount,
                'total_cash_amount' => 0,
                'total_received_amount' => $totalReceivedAmount,
                'today_registration' => $todayRegistration,
                'today_reports' => $todayReports,
                'today_amount' => $todayAmount,
                'today_received_amount' => $todayReceivedAmount,
                'today_balance_amount' => $todayBalanceAmount,
                'expenses_this_month' => 0,
                'total_balance_amount' => $totalBalanceAmount,

                // Job-based workflow metrics
                'jobs_today' => $jobsToday,
                'jobs_active' => $jobsActive,
                'jobs_completed' => $jobsCompleted,
                'jobs_completed_today' => $jobsCompletedToday,
                'jobs_pending_review' => $jobsPendingReview,
                'jobs_pending_approval' => $jobsPendingApproval,
                'jobs_pending_billing' => $jobsPendingBilling,
                'jobs_pending_dispatch' => $jobsPendingDispatch,
                'jobs_overdue' => $overdueJobs,
                'jobs_stuck' => $stuckJobs,
                'my_pending_jobs' => $myPendingJobs,
                'my_pending_reviews' => $myPendingReviews,
                'my_queue_count' => $myQueueCount,

                // Excel Stage Role Metrics
                'registration_queue_count' => $regQueueCount,
                'lab_queue_count' => $labQueueCount,
                'report_staff_queue_count' => $reportStaffQueueCount,
                'technical_queue_count' => $technicalQueueCount,
                'manager_queue_count' => $managerQueueCount,
                'closed_queue_count' => $closedCount,
            ],
            'role_queue_counts' => [
                'registration' => $regQueueCount,
                'lab' => $labQueueCount,
                'report_staff' => $reportStaffQueueCount,
                'technical' => $technicalQueueCount,
                'manager' => $managerQueueCount,
            ],
            'financial_snapshot' => $financialSnapshot,
            'attention_needed' => $attentionNeeded,
            'modules' => [
                'Auth and users',
                'Registration and billing',
                'Lab reports',
                'Expenses and company settings',
                'Reports and analytics',
            ],
        ]);
    }

    /**
     * Get the user's personal queue — jobs in stages owned by their role.
     */
    public function myQueue(Request $request): JsonResponse
    {
        $user = $request->user();
        $trackerRole = $this->detectTrackerRole($user);
        $ownedStageSlugs = $this->getOwnedStages($trackerRole);

        $query = Jobs::with(['currentStage', 'client', 'assignedUser', 'activeStageTracking'])
            ->whereIn('status', ['pending', 'active']);

        if ($trackerRole !== 'admin' && !empty($ownedStageSlugs)) {
            $query->whereHas('currentStage', fn ($q) => $q->whereIn('slug', $ownedStageSlugs));
        }

        $jobs = $query->orderByDesc('updated_at')->limit(50)->get();

        $queueItems = $jobs->map(function ($job) {
            $stageTracking = $job->activeStageTracking;
            $daysAtStage = $stageTracking && $stageTracking->entered_at
                ? (int) now()->diffInDays($stageTracking->entered_at)
                : 0;

            return [
                'id' => $job->id,
                'uid_no' => $job->uid_no,
                'title' => $job->title,
                'description' => $job->description,
                'priority' => $job->priority,
                'status' => $job->status,
                'current_stage' => $job->currentStage?->name ?? 'Unknown',
                'current_stage_slug' => $job->currentStage?->slug ?? '',
                'client_name' => $job->client?->company_name ?? '',
                'assigned_to' => $job->assignedUser?->name ?? '',
                'days_at_stage' => $daysAtStage,
                'is_overdue' => $stageTracking?->is_overdue ?? false,
                'due_at' => $job->due_at,
                'created_at' => $job->created_at,
            ];
        });

        return response()->json([
            'role' => $trackerRole,
            'queue' => $queueItems,
            'total' => $queueItems->count(),
        ]);
    }

    public function cashSummary(): JsonResponse
    {
        $todayCash = DB::table('client_registration')
            ->whereDate('received_date', now()->toDateString())
            ->where('mode_of_payment', 'Cash')
            ->sum('total_payment');

        $todayReceived = DB::table('client_registration')
            ->whereDate('received_date', now()->toDateString())
            ->sum('advance_payment');

        $monthCash = DB::table('client_registration')
            ->whereMonth('received_date', now()->month)
            ->whereYear('received_date', now()->year)
            ->where('mode_of_payment', 'Cash')
            ->sum('total_payment');

        // Full 18-category expense breakdown for current month
        $firstDayOfMonth = now()->startOfMonth()->toDateString();
        $lastDayOfMonth = now()->endOfMonth()->toDateString();

        $categories = [
            'Site Exp', 'Corier and Speed Post', 'Convence and Transportation',
            'Survey Exp', 'DD and tendor Exp', 'Omendra Gupta Current ac',
            'Office Maintenance', 'Refreshment', 'stationary',
            'Machine and Car Repairing', 'Lab Testing Exp', 'Audit Expenses',
            'Telephone/Water/Electricity Exp', 'Printor and Computer Repairing exp',
            'Printing Exp', 'Cash advance', 'Salary', 'Other Exp',
        ];

        $expenseBreakdown = [];
        foreach ($categories as $category) {
            $total = DB::table('daily_expenses')
                ->whereBetween('date', [$firstDayOfMonth, $lastDayOfMonth])
                ->where('expenses_category', $category)
                ->sum(DB::raw('CAST(total_expenses AS DECIMAL(12,2))'));
            $expenseBreakdown[$category] = (float) $total;
        }

        return response()->json([
            'today_cash_total' => (float) $todayCash,
            'today_received_total' => (float) $todayReceived,
            'month_cash_total' => (float) $monthCash,
            'expense_breakdown' => $expenseBreakdown,
        ]);
    }

    public function trends(Request $request): JsonResponse
    {
        $period = $request->query('period', 'monthly'); // daily, monthly, quarterly, yearly, custom
        $fromDate = $request->query('from_date');
        $toDate = $request->query('to_date');

        $query = DB::table('client_registration');

        if ($period === 'custom' && $fromDate && $toDate) {
            $query->whereBetween('received_date', [$fromDate, $toDate]);
        } elseif ($period === 'daily') {
            $query->whereRaw("received_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)");
        } elseif ($period === 'quarterly') {
            $query->whereRaw("received_date >= DATE_SUB(CURDATE(), INTERVAL 2 YEAR)");
        } elseif ($period === 'yearly') {
            $query->whereRaw("received_date >= DATE_SUB(CURDATE(), INTERVAL 5 YEAR)");
        } else {
            $query->whereRaw("received_date >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)");
        }

        if ($period === 'daily') {
            $dateFormat = "DATE_FORMAT(received_date, '%Y-%m-%d')";
        } elseif ($period === 'quarterly') {
            $dateFormat = "CONCAT(YEAR(received_date), '-Q', QUARTER(received_date))";
        } elseif ($period === 'yearly') {
            $dateFormat = "DATE_FORMAT(received_date, '%Y')";
        } else {
            $dateFormat = "DATE_FORMAT(received_date, '%Y-%m')";
        }

        $registrations = $query
            ->select(
                DB::raw("{$dateFormat} as month"),
                DB::raw('COUNT(*) as total'),
                DB::raw('SUM(CAST(total_payment AS DECIMAL(12,2))) as total_amount'),
                DB::raw('SUM(CAST(advance_payment AS DECIMAL(12,2))) as received_amount'),
                DB::raw('SUM(CAST(balance_dues AS DECIMAL(12,2))) as balance_amount'),
            )
            ->groupBy(DB::raw($dateFormat))
            ->orderBy('month')
            ->get();

        $reportStatusCounts = DB::table('reports')
            ->select('status', DB::raw('COUNT(*) as count'))
            ->groupBy('status')
            ->get()
            ->pluck('count', 'status')
            ->toArray();

        $today = now()->toDateString();
        $todayReports = Report::query()->whereDate('create_date', $today)->count();

        $monthExpenses = DB::table('daily_expenses')
            ->select(
                'expenses_category',
                DB::raw('SUM(CAST(total_expenses AS DECIMAL(12,2))) as total')
            )
            ->whereMonth('date', now()->month)
            ->whereYear('date', now()->year)
            ->where('total_expenses', '>', '0')
            ->groupBy('expenses_category')
            ->orderByDesc('total')
            ->get()
            ->pluck('total', 'expenses_category')
            ->toArray();

        return response()->json([
            'monthly_registrations' => $registrations,
            'report_statuses' => [
                'total' => array_sum($reportStatusCounts),
                'pending' => (int) ($reportStatusCounts['Pending'] ?? 0),
                'complete' => (int) ($reportStatusCounts['Complete'] ?? 0),
                'cancel' => (int) ($reportStatusCounts['Cancel'] ?? 0),
            ],
            'today_reports' => $todayReports,
            'month_expenses' => $monthExpenses,
        ]);
    }

    public function yearlyReport(Request $request): JsonResponse
    {
        $selectedYear = (int) ($request->query('year', now()->year));

        // Monthly revenue totals for the selected year
        $monthlyData = [];
        for ($month = 1; $month <= 12; $month++) {
            $total = DB::table('client_registration')
                ->whereYear('received_date', $selectedYear)
                ->whereMonth('received_date', $month)
                ->sum(DB::raw('CAST(total_payment AS DECIMAL(12,2))'));
            $monthlyData[] = [
                'month' => $month,
                'month_name' => date('F', mktime(0, 0, 0, $month, 1)),
                'total_amount' => (float) $total,
            ];
        }

        // Available years for the year selector
        $availableYears = DB::table('client_registration')
            ->selectRaw('DISTINCT YEAR(received_date) as year')
            ->whereNotNull('received_date')
            ->where('received_date', '!=', '')
            ->where('received_date', '!=', '0000-00-00')
            ->orderByDesc('year')
            ->pluck('year')
            ->filter()
            ->values()
            ->toArray();

        $yearTotal = array_sum(array_column($monthlyData, 'total_amount'));

        return response()->json([
            'selected_year' => $selectedYear,
            'available_years' => $availableYears,
            'monthly_data' => $monthlyData,
            'year_total' => $yearTotal,
        ]);
    }
}
