<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\VendorContact;
use Illuminate\Http\Request;

class VendorContactController extends Controller
{
    public function index(Request $request) { return response()->json(VendorContact::where('vendor_id', $request->vendor_id)->get()); }
    public function store(Request $request) { $validated = $request->validate(['vendor_id' => 'required|integer|exists:vendors,id', 'name' => 'required|string|max:222', 'designation' => 'nullable|string|max:222', 'mobile' => 'nullable|string|max:50', 'email' => 'nullable|email|max:222', 'is_primary' => 'boolean',]); return response()->json(VendorContact::create($validated), 201); }
    public function update(Request $request, VendorContact $vendorContact) { $validated = $request->validate(['name' => 'sometimes|string|max:222', 'designation' => 'nullable|string|max:222', 'mobile' => 'nullable|string|max:50', 'email' => 'nullable|email|max:222', 'is_primary' => 'boolean',]); $vendorContact->update($validated); return response()->json($vendorContact); }
    public function destroy(VendorContact $vendorContact) { $vendorContact->delete(); return response()->json(['message' => 'Deleted']); }
}
