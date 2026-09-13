<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TestStandard;
use Illuminate\Http\Request;

class TestStandardController extends Controller
{
    public function index(Request $request) { return response()->json(TestStandard::where('test_id', $request->test_id)->get()); }
    public function store(Request $request) { $validated = $request->validate(['test_id' => 'required|integer|exists:tests,id', 'standard_name' => 'required|string|max:222', 'description' => 'nullable|string',]); return response()->json(TestStandard::create($validated), 201); }
    public function update(Request $request, TestStandard $testStandard) { $testStandard->update($request->validate(['standard_name' => 'sometimes|string|max:222', 'description' => 'nullable|string',])); return response()->json($testStandard); }
    public function destroy(TestStandard $testStandard) { $testStandard->delete(); return response()->json(['message' => 'Deleted']); }
}
