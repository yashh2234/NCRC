<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PerformaInvoice;
use App\Services\BillApproval;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/** Performa invoices of NCS LLP. Totals are worked out here from the items, as on the invoices. */
class PerformaInvoiceController extends Controller
{
    public function index(): JsonResponse
    {
        $rows = PerformaInvoice::query()->orderByDesc('invoice_date')->orderByDesc('id')->get()
            ->map(fn (PerformaInvoice $p) => $p->toApi());

        return response()->json(['data' => $rows]);
    }

    public function nextNumber(Request $request): JsonResponse
    {
        $request->validate(['date' => ['nullable', 'date']]);

        return response()->json(['data' => PerformaInvoice::nextNumber($request->query('date'))]);
    }

    public function store(Request $request, BillApproval $approval): JsonResponse
    {
        $performa = DB::transaction(function () use ($request, $approval): PerformaInvoice {
            $performa = PerformaInvoice::create($this->validated($request) + [
                'created_by' => $request->user()?->id,
                'updated_by' => $request->user()?->id,
            ]);
            $approval->saved($performa, null, $request->user());

            return $performa;
        });

        return response()->json(['data' => $performa->fresh()->toApi()], 201);
    }

    public function show(PerformaInvoice $performa): JsonResponse
    {
        return response()->json(['data' => $performa->toApi()]);
    }

    public function update(Request $request, PerformaInvoice $performa, BillApproval $approval): JsonResponse
    {
        $data = $this->validated($request, $performa);
        DB::transaction(function () use ($request, $performa, $data, $approval): void {
            $row = PerformaInvoice::query()->lockForUpdate()->findOrFail($performa->id);
            $before = BillApproval::content($row);
            $row->update($data + ['updated_by' => $request->user()?->id]);
            $approval->saved($row, $before, $request->user());
        });

        return response()->json(['data' => $performa->fresh()->toApi()]);
    }

    /** Approve or send back */
    public function decide(Request $request, PerformaInvoice $performa, BillApproval $approval): JsonResponse
    {
        $v = $request->validate([
            'action' => ['required', Rule::in(['approve', 'send_back'])],
            'content_hash' => ['required', 'string'],
            'remark' => ['required_if:action,send_back', 'nullable', 'string', 'max:1000'],
        ], ['remark.required_if' => 'Write what should be corrected.']);
        $approval->decide($performa, $request->user(), $v['action'], $v['content_hash'], trim((string) ($v['remark'] ?? '')));

        return response()->json(['data' => $performa->fresh()->toApi()]);
    }

    public function destroy(PerformaInvoice $performa): JsonResponse
    {
        $performa->delete();

        return response()->json(['message' => 'Performa invoice deleted']);
    }

    private function validated(Request $request, ?PerformaInvoice $performa = null): array
    {
        $v = $request->validate([
            'invoice_no' => ['nullable', 'string', 'max:50', Rule::unique('performa_invoices', 'invoice_no')->ignore($performa?->id)],
            'invoice_date' => ['required', 'date'],
            'uid_no' => ['nullable', 'string', 'max:100'],
            'uid_date' => ['nullable', 'date'],
            'work_order_no' => ['nullable', 'string', 'max:255'],
            'work_order_date' => ['nullable', 'date'],
            'report_no' => ['nullable', 'string', 'max:255'],
            'report_date' => ['nullable', 'date'],
            'terms_of_delivery' => ['nullable', 'string', 'max:2000'],
            'client_name' => ['required', 'string', 'max:500'],
            'client_address' => ['nullable', 'string', 'max:3000'],
            'client_gstin' => ['nullable', 'string', 'max:50'],
            'items' => ['required', 'array', 'min:1', 'max:100'],
            'items.*.description' => ['nullable', 'string', 'max:3000'],
            'items.*.qty' => ['nullable', 'numeric', 'min:0', 'max:9999999'],
            'items.*.rate' => ['nullable', 'numeric', 'min:0', 'max:999999999'],
            'items.*.discount' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'gst_type' => ['nullable', Rule::in(['intra', 'inter'])],
            'transport' => ['nullable', 'numeric', 'min:0', 'max:999999999'],
            'remark' => ['nullable', 'string', 'max:2000'],
        ], [
            'invoice_no.unique' => 'This performa invoice number is already used.',
            'invoice_date.required' => 'Enter the date.',
            'client_name.required' => 'Enter the client name.',
        ]);

        $data = [];
        foreach (['uid_no', 'work_order_no', 'report_no', 'terms_of_delivery', 'client_name', 'client_address', 'client_gstin', 'remark'] as $key) {
            $value = trim((string) ($v[$key] ?? ''));
            $data[$key] = $value === '' ? null : $value;
        }
        foreach (['invoice_date', 'uid_date', 'work_order_date', 'report_date'] as $key) {
            $data[$key] = $v[$key] ?? null;
        }
        $no = trim((string) ($v['invoice_no'] ?? ''));
        $data['invoice_no'] = $no !== '' ? $no : ($performa?->invoice_no ?? PerformaInvoice::nextNumber($data['invoice_date']));

        // Amount = qty × rate, less discount %
        $items = [];
        foreach ($v['items'] as $it) {
            $description = trim((string) ($it['description'] ?? ''));
            [$qty, $rate, $discount] = [(float) ($it['qty'] ?? 0), (float) ($it['rate'] ?? 0), (float) ($it['discount'] ?? 0)];
            if ($description === '' && $rate == 0.0) {
                continue;
            }
            $items[] = [
                'description' => $description, 'qty' => $qty, 'hsn' => '', 'rate' => $rate, 'discount' => $discount,
                'amount' => round($qty * $rate * (1 - $discount / 100), 2),
            ];
        }
        if (! $items) {
            throw ValidationException::withMessages(['items' => 'Enter at least one particular.']);
        }

        // GST always 18% on the items; transport is added after GST, as on the invoices
        $data['items'] = $items;
        $data['gst_type'] = $v['gst_type'] ?? 'intra';
        $data['transport'] = round((float) ($v['transport'] ?? 0), 2);
        $data['subtotal'] = round(array_sum(array_column($items, 'amount')), 2);
        $data['cgst'] = $data['gst_type'] === 'intra' ? round($data['subtotal'] * 0.09, 2) : 0;
        $data['sgst'] = $data['cgst'];
        $data['igst'] = $data['gst_type'] === 'inter' ? round($data['subtotal'] * 0.18, 2) : 0;
        $data['net_amount'] = round($data['subtotal'] + $data['cgst'] + $data['sgst'] + $data['igst'] + $data['transport']);
        // Highest value the amount columns hold
        if ($data['net_amount'] > 999999999999 || $data['subtotal'] > 999999999999) {
            throw ValidationException::withMessages(['items' => 'The total is too large. Check the quantities and rates.']);
        }

        return $data;
    }
}
