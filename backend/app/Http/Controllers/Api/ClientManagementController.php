<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Client;
use Illuminate\Http\Request;

class ClientManagementController extends Controller
{
    public function updateAddresses(Request $request, Client $client)
    {
        $validated = $request->validate(['billing_address' => 'nullable|string', 'shipping_address' => 'nullable|string', 'billing_city' => 'nullable|string|max:100', 'shipping_city' => 'nullable|string|max:100', 'billing_state' => 'nullable|string|max:100', 'shipping_state' => 'nullable|string|max:100', 'billing_pincode' => 'nullable|string|max:20', 'shipping_pincode' => 'nullable|string|max:20', 'gst_no' => 'nullable|string|max:50', 'pan_no' => 'nullable|string|max:50',]);
        $client->update($validated);
        return response()->json($client);
    }
}
