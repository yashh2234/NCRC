<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Test;
use Illuminate\Http\Request;

class TestController extends Controller
{
    public function index(Request $request)
    {
        $query = Test::with('category');
        if ($request->filled('category_id')) $query->where('category_id', $request->category_id);
        if ($request->filled('search')) $query->where(function ($q) use ($request) { $q->where('name', 'like', "%{$request->search}%")->orWhere('code', 'like', "%{$request->search}%"); });
        return response()->json($query->orderByDesc('id')->paginate($request->get('per_page', 50)));
    }

    public function store(Request $request)
    {
        $validated = $request->validate(['category_id' => 'nullable|integer|exists:test_categories,id', 'name' => 'required|string|max:222', 'code' => 'nullable|string|max:50|unique:tests', 'description' => 'nullable|string', 'unit' => 'nullable|string|max:50', 'sample_type' => 'nullable|string|max:222', 'specification_limit' => 'nullable|string', 'standard_rate' => 'nullable|numeric|min:0',]);
        $validated['created_by'] = auth()->id();
        return response()->json(Test::create($validated), 201);
    }

    public function show(Test $test) { return response()->json($test->load(['category', 'standards', 'methods'])); }

    public function update(Request $request, Test $test)
    {
        $validated = $request->validate(['category_id' => 'nullable|integer|exists:test_categories,id', 'name' => 'sometimes|string|max:222', 'code' => 'nullable|string|max:50|unique:tests,code,'.$test->id, 'description' => 'nullable|string', 'unit' => 'nullable|string|max:50', 'sample_type' => 'nullable|string|max:222', 'specification_limit' => 'nullable|string', 'standard_rate' => 'nullable|numeric|min:0', 'is_active' => 'boolean',]);
        $test->update($validated);
        return response()->json($test->load('category'));
    }

    public function destroy(Test $test) { $test->delete(); return response()->json(['message' => 'Deleted']); }
    public function list(Request $request) { $q = Test::where('is_active', true); if ($request->filled('category_id')) $q->where('category_id', $request->category_id); return response()->json($q->get(['id', 'name', 'code', 'unit', 'standard_rate'])); }
}
