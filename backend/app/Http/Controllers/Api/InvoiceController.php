<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Invoice;
use App\Models\InvoiceList;
use App\Models\Jobs;
use App\Models\UserActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class InvoiceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $startDate = $request->query('start_date');
        $endDate = $request->query('end_date');

        $invoices = Invoice::query()
            ->when($startDate && $endDate, fn ($q) => $q->whereBetween('date', [$startDate, $endDate]))
            ->with('items')
            ->orderByDesc('iInvoiceId')
            ->limit(200)
            ->get()
            ->map(fn (Invoice $inv): array => [
                'iInvoiceId' => $inv->iInvoiceId,
                'date' => optional($inv->date)->format('d M Y'),
                'invoice_no' => $inv->invoice_no,
                'work_order_no' => $inv->work_order_no,
                'agency_name' => $inv->agency_name,
                'reporting_address' => $inv->reporting_address,
                'net_amount' => $inv->net_amount,
                'items_count' => $inv->items->count(),
            ]);

        return response()->json(['data' => $invoices]);
    }

    public function show(int $id): JsonResponse
    {
        $invoice = Invoice::query()->with('items')->where('iInvoiceId', $id)->firstOrFail();

        return response()->json(['data' => $invoice]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'date' => ['required', 'string'],
            'invoice_no' => ['required', 'string', 'max:222'],
            'work_order_no' => ['required', 'string', 'max:222'],
            'work_order_date' => ['required', 'string'],
            'report_no' => ['required', 'string', 'max:222'],
            'report_date' => ['required', 'string'],
            'agency_name' => ['required', 'string', 'max:222'],
            'reporting_address' => ['required', 'string', 'max:222'],
            'agency_gst' => ['nullable', 'string', 'max:222'],
            'agency_state' => ['nullable', 'string', 'max:222'],
            'terms_of_delivery' => ['nullable', 'string', 'max:222'],
            'total_amount' => ['nullable', 'string'],
            'total_discount' => ['nullable', 'string'],
            'transportation' => ['nullable', 'string'],
            'sgst_amount' => ['nullable', 'string'],
            'cgst_amount' => ['nullable', 'string'],
            'gst_amount' => ['nullable', 'string'],
            'net_amount' => ['nullable', 'string'],
            'advance_amount' => ['nullable', 'string'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.description' => ['required', 'string'],
            'items.*.unit' => ['nullable', 'string'],
            'items.*.rate' => ['nullable', 'string'],
            'items.*.discount' => ['nullable', 'string'],
            'items.*.amount' => ['nullable', 'string'],
            'set_count' => ['nullable', 'string'],
        ]);

        $userId = (int) $request->user()->id;

        $invoiceId = DB::transaction(function () use ($validated, $userId): int {
            $nextId = ((int) (Invoice::query()->max('iInvoiceId') ?? 0)) + 1;

            Invoice::query()->create([
                'iInvoiceId' => $nextId,
                'date' => $validated['date'],
                'invoice_no' => $validated['invoice_no'],
                'work_order_no' => $validated['work_order_no'],
                'work_order_date' => $validated['work_order_date'],
                'report_no' => $validated['report_no'],
                'report_date' => $validated['report_date'],
                'agency_name' => $validated['agency_name'],
                'reporting_address' => $validated['reporting_address'],
                'agency_gst' => $validated['agency_gst'] ?? '',
                'agency_state' => $validated['agency_state'] ?? '',
                'terms_of_delivery' => $validated['terms_of_delivery'] ?? '',
                'total_amount' => $validated['total_amount'] ?? '0',
                'total_discount' => $validated['total_discount'] ?? '0',
                'transportation' => $validated['transportation'] ?? '0',
                'sgst_amount' => $validated['sgst_amount'] ?? '0',
                'cgst_amount' => $validated['cgst_amount'] ?? '0',
                'gst_amount' => $validated['gst_amount'] ?? '0',
                'net_amount' => $validated['net_amount'] ?? '0',
                'advance_amount' => $validated['advance_amount'] ?? '0',
                'user_id' => $userId,
            ]);

            $setCount = $validated['set_count'] ?? count($validated['items']);
            foreach ($validated['items'] as $item) {
                InvoiceList::query()->create([
                    'iInvoiceId' => $nextId,
                    'description' => $item['description'] ?? '',
                    'unit' => $item['unit'] ?? '',
                    'rate' => $item['rate'] ?? '0',
                    'discount' => $item['discount'] ?? '0',
                    'amount' => $item['amount'] ?? '0',
                    'set_count' => $setCount,
                    'create_date' => now(),
                ]);
            }

            return $nextId;
        });

        UserActivity::query()->create([
            'user_id' => $userId,
            'action' => 'invoice_created',
            'module' => 'invoices',
            'details' => "Created invoice {$validated['invoice_no']}",
            'ip_address' => $request->ip(),
            'created_at' => now(),
        ]);

        return response()->json(['message' => 'Invoice created', 'iInvoiceId' => $invoiceId], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate([
            'date' => ['required', 'string'],
            'invoice_no' => ['required', 'string', 'max:222'],
            'work_order_no' => ['required', 'string', 'max:222'],
            'work_order_date' => ['required', 'string'],
            'report_no' => ['required', 'string', 'max:222'],
            'report_date' => ['required', 'string'],
            'agency_name' => ['required', 'string', 'max:222'],
            'reporting_address' => ['required', 'string', 'max:222'],
            'agency_gst' => ['nullable', 'string', 'max:222'],
            'agency_state' => ['nullable', 'string', 'max:222'],
            'terms_of_delivery' => ['nullable', 'string', 'max:222'],
            'total_amount' => ['nullable', 'string'],
            'total_discount' => ['nullable', 'string'],
            'transportation' => ['nullable', 'string'],
            'sgst_amount' => ['nullable', 'string'],
            'cgst_amount' => ['nullable', 'string'],
            'gst_amount' => ['nullable', 'string'],
            'net_amount' => ['nullable', 'string'],
            'advance_amount' => ['nullable', 'string'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.iIlid' => ['nullable', 'integer'],
            'items.*.description' => ['required', 'string'],
            'items.*.unit' => ['nullable', 'string'],
            'items.*.rate' => ['nullable', 'string'],
            'items.*.discount' => ['nullable', 'string'],
            'items.*.amount' => ['nullable', 'string'],
            'set_count' => ['nullable', 'string'],
        ]);

        $invoice = Invoice::query()->where('iInvoiceId', $id)->firstOrFail();

        DB::transaction(function () use ($validated, $id): void {
            Invoice::query()->where('iInvoiceId', $id)->update([
                'date' => $validated['date'],
                'invoice_no' => $validated['invoice_no'],
                'work_order_no' => $validated['work_order_no'],
                'work_order_date' => $validated['work_order_date'],
                'report_no' => $validated['report_no'],
                'report_date' => $validated['report_date'],
                'agency_name' => $validated['agency_name'],
                'reporting_address' => $validated['reporting_address'],
                'agency_gst' => $validated['agency_gst'] ?? '',
                'agency_state' => $validated['agency_state'] ?? '',
                'terms_of_delivery' => $validated['terms_of_delivery'] ?? '',
                'total_amount' => $validated['total_amount'] ?? '0',
                'total_discount' => $validated['total_discount'] ?? '0',
                'transportation' => $validated['transportation'] ?? '0',
                'sgst_amount' => $validated['sgst_amount'] ?? '0',
                'cgst_amount' => $validated['cgst_amount'] ?? '0',
                'gst_amount' => $validated['gst_amount'] ?? '0',
                'net_amount' => $validated['net_amount'] ?? '0',
                'advance_amount' => $validated['advance_amount'] ?? '0',
            ]);

            InvoiceList::query()->where('iInvoiceId', $id)->delete();

            $setCount = $validated['set_count'] ?? count($validated['items']);
            foreach ($validated['items'] as $item) {
                InvoiceList::query()->create([
                    'iInvoiceId' => $id,
                    'description' => $item['description'] ?? '',
                    'unit' => $item['unit'] ?? '',
                    'rate' => $item['rate'] ?? '0',
                    'discount' => $item['discount'] ?? '0',
                    'amount' => $item['amount'] ?? '0',
                    'set_count' => $setCount,
                    'create_date' => now(),
                ]);
            }
        });

        UserActivity::query()->create([
            'user_id' => $request->user()->id,
            'action' => 'invoice_updated',
            'module' => 'invoices',
            'details' => "Updated invoice {$validated['invoice_no']}",
            'ip_address' => $request->ip(),
            'created_at' => now(),
        ]);

        return response()->json(['message' => 'Invoice updated']);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $invoice = Invoice::query()->where('iInvoiceId', $id)->firstOrFail();

        InvoiceList::query()->where('iInvoiceId', $id)->delete();
        $invoice->delete();

        UserActivity::query()->create([
            'user_id' => $request->user()->id,
            'action' => 'invoice_deleted',
            'module' => 'invoices',
            'details' => "Deleted invoice #{$id}",
            'ip_address' => $request->ip(),
            'created_at' => now(),
        ]);

        return response()->json(['message' => 'Invoice deleted']);
    }

    public function jobInvoices(Jobs $job): JsonResponse
    {
        $invoices = Invoice::query()
            ->where('work_order_no', $job->uid_no)
            ->with('items')
            ->orderByDesc('iInvoiceId')
            ->get();

        return response()->json(['data' => $invoices]);
    }

    public function printInvoice(Request $request, int $id)
    {
        $invoice = Invoice::query()->with('items')->where('iInvoiceId', $id)->firstOrFail();

        $company = \App\Models\Company::first();

        $payload = [
            'invoice' => $invoice,
            'company' => $company,
            'amount_in_words' => $this->getIndianCurrency((float) $invoice->net_amount),
        ];

        if ($request->query('format') === 'pdf') {
            $html = view('pdf.invoice', $payload)->render();
            return \Barryvdh\DomPDF\Facade\Pdf::loadHTML($html)
                ->download('invoice-' . ($invoice->invoice_no ?? $invoice->iInvoiceId) . '.pdf');
        }

        return response()->json($payload);
    }

    private function getIndianCurrency(float $number): string
    {
        $ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
            'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
        $tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

        if ($number == 0) return 'Zero Rupees';

        $int = (int) $number;
        $paise = round(($number - $int) * 100);
        $result = '';

        if ($int >= 10000000) {
            $result .= $this->getIndianCurrency((int)($int / 10000000)) . ' Crore ';
            $int %= 10000000;
        }
        if ($int >= 100000) {
            $result .= $this->getIndianCurrency((int)($int / 100000)) . ' Lakh ';
            $int %= 100000;
        }
        if ($int >= 1000) {
            $result .= $this->getIndianCurrency((int)($int / 1000)) . ' Thousand ';
            $int %= 1000;
        }
        if ($int >= 100) {
            $result .= $ones[(int)($int / 100)] . ' Hundred ';
            $int %= 100;
        }
        if ($int >= 20) {
            $result .= $tens[(int)($int / 10)] . ' ';
            $int %= 10;
        }
        if ($int > 0) {
            $result .= $ones[$int] . ' ';
        }

        $result = trim($result) . ' Rupees';
        if ($paise > 0) {
            $result .= ' and ' . trim($this->getIndianCurrency($paise)) . ' Paise';
        }

        return $result;
    }
}
