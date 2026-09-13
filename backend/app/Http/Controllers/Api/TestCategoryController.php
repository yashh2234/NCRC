<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TestCategory;
use Illuminate\Http\Request;

class TestCategoryController extends Controller
{
    public function index(Request $request)
    {
        $query = TestCategory::withCount('tests');
        if ($request->filled('search')) $query->where('name', 'like', "%{$request->search}%");
        return response()->json($query->orderByDesc('id')->paginate($request->get('per_page', 50)));
    }

    public function store(Request $request)
    {
        $validated = $request->validate(['name' => 'required|string|max:222|unique:test_categories', 'description' => 'nullable|string',]);
        $validated['created_by'] = auth()->id();
        return response()->json(TestCategory::create($validated), 201);
    }

    public function show(TestCategory $testCategory) { return response()->json($testCategory->load('tests')); }

    public function update(Request $request, TestCategory $testCategory)
    {
        $validated = $request->validate(['name' => 'sometimes|string|max:222|unique:test_categories,name,'.$testCategory->id, 'description' => 'nullable|string', 'is_active' => 'boolean',]);
        $testCategory->update($validated);
        return response()->json($testCategory);
    }

    public function destroy(TestCategory $testCategory) { $testCategory->delete(); return response()->json(['message' => 'Deleted']); }
    public function list() { return response()->json(TestCategory::where('is_active', true)->get(['id', 'name'])); }
}
