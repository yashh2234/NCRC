<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\UlrLink;
use App\Models\UlrCopy;
use App\Models\Registration;
use App\Models\Report;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UlrLinkController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = UlrLink::query();

        $startDate = $request->query('start_date');
        $endDate = $request->query('end_date');
        $uidNo = trim((string) $request->query('uid_no', ''));
        if ($startDate) $query->whereDate('date', '>=', $startDate);
        if ($endDate) $query->whereDate('date', '<=', $endDate);
        if ($uidNo !== '') $query->where('uid_no', 'like', '%' . $uidNo . '%');

        $links = $query->orderByDesc('id')->limit(200)->get();
        return response()->json(['data' => $links]);
    }

    public function export(Request $request): JsonResponse
    {
        $query = UlrLink::query();

        $startDate = $request->query('start_date');
        $endDate = $request->query('end_date');
        $uidNo = trim((string) $request->query('uid_no', ''));
        if ($startDate) $query->whereDate('date', '>=', $startDate);
        if ($endDate) $query->whereDate('date', '<=', $endDate);
        if ($uidNo !== '') $query->where('uid_no', 'like', '%' . $uidNo . '%');

        $links = $query->orderByDesc('id')->limit(1000)->get();
        return response()->json(['data' => $links]);
    }

    public function dropdown(Request $request): JsonResponse
    {
        $date = $request->query('date', date('Y-m-d'));
        
        $links = UlrLink::query()
            ->whereDate('date', $date)
            ->get()
            ->map(function ($ulr) {
                return [
                    'id' => $ulr->id,
                    'ulr_no' => $ulr->ulr_no,
                    'uid_no' => $ulr->uid_no,
                    'is_assigned' => !empty($ulr->uid_no),
                    'label' => $ulr->ulr_no . (!empty($ulr->uid_no) ? ' (Assign)' : ''),
                ];
            });

        return response()->json(['data' => $links]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'uid_no' => 'required|string',
            'date' => 'required|string',
            'ulr_no' => 'nullable|string',
            'new_ulr_no' => 'nullable|string',
            'name_of_department' => 'nullable|string',
            'name_of_agency' => 'required|string',
            'name_of_project' => 'nullable|string',
            'sample_details' => 'nullable|string',
            'qty' => 'nullable|string',
            'parameters' => 'nullable|string',
            'testing_period' => 'nullable|string',
            'sample_received_date' => 'nullable|string',
            'report_dispatch_date' => 'nullable|string',
            'bill_details' => 'nullable|string',
            'signature_remark' => 'nullable|string',
        ]);

        $selectedUlr = $request->input('ulr_no');
        $newUlr = trim((string) $request->input('new_ulr_no'));

        if ($selectedUlr === 'new' || (!empty($newUlr) && empty($selectedUlr))) {
            // New ULR creation
            if (!empty($newUlr)) {
                $ulrNo = $newUlr;
            } else {
                $year = date('Y');
                $lastUlr = UlrLink::where('ulr_no', 'like', "NCS/LAB/{$year}/%")->orderByDesc('ulr_no')->first();
                $seq = 1;
                if ($lastUlr && preg_match('/(\d{5})$/', $lastUlr->ulr_no, $m)) {
                    $seq = (int) $m[1] + 1;
                }
                $ulrNo = "NCS/LAB/{$year}/" . str_pad($seq, 5, '0', STR_PAD_LEFT);
            }

            // Check if this ULR existed previously, if so archive old mapping
            $existing = UlrLink::where('ulr_no', $ulrNo)->first();
            if ($existing) {
                UlrCopy::create([
                    'uid_no' => $existing->uid_no,
                    'ulr_no' => $existing->ulr_no,
                    'name_of_department' => $existing->name_of_department,
                    'name_of_agency' => $existing->name_of_agency,
                    'name_of_project' => $existing->name_of_project,
                    'sample_details' => $existing->sample_details,
                ]);
                $existing->update(array_merge($validated, ['ulr_no' => $ulrNo]));
            } else {
                $validated['ulr_no'] = $ulrNo;
                UlrLink::create($validated);
            }

            // Also update any matching reports for this UID
            Report::where('uid_no', $validated['uid_no'])->update(['ulr_no' => $ulrNo]);

            return response()->json(['message' => 'ULR Created and Linked successfully', 'ulr_no' => $ulrNo], 201);
        }

        // Linking existing ULR
        $existing = UlrLink::where('ulr_no', $selectedUlr)->first();
        if ($existing) {
            if (!empty($existing->uid_no) && $existing->uid_no !== $validated['uid_no']) {
                UlrCopy::create([
                    'uid_no' => $existing->uid_no,
                    'ulr_no' => $existing->ulr_no,
                    'name_of_department' => $existing->name_of_department,
                    'name_of_agency' => $existing->name_of_agency,
                    'name_of_project' => $existing->name_of_project,
                    'sample_details' => $existing->sample_details,
                ]);
            }
            $existing->update(array_merge($validated, ['ulr_no' => $selectedUlr]));
            $ulrNo = $selectedUlr;
        } else {
            $validated['ulr_no'] = $selectedUlr ?: "NCS/LAB/" . date('Y') . "/00001";
            $ulrNo = $validated['ulr_no'];
            UlrLink::create($validated);
        }

        // Sync to reports
        Report::where('uid_no', $validated['uid_no'])->update(['ulr_no' => $ulrNo]);

        return response()->json(['message' => 'ULR Linked successfully', 'ulr_no' => $ulrNo], 200);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $existing = UlrLink::findOrFail($id);

        UlrCopy::create([
            'uid_no' => $existing->uid_no,
            'ulr_no' => $existing->ulr_no,
            'name_of_department' => $existing->name_of_department,
            'name_of_agency' => $existing->name_of_agency,
            'name_of_project' => $existing->name_of_project,
            'sample_details' => $existing->sample_details,
        ]);

        $validated = $request->validate([
            'uid_no' => 'required|string',
            'date' => 'required|string',
            'name_of_department' => 'nullable|string',
            'name_of_agency' => 'required|string',
            'name_of_project' => 'nullable|string',
            'sample_details' => 'nullable|string',
            'qty' => 'nullable|string',
            'parameters' => 'nullable|string',
            'testing_period' => 'nullable|string',
            'sample_received_date' => 'nullable|string',
            'report_dispatch_date' => 'nullable|string',
            'bill_details' => 'nullable|string',
            'signature_remark' => 'nullable|string',
        ]);

        $existing->update($validated);
        return response()->json(['message' => 'ULR updated']);
    }

    public function destroy(int $id): JsonResponse
    {
        UlrLink::findOrFail($id)->delete();
        return response()->json(['message' => 'ULR deleted']);
    }

    public function getClientDetails(Request $request): JsonResponse
    {
        $uidNo = $request->input('uid_no');
        $reg = Registration::where('uid_no', $uidNo)->first();
        return response()->json(['data' => $reg]);
    }

    public function register(Request $request): JsonResponse
    {
        $query = UlrLink::query()
            ->leftJoin('client_registration', 'ulr_link.uid_no', '=', 'client_registration.uid_no')
            ->select(
                'ulr_link.*',
                'client_registration.agency_name',
                'client_registration.reporting_address',
                'client_registration.mobile_no',
                'client_registration.name_of_work',
                'client_registration.sample_details as reg_sample_details',
                'client_registration.total_payment',
                'client_registration.advance_payment',
                'client_registration.balance_dues'
            );

        $startDate = $request->query('start_date');
        $endDate = $request->query('end_date');
        if ($startDate && $endDate) {
            $query->whereDate('ulr_link.date', '>=', $startDate)
                ->whereDate('ulr_link.date', '<=', $endDate);
        }

        $links = $query->orderByDesc('ulr_link.id')->limit(500)->get();

        return response()->json(['data' => $links]);
    }
}
