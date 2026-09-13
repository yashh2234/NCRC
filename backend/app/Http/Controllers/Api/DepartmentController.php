<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Department;
use Illuminate\Http\Request;

class DepartmentController extends Controller
{
    public function index(Request $request)
    {
        $query = Department::with('head');
        if ($request->filled('search')) $query->where('name', 'like', "%{$request->search}%");
        return response()->json($query->orderByDesc('id')->paginate($request->get('per_page', 50)));
    }

    public function store(Request $request)
    {
        $validated = $request->validate(['name' => 'required|string|max:222|unique:departments', 'code' => 'nullable|string|max:50|unique:departments', 'description' => 'nullable|string', 'head_of_department' => 'nullable|integer',]);
        $validated['created_by'] = auth()->id();
        return response()->json(Department::create($validated), 201);
    }

    public function show(Department $department) { return response()->json($department->load(['head', 'designations'])); }

    public function update(Request $request, Department $department)
    {
        $validated = $request->validate(['name' => 'sometimes|string|max:222|unique:departments,name,'.$department->id, 'code' => 'nullable|string|max:50|unique:departments,code,'.$department->id, 'description' => 'nullable|string', 'head_of_department' => 'nullable|integer', 'is_active' => 'boolean',]);
        $department->update($validated);
        return response()->json($department);
    }

    public function destroy(Department $department) { $department->delete(); return response()->json(['message' => 'Deleted']); }
    public function list() { return response()->json(Department::where('is_active', true)->get(['id', 'name', 'code'])); }
}
