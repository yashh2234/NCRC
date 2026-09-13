<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Company;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SettingsController extends Controller
{
    public function company(): JsonResponse
    {
        $company = Company::query()->first();

        return response()->json(['data' => $company]);
    }

    public function updateCompany(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'company_name' => ['required', 'string', 'max:255'],
            'address' => ['nullable', 'string'],
            'corporate_address' => ['nullable', 'string'],
            'gst_no' => ['nullable', 'string', 'max:255'],
            'pan_no' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:255'],
            'bank_name' => ['nullable', 'string', 'max:255'],
            'account_number' => ['nullable', 'string', 'max:255'],
            'ifsc_code' => ['nullable', 'string', 'max:255'],
            'account_name' => ['nullable', 'string', 'max:255'],
            'currency' => ['nullable', 'string', 'max:10'],
            'message' => ['nullable', 'string'],
            'service_charge_value' => ['nullable', 'string'],
            'vat_charge_value' => ['nullable', 'string'],
            'country' => ['nullable', 'string', 'max:255'],
        ]);

        $company = Company::query()->first();
        $company?->update($validated);

        return response()->json([
            'message' => 'Company settings updated',
            'data' => $company?->fresh(),
        ]);
    }
}
