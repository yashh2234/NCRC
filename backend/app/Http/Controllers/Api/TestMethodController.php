<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TestMethod;
use Illuminate\Http\Request;

class TestMethodController extends Controller
{
    public function index(Request $request) { return response()->json(TestMethod::where('test_id', $request->test_id)->get()); }
    public function store(Request $request) { $validated = $request->validate(['test_id' => 'required|integer|exists:tests,id', 'method_name' => 'required|string|max:222', 'procedure' => 'nullable|string', 'equipment_required' => 'nullable|string|max:222',]); return response()->json(TestMethod::create($validated), 201); }
    public function update(Request $request, TestMethod $testMethod) { $testMethod->update($request->validate(['method_name' => 'sometimes|string|max:222', 'procedure' => 'nullable|string', 'equipment_required' => 'nullable|string|max:222',])); return response()->json($testMethod); }
    public function destroy(TestMethod $testMethod) { $testMethod->delete(); return response()->json(['message' => 'Deleted']); }
}
