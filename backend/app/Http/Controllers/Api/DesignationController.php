<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Designation;
use Illuminate\Http\Request;

class DesignationController extends Controller
{
    public function index(Request $request)
    {
        $query = Designation::with('department');
        if ($request->filled('department_id')) $query->where('department_id', $request->department_id);
        if ($request->filled('search')) $query->where('name', 'like', "%{$request->search}%");
        return response()->json($query->orderByDesc('id')->paginate($request->get('per_page', 50)));
    }

    public function store(Request $request)
    {
        $validated = $request->validate(['department_id' => 'nullable|integer|exists:departments,id', 'name' => 'required|string|max:222', 'description' => 'nullable|string',]);
        $validated['created_by'] = auth()->id();
        return response()->json(Designation::create($validated), 201);
    }

    public function show(Designation $designation) { return response()->json($designation->load('department')); }

    public function update(Request $request, Designation $designation)
    {
        $validated = $request->validate(['department_id' => 'nullable|integer|exists:departments,id', 'name' => 'sometimes|string|max:222', 'description' => 'nullable|string', 'is_active' => 'boolean',]);
        $designation->update($validated);
        return response()->json($designation);
    }

    public function destroy(Designation $designation) { $designation->delete(); return response()->json(['message' => 'Deleted']); }
    public function list(Request $request) { $q = Designation::where('is_active', true); if ($request->filled('department_id')) $q->where('department_id', $request->department_id); return response()->json($q->get(['id', 'name', 'department_id'])); }
}
