<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\VendorService;
use Illuminate\Http\Request;

class VendorServiceController extends Controller
{
    public function index(Request $request) { return response()->json(VendorService::where('vendor_id', $request->vendor_id)->with('test')->get()); }
    public function store(Request $request) { $validated = $request->validate(['vendor_id' => 'required|integer|exists:vendors,id', 'test_id' => 'nullable|integer|exists:tests,id', 'service_name' => 'required|string|max:222', 'description' => 'nullable|string', 'rate' => 'nullable|numeric|min:0', 'turnaround_time' => 'nullable|string|max:100',]); return response()->json(VendorService::create($validated), 201); }
    public function update(Request $request, VendorService $vendorService) { $vendorService->update($request->validate(['service_name' => 'sometimes|string|max:222', 'description' => 'nullable|string', 'rate' => 'nullable|numeric|min:0', 'turnaround_time' => 'nullable|string|max:100',])); return response()->json($vendorService); }
    public function destroy(VendorService $vendorService) { $vendorService->delete(); return response()->json(['message' => 'Deleted']); }
}
