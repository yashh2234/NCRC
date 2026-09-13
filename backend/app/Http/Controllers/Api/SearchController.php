<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Jobs;
use App\Models\Registration;
use App\Models\Report;
use App\Models\JobAssignment;
use App\Models\WorkflowStage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SearchController extends Controller
{
    public function search(Request $request): JsonResponse
    {
        $q = $request->query('q', '');
        $stageSlug = $request->query('stage');
        $departmentId = $request->query('department_id');
        $dateFrom = $request->query('date_from');
        $dateTo = $request->query('date_to');

        $term = '%'.$q.'%';

        $registrations = collect();
        $reports = collect();
        $jobs = collect();

        if (strlen($q) >= 2) {
            $registrations = Registration::query()
                ->where('uid_no', 'like', $term)
                ->orWhere('agency_name', 'like', $term)
                ->orWhere('mobile_no', 'like', $term)
                ->orWhere('name_of_work', 'like', $term)
                ->orWhere('reporting_address', 'like', $term)
                ->limit(10)
                ->get()
                ->map(fn (Registration $r): array => [
                    'type' => 'registration',
                    'id' => $r->id,
                    'uid_no' => $r->uid_no,
                    'title' => $r->agency_name,
                    'subtitle' => $r->name_of_work,
                    'mobile' => $r->mobile_no,
                ]);

            $reports = Report::query()
                ->where('uid_no', 'like', $term)
                ->orWhere('agency_name', 'like', $term)
                ->orWhere('customer_details', 'like', $term)
                ->orWhere('ulr_no', 'like', $term)
                ->limit(10)
                ->get()
                ->map(fn (Report $r): array => [
                    'type' => 'report',
                    'id' => $r->iReportId,
                    'uid_no' => $r->uid_no,
                    'title' => $r->agency_name,
                    'subtitle' => $r->report_type.' - '.$r->status,
                    'mobile' => null,
                ]);

            $jobsQuery = Jobs::with(['currentStage', 'client'])
                ->where(function ($query) use ($term) {
                    $query->where('uid_no', 'like', $term)
                        ->orWhere('title', 'like', $term);
                });

            if ($stageSlug) {
                $stageIds = WorkflowStage::where('slug', 'like', "%{$stageSlug}%")
                    ->orWhere('name', 'like', "%{$stageSlug}%")
                    ->pluck('id');
                $jobsQuery->whereIn('current_stage_id', $stageIds);
            }

            if ($departmentId) {
                $jobIds = JobAssignment::where('department_id', $departmentId)->pluck('job_id');
                $jobsQuery->whereIn('id', $jobIds);
            }

            if ($dateFrom) {
                $jobsQuery->whereDate('created_at', '>=', $dateFrom);
            }
            if ($dateTo) {
                $jobsQuery->whereDate('created_at', '<=', $dateTo);
            }

            $jobs = $jobsQuery->limit(10)->get()
                ->map(fn (Jobs $j): array => [
                    'type' => 'job',
                    'id' => $j->id,
                    'uid_no' => $j->uid_no,
                    'title' => $j->title ?? 'Untitled',
                    'subtitle' => $j->currentStage?->name ?? 'No stage',
                    'mobile' => $j->client?->company_name,
                ]);
        }

        return response()->json([
            'data' => array_merge($registrations->toArray(), $reports->toArray(), $jobs->toArray()),
        ]);
    }
}
