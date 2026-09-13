<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Vendor;
use Illuminate\Http\Request;

class VendorController extends Controller
{
    public function index(Request $request)
    {
        $query = Vendor::withCount('services');
        if ($request->filled('search')) $query->where(function ($q) use ($request) { $q->where('vendor_name', 'like', "%{$request->search}%")->orWhere('mobile', 'like', "%{$request->search}%")->orWhere('email', 'like', "%{$request->search}%"); });
        return response()->json($query->orderByDesc('id')->paginate($request->get('per_page', 50)));
    }

    public function store(Request $request)
    {
        $validated = $request->validate(['vendor_name' => 'required|string|max:222', 'contact_person' => 'nullable|string|max:222', 'mobile' => 'nullable|string|max:50', 'phone' => 'nullable|string|max:50', 'email' => 'nullable|email|max:222', 'website' => 'nullable|string|max:222', 'address' => 'nullable|string', 'city' => 'nullable|string|max:100', 'state' => 'nullable|string|max:100', 'pincode' => 'nullable|string|max:20', 'gst_no' => 'nullable|string|max:50', 'pan_no' => 'nullable|string|max:50', 'services_offered' => 'nullable|string', 'notes' => 'nullable|string',]);
        $validated['created_by'] = auth()->id();
        return response()->json(Vendor::create($validated), 201);
    }

    public function show(Vendor $vendor) { return response()->json($vendor->load(['contacts', 'services'])); }

    public function update(Request $request, Vendor $vendor)
    {
        $validated = $request->validate(['vendor_name' => 'sometimes|string|max:222', 'contact_person' => 'nullable|string|max:222', 'mobile' => 'nullable|string|max:50', 'phone' => 'nullable|string|max:50', 'email' => 'nullable|email|max:222', 'website' => 'nullable|string|max:222', 'address' => 'nullable|string', 'city' => 'nullable|string|max:100', 'state' => 'nullable|string|max:100', 'pincode' => 'nullable|string|max:20', 'gst_no' => 'nullable|string|max:50', 'pan_no' => 'nullable|string|max:50', 'services_offered' => 'nullable|string', 'notes' => 'nullable|string', 'is_active' => 'boolean',]);
        $vendor->update($validated);
        return response()->json($vendor);
    }

    public function destroy(Vendor $vendor) { $vendor->delete(); return response()->json(['message' => 'Deleted']); }
    public function list() { return response()->json(Vendor::where('is_active', true)->get(['id', 'vendor_name', 'mobile', 'email'])); }
}
