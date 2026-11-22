<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Bill;
use App\Models\Registration;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Bills in the NCRC Pvt Ltd / NCS LLP formats. Totals are worked out here from the
 * line items so the list, the print and the Registrations "Bill" column always agree.
 */
class BillController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $bills = Bill::query()
            ->when($request->query('company'), fn ($q, $c) => $q->where('company', $c))
            ->when($request->query('uid'), fn ($q, $uid) => $q->where('uid_no', trim((string) $uid)))
            ->when($request->query('start_date'), fn ($q, $d) => $q->whereDate('invoice_date', '>=', $d))
            ->when($request->query('end_date'), fn ($q, $d) => $q->whereDate('invoice_date', '<=', $d))
            ->orderByDesc('invoice_date')
            ->orderByDesc('id')
            ->get()
            ->map(fn (Bill $b) => $b->toApi());

        return response()->json(['data' => $bills]);
    }

    /** UIDs that have at least one bill (for the Registrations "Bill" column) */
    public function billedUids(): JsonResponse
    {
        $uids = Bill::query()->whereNotNull('uid_no')->where('uid_no', '!=', '')->distinct()->pluck('uid_no');

        return response()->json(['data' => $uids]);
    }

    public function show(Bill $bill): JsonResponse
    {
        return response()->json(['data' => $bill->toApi()]);
    }

    public function store(Request $request): JsonResponse
    {
        $bill = Bill::create($this->validated($request) + [
            'created_by' => $request->user()?->id,
            'updated_by' => $request->user()?->id,
        ]);

        return response()->json(['data' => $bill->toApi()], 201);
    }

    public function update(Request $request, Bill $bill): JsonResponse
    {
        $bill->update($this->validated($request, $bill) + ['updated_by' => $request->user()?->id]);

        return response()->json(['data' => $bill->fresh()->toApi()]);
    }

    public function destroy(Bill $bill): JsonResponse
    {
        $bill->delete();

        return response()->json(['message' => 'Bill deleted']);
    }

    /** Cancels the bill; with `credit_note` it also records the credit note (number typed by hand) */
    public function cancel(Request $request, Bill $bill): JsonResponse
    {
        $v = $request->validate([
            'reason' => ['nullable', 'string', 'max:2000'],
            'credit_note' => ['nullable', 'boolean'],
            'credit_note_no' => ['required_if_accepted:credit_note', 'nullable', 'string', 'max:50'],
            'credit_note_date' => ['nullable', 'date'],
        ], [
            'credit_note_no.required_if_accepted' => 'Enter the credit note number.',
        ]);

        // Only NCS LLP invoices can be cancelled (they move to Credit Note); NCRC Pvt Ltd invoices cannot
        if ($bill->company !== 'ncs') {
            return response()->json(['message' => 'Only NCS LLP invoices can be cancelled.'], 422);
        }

        $updates = [
            'cancelled_at' => $bill->cancelled_at ?? now()->toDateString(),
            'cancel_reason' => trim((string) ($v['reason'] ?? '')) ?: $bill->cancel_reason,
            'updated_by' => $request->user()?->id,
        ];

        if ($request->boolean('credit_note')) {
            $no = trim((string) $v['credit_note_no']);
            $taken = Bill::query()->where('company', $bill->company)->where('credit_note_no', $no)
                ->where('id', '!=', $bill->id)->exists();
            if ($taken) {
                return response()->json(['message' => "Credit note {$no} is already used.", 'errors' => ['credit_note_no' => ["Credit note {$no} is already used."]]], 422);
            }
            $updates['credit_note_no'] = $no;
            $updates['credit_note_date'] = $v['credit_note_date'] ?? now()->toDateString();
        }

        $bill->update($updates);

        return response()->json(['data' => $bill->fresh()->toApi()]);
    }

    /**
     * Saves the credit note of a cancelled NCS LLP invoice: number, date, reason and its own copy of
     * client / references / particulars / amounts (pre-filled from the invoice; the invoice is not changed).
     */
    public function saveCreditNote(Request $request, Bill $bill): JsonResponse
    {
        if ($bill->company !== 'ncs' || ! $bill->cancelled_at) {
            return response()->json(['message' => 'Credit notes are only for cancelled NCS LLP invoices.'], 422);
        }
        $request->validate([
            'credit_note_no' => ['required', 'string', 'max:50'],
            'credit_note_date' => ['nullable', 'date'],
            'reason' => ['nullable', 'string', 'max:2000'],
        ], ['credit_note_no.required' => 'Enter the credit note number.']);

        $no = trim((string) $request->input('credit_note_no'));
        $taken = Bill::query()->where('company', $bill->company)->where('credit_note_no', $no)->where('id', '!=', $bill->id)->exists();
        if ($taken) {
            return response()->json(['message' => "Credit note {$no} is already used.", 'errors' => ['credit_note_no' => ["Credit note {$no} is already used."]]], 422);
        }

        // Same checks and totals as an invoice
        $request->merge(['company' => $bill->company, 'invoice_no' => $bill->invoice_no]);
        $v = $this->validated($request, $bill);
        $doc = array_intersect_key($v, array_flip([
            'uid_no', 'uid_date', 'work_order_no', 'work_order_date', 'report_no', 'report_date', 'terms_of_delivery',
            'client_name', 'client_address', 'client_gstin', 'items', 'gst_type', 'transport', 'subtotal', 'cgst', 'sgst', 'igst',
        ]));
        $total = round($v['subtotal'] + $v['cgst'] + $v['sgst'] + $v['igst'] + $v['transport']);

        $bill->update([
            'credit_note_no' => $no,
            'credit_note_date' => $request->input('credit_note_date') ?: ($bill->credit_note_date?->format('Y-m-d') ?? now()->toDateString()),
            'cancel_reason' => trim((string) $request->input('reason', '')) ?: null,
            'credit_note_data' => $doc + ['total' => $total],
            'credit_amount' => $total,
            'updated_by' => $request->user()?->id,
        ]);

        return response()->json(['data' => $bill->fresh()->toApi()]);
    }

    /** Undo a cancellation (also removes its credit note) */
    public function restore(Request $request, Bill $bill): JsonResponse
    {
        $bill->update([
            'cancelled_at' => null, 'cancel_reason' => null, 'credit_note_no' => null, 'credit_note_date' => null,
            'credit_note_data' => null, 'credit_amount' => 0,
            'updated_by' => $request->user()?->id,
        ]);

        return response()->json(['data' => $bill->fresh()->toApi()]);
    }

    /** Next number in the company's series for the financial year of `date`: "2026-27/0001" */
    public function nextNumber(Request $request): JsonResponse
    {
        $request->validate([
            'company' => ['required', Rule::in(Bill::COMPANIES)],
            'date' => ['nullable', 'date'],
        ]);

        return response()->json(['data' => $this->suggestNumber($request->query('company'), $request->query('date'))]);
    }

    /** Client details from the registration with this UID, to fill a new bill */
    public function fromRegistration(string $uid): JsonResponse
    {
        $reg = Registration::query()->where('uid_no', trim($uid))->latest('iClientId')->first();
        if (! $reg) {
            return response()->json(['message' => 'No registration found for this UID.'], 404);
        }

        return response()->json(['data' => [
            'uid_no' => $reg->uid_no,
            'uid_date' => $this->isoDate($reg->received_date),
            'client_name' => trim((string) $reg->agency_name),
            'client_address' => trim((string) $reg->reporting_address),
            'client_gstin' => trim((string) $reg->gst_no),
            'work_order_no' => trim((string) $reg->work_order_no),
            'report_no' => trim((string) $reg->report_no),
            'name_of_work' => trim((string) ($reg->name_of_work ?: $reg->work)),
            'advance' => (float) preg_replace('/[^\d.]/', '', (string) $reg->advance_payment),
        ]]);
    }

    private function suggestNumber(string $company, ?string $date): string
    {
        $fy = Bill::financialYear($date);
        $max = 0;
        Bill::query()->where('company', $company)->where('invoice_no', 'like', $fy . '/%')
            ->pluck('invoice_no')
            ->each(function ($no) use (&$max): void {
                if (preg_match('/\/(\d+)\s*$/', (string) $no, $m)) {
                    $max = max($max, (int) $m[1]);
                }
            });

        return $fy . '/' . str_pad((string) ($max + 1), 4, '0', STR_PAD_LEFT);
    }

    private function isoDate($value): ?string
    {
        if (! $value) {
            return null;
        }
        $ts = strtotime((string) $value);

        return $ts ? date('Y-m-d', $ts) : null;
    }

    private function validated(Request $request, ?Bill $bill = null): array
    {
        $v = $request->validate([
            'company' => ['required', Rule::in(Bill::COMPANIES)],
            'invoice_no' => ['nullable', 'string', 'max:50'],
            'invoice_date' => ['nullable', 'date'],
            'uid_no' => ['nullable', 'string', 'max:100'],
            'uid_date' => ['nullable', 'date'],
            'work_order_no' => ['nullable', 'string', 'max:255'],
            'work_order_date' => ['nullable', 'date'],
            'report_no' => ['nullable', 'string', 'max:255'],
            'report_date' => ['nullable', 'date'],
            'sac_code' => ['nullable', 'string', 'max:20'],
            'terms_of_delivery' => ['nullable', 'string', 'max:2000'],
            'client_name' => ['nullable', 'string', 'max:500'],
            'client_address' => ['nullable', 'string', 'max:3000'],
            'client_gstin' => ['nullable', 'string', 'max:50'],
            'items' => ['nullable', 'array', 'max:100'],
            'items.*.description' => ['nullable', 'string', 'max:3000'],
            'items.*.qty' => ['nullable', 'numeric', 'min:0'],
            'items.*.hsn' => ['nullable', 'string', 'max:20'],
            'items.*.rate' => ['nullable', 'numeric', 'min:0'],
            'items.*.discount' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'gst_type' => ['nullable', Rule::in(['intra', 'inter', 'none'])],
            'transport' => ['nullable', 'numeric', 'min:0'],
            'advance' => ['nullable', 'numeric', 'min:0'],
            'amount_received' => ['nullable', 'numeric', 'min:0'],
            'received_date' => ['nullable', 'date'],
            'payment_mode' => ['nullable', 'string', 'max:100'],
            'remark' => ['nullable', 'string', 'max:2000'],
        ]);

        foreach (['invoice_no', 'uid_no', 'work_order_no', 'report_no', 'sac_code', 'terms_of_delivery',
            'client_name', 'client_address', 'client_gstin', 'payment_mode', 'remark'] as $key) {
            $val = isset($v[$key]) ? trim((string) $v[$key]) : '';
            $v[$key] = $val === '' ? null : $val;
        }
        foreach (['invoice_date', 'uid_date', 'work_order_date', 'report_date', 'received_date'] as $key) {
            $v[$key] = $v[$key] ?? null;
        }

        if (! $v['invoice_no'] && ! $bill) {
            $v['invoice_no'] = $this->suggestNumber($v['company'], $v['invoice_date']);
        }

        // Line items: amount = qty × rate, less discount %
        $items = [];
        foreach ($v['items'] ?? [] as $it) {
            $desc = trim((string) ($it['description'] ?? ''));
            $qty = (float) ($it['qty'] ?? 0);
            $rate = (float) ($it['rate'] ?? 0);
            $disc = (float) ($it['discount'] ?? 0);
            if ($desc === '' && $rate == 0.0) {
                continue;
            }
            $items[] = [
                'description' => $desc,
                'qty' => $qty,
                'hsn' => $v['company'] === 'ncs' ? '9983' : '',
                'rate' => $rate,
                'discount' => $disc,
                'amount' => round($qty * $rate * (1 - $disc / 100), 2),
            ];
        }
        $v['items'] = $items;

        // NCRC Pvt Ltd bills carry no GST; NCS LLP: CGST+SGST 9% each within Rajasthan, else IGST 18%
        $v['gst_type'] = $v['company'] === 'ncs' ? ($v['gst_type'] ?? 'intra') : 'none';
        // SAC 998346 and HSN 9983 are fixed on every invoice
        $v['sac_code'] = '998346';
        $v['transport'] = round((float) ($v['transport'] ?? 0), 2);
        $v['advance'] = round((float) ($v['advance'] ?? 0), 2);
        $v['amount_received'] = round((float) ($v['amount_received'] ?? 0), 2);
        $v['subtotal'] = round(array_sum(array_column($items, 'amount')), 2);

        // GST on the items total only; transport is added after GST (NCS LLP bills 0014 / 0025)
        $taxable = $v['subtotal'];
        $v['cgst'] = $v['gst_type'] === 'intra' ? round($taxable * 0.09, 2) : 0;
        $v['sgst'] = $v['cgst'];
        $v['igst'] = $v['gst_type'] === 'inter' ? round($taxable * 0.18, 2) : 0;
        $v['net_amount'] = round($taxable + $v['cgst'] + $v['sgst'] + $v['igst'] + $v['transport'] - $v['advance']);

        return $v;
    }
}
