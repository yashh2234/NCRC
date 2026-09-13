<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TechnicalReview;
use Illuminate\Http\Request;

class TechnicalReviewController extends Controller
{
    public function index(Request $request)
    {
        $query = TechnicalReview::with('report');
        if ($request->filled('status')) $query->where('status', $request->status);
        if ($request->filled('report_id')) $query->where('report_id', $request->report_id);
        return response()->json($query->orderByDesc('id')->paginate($request->get('per_page', 50)));
    }

    public function store(Request $request)
    {
        $validated = $request->validate(['report_id' => 'required|integer', 'remarks' => 'nullable|string', 'status' => 'required|in:approved,returned_for_correction,returned_for_re_review',]);
        $validated['reviewer_id'] = auth()->id();
        $validated['reviewed_at'] = now();
        return response()->json(TechnicalReview::create($validated), 201);
    }

    public function show(TechnicalReview $technicalReview) { return response()->json($technicalReview); }

    public function update(Request $request, TechnicalReview $technicalReview)
    {
        $validated = $request->validate(['status' => 'sometimes|in:approved,returned_for_correction,returned_for_re_review', 'remarks' => 'nullable|string', 'corrected_at' => 'nullable|date', 'corrected_by' => 'nullable|integer',]);
        if (isset($validated['status']) && $validated['status'] === 'approved') $validated['reviewed_at'] = now();
        $technicalReview->update($validated);
        return response()->json($technicalReview);
    }

    public function destroy(TechnicalReview $technicalReview) { $technicalReview->delete(); return response()->json(['message' => 'Deleted']); }
}
