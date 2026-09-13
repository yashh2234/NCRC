<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Jobs;
use App\Models\TestResult;
use App\Models\JobTimeline;
use Illuminate\Http\Request;

class TestResultController extends Controller
{
    public function index(Jobs $job)
    {
        return response()->json(
            $job->testResults()->with(['test', 'category', 'tester', 'assignment'])->latest()->get()
        );
    }

    public function store(Request $request, Jobs $job)
    {
        $validated = $request->validate([
            'test_id' => 'required|integer|exists:tests,id',
            'job_assignment_id' => 'nullable|integer|exists:job_assignments,id',
            'category_id' => 'nullable|integer|exists:test_categories,id',
            'test_name' => 'nullable|string|max:255',
            'result_value' => 'nullable|string|max:255',
            'unit' => 'nullable|string|max:100',
            'specification_limit' => 'nullable|string|max:255',
            'standard_name' => 'nullable|string|max:255',
            'method_name' => 'nullable|string|max:255',
            'status' => 'in:pending,in_progress,completed,failed',
            'remarks' => 'nullable|string',
        ]);

        $validated['job_id'] = $job->id;
        $validated['tested_by'] = $request->user()?->id;
        $validated['tested_at'] = now();

        $result = TestResult::create($validated);

        $testNameOrId = $result->test_name ?? $result->test_id;
        JobTimeline::create([
            'job_id' => $job->id,
            'action' => 'Test Result Recorded',
            'user_id' => $request->user()?->id,
            'notes' => "Test: {$testNameOrId} = {$result->result_value}",
        ]);

        return response()->json($result->load(['test', 'category', 'tester']), 201);
    }

    public function update(Request $request, TestResult $testResult)
    {
        $validated = $request->validate([
            'result_value' => 'nullable|string|max:255',
            'unit' => 'nullable|string|max:100',
            'specification_limit' => 'nullable|string|max:255',
            'status' => 'in:pending,in_progress,completed,failed',
            'remarks' => 'nullable|string',
        ]);

        $validated['tested_by'] = $request->user()?->id;
        $validated['tested_at'] = now();

        $testResult->update($validated);

        return response()->json($testResult->fresh()->load(['test', 'category', 'tester']));
    }

    public function destroy(TestResult $testResult)
    {
        $testResult->delete();
        return response()->json(null, 204);
    }

    public function batchStore(Request $request, Jobs $job)
    {
        $validated = $request->validate([
            'results' => 'required|array',
            'results.*.test_id' => 'required|integer|exists:tests,id',
            'results.*.test_name' => 'nullable|string|max:255',
            'results.*.result_value' => 'nullable|string|max:255',
            'results.*.unit' => 'nullable|string|max:100',
            'results.*.specification_limit' => 'nullable|string|max:255',
        ]);

        $created = [];
        foreach ($validated['results'] as $item) {
            $item['job_id'] = $job->id;
            $item['tested_by'] = $request->user()?->id;
            $item['tested_at'] = now();
            $item['status'] = 'completed';
            $created[] = TestResult::create($item);
        }

        JobTimeline::create([
            'job_id' => $job->id,
            'action' => 'Test Results Batch Recorded',
            'user_id' => $request->user()?->id,
            'notes' => count($created) . ' test results recorded',
        ]);

        return response()->json($created, 201);
    }
}
