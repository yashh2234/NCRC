<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Company;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderList;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class PurchaseOrderController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = PurchaseOrder::query()->with('items');

        if ($request->filled('start_date')) {
            $query->whereDate('date', '>=', $request->input('start_date'));
        }
        if ($request->filled('end_date')) {
            $query->whereDate('date', '<=', $request->input('end_date'));
        }

        $orders = $query->orderByDesc('date')->get();

        $orders->transform(function ($po) {
            $po->total_amount = (float) $po->total_amount;
            $po->total_discount = (float) $po->total_discount;
            $po->transportation = (float) $po->transportation;
            $po->gst_amount = (float) $po->gst_amount;
            $po->net_amount = (float) $po->net_amount;
            $po->advance_amount = (float) $po->advance_amount;
            return $po;
        });

        return response()->json(['data' => $orders]);
    }

    public function show($id): JsonResponse
    {
        $po = PurchaseOrder::with(['items', 'user'])->find((int) $id);

        if (!$po) {
            return response()->json(['message' => 'Purchase order not found'], 404);
        }

        return response()->json(['data' => $po]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'date' => ['required', 'date'],
            'purchase_order' => ['required', 'string', 'max:255'],
            'agency_name' => ['nullable', 'string', 'max:255'],
            'reporting_address' => ['nullable', 'string'],
            'vendor_ref_no' => ['nullable', 'string', 'max:255'],
            'vendor_ref_date' => ['nullable', 'date'],
            'total_amount' => ['nullable', 'numeric'],
            'total_discount' => ['nullable', 'numeric'],
            'transportation' => ['nullable', 'numeric'],
            'advance_amount' => ['nullable', 'numeric'],
            'gst_amount' => ['nullable', 'numeric'],
            'net_amount' => ['nullable', 'numeric'],
            'remark' => ['nullable', 'string', 'max:500'],
            'items' => ['nullable', 'array'],
            'items.*.description' => ['nullable', 'string', 'max:255'],
            'items.*.unit' => ['nullable', 'string', 'max:255'],
            'items.*.rate' => ['nullable', 'numeric'],
            'items.*.discount' => ['nullable', 'numeric'],
            'items.*.amount' => ['nullable', 'numeric'],
        ]);

        $validated['user_id'] = Auth::id();

        $po = DB::transaction(function () use ($validated) {
            $poData = collect($validated)->except('items')->toArray();
            $po = PurchaseOrder::query()->create($poData);

            if (!empty($validated['items'])) {
                $items = array_map(function ($item) use ($po) {
                    return [
                        'iPurchaseorderId' => $po->iPurchaseorderId,
                        'description' => $item['description'] ?? null,
                        'unit' => $item['unit'] ?? null,
                        'rate' => $item['rate'] ?? 0,
                        'discount' => $item['discount'] ?? 0,
                        'amount' => $item['amount'] ?? 0,
                        'set_count' => $item['set_count'] ?? 1,
                    ];
                }, $validated['items']);

                PurchaseOrderList::query()->insert($items);
            }

            return $po->fresh(['items']);
        });

        return response()->json(['message' => 'Purchase order created', 'data' => $po], 201);
    }

    public function update(Request $request, $id): JsonResponse
    {
        $po = PurchaseOrder::query()->find((int) $id);

        if (!$po) {
            return response()->json(['message' => 'Purchase order not found'], 404);
        }

        $validated = $request->validate([
            'date' => ['required', 'date'],
            'purchase_order' => ['required', 'string', 'max:255'],
            'agency_name' => ['nullable', 'string', 'max:255'],
            'reporting_address' => ['nullable', 'string'],
            'vendor_ref_no' => ['nullable', 'string', 'max:255'],
            'vendor_ref_date' => ['nullable', 'date'],
            'total_amount' => ['nullable', 'numeric'],
            'total_discount' => ['nullable', 'numeric'],
            'transportation' => ['nullable', 'numeric'],
            'advance_amount' => ['nullable', 'numeric'],
            'gst_amount' => ['nullable', 'numeric'],
            'net_amount' => ['nullable', 'numeric'],
            'remark' => ['nullable', 'string', 'max:500'],
            'items' => ['nullable', 'array'],
            'items.*.description' => ['nullable', 'string', 'max:255'],
            'items.*.unit' => ['nullable', 'string', 'max:255'],
            'items.*.rate' => ['nullable', 'numeric'],
            'items.*.discount' => ['nullable', 'numeric'],
            'items.*.amount' => ['nullable', 'numeric'],
        ]);

        DB::transaction(function () use ($validated, $po) {
            $poData = collect($validated)->except('items')->toArray();
            $po->update($poData);

            $po->items()->delete();

            if (!empty($validated['items'])) {
                $items = array_map(function ($item) use ($po) {
                    return [
                        'iPurchaseorderId' => $po->iPurchaseorderId,
                        'description' => $item['description'] ?? null,
                        'unit' => $item['unit'] ?? null,
                        'rate' => $item['rate'] ?? 0,
                        'discount' => $item['discount'] ?? 0,
                        'amount' => $item['amount'] ?? 0,
                        'set_count' => $item['set_count'] ?? 1,
                    ];
                }, $validated['items']);

                PurchaseOrderList::query()->insert($items);
            }
        });

        return response()->json(['message' => 'Purchase order updated', 'data' => $po->fresh(['items'])]);
    }

    public function destroy($id): JsonResponse
    {
        $po = PurchaseOrder::query()->find((int) $id);

        if (!$po) {
            return response()->json(['message' => 'Purchase order not found'], 404);
        }

        DB::transaction(function () use ($po) {
            $po->items()->delete();
            $po->delete();
        });

        return response()->json(['message' => 'Purchase order deleted']);
    }

    public function printDiv($id): JsonResponse
    {
        $po = PurchaseOrder::with('items')->find((int) $id);

        if (!$po) {
            return response()->json(['message' => 'Purchase order not found'], 404);
        }

        $company = Company::query()->first();
        $items = $po->items;
        $sn = 0;

        $rowHtml = '';
        foreach ($items as $item) {
            $sn++;
            $rowHtml .= '<tr>
                <td style="text-align:center;">'.$sn.'</td>
                <td>'.e($item->description ?? '').'</td>
                <td style="text-align:right;">'.e($item->rate ?? '0').'</td>
                <td style="text-align:center;">'.e($item->unit ?? '').'</td>
                <td style="text-align:right;">'.number_format((float) ($item->discount ?? 0), 2).'</td>
                <td style="text-align:right;">'.number_format((float) ($item->amount ?? 0), 2).'</td>
            </tr>';
        }

        $totalAmount = number_format((float) ($po->total_amount ?? 0), 2);
        $discount = number_format((float) ($po->total_discount ?? 0), 2);
        $transportation = number_format((float) ($po->transportation ?? 0), 2);
        $gst = number_format((float) ($po->gst_amount ?? 0), 2);
        $netAmount = number_format((float) ($po->net_amount ?? 0), 2);
        $advance = number_format((float) ($po->advance_amount ?? 0), 2);

        $numToWords = $this->getIndianCurrency((float) ($po->net_amount ?? 0));

        $html = '<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Purchase Order - '.e($po->purchase_order ?? '').'</title>
<style>
body{font-family:Arial,Helvetica,sans-serif;font-size:12px;margin:0;padding:20px;color:#222;}
.po-box{max-width:800px;margin:0 auto;border:1px solid #ccc;padding:20px;}
h1{font-size:20px;margin:0 0 4px;text-align:center;}
.company-details{text-align:center;margin-bottom:16px;font-size:11px;color:#444;}
.po-info{display:flex;justify-content:space-between;margin-bottom:12px;border-bottom:1px solid #ddd;padding-bottom:8px;}
.po-info div{width:48%;}
.po-info table{width:100%;font-size:11px;}
.po-info td{padding:2px 4px;}
.customer-details{margin-bottom:12px;border-bottom:1px solid #ddd;padding-bottom:8px;}
.customer-details strong{font-size:13px;}
.customer-details p{margin:2px 0;font-size:11px;}
table.items{width:100%;border-collapse:collapse;margin-bottom:12px;}
table.items th,table.items td{border:1px solid #999;padding:5px 6px;font-size:11px;}
table.items th{background:#f0f0f0;font-weight:700;text-align:center;}
.totals{display:flex;justify-content:flex-end;margin-bottom:12px;}
.totals table{font-size:11px;width:280px;}
.totals td{padding:2px 6px;}
.totals .label{text-align:right;font-weight:600;}
.totals .value{text-align:right;}
.amount-words{margin-bottom:12px;font-size:11px;font-weight:600;}
.po-footer{margin-bottom:12px;border-top:1px solid #ddd;padding-top:8px;}
.po-footer table{width:100%;font-size:11px;}
.po-footer td{padding:1px 4px;}
.signature{text-align:right;margin-top:24px;font-size:12px;}
.signature p{margin:2px 0;}
.print-btn{text-align:center;margin-top:16px;}
@media print{.print-btn{display:none;}}
</style>
</head>
<body>
<div class="po-box">
<h1>'.e($company->company_name ?? 'Namotech Consultancy Services LLP').'</h1>
<div class="company-details">
'.nl2br(e($company->address ?? '')).'<br>
GST: '.e($company->gst_no ?? '').' | PAN: '.e($company->pan_no ?? '').' | Phone: '.e($company->phone ?? '').'
</div>

<div class="po-info">
<div>
<table>
<tr><td><strong>Purchase Order No:</strong></td><td>'.e($po->purchase_order ?? '').'</td></tr>
<tr><td><strong>Date:</strong></td><td>'.e($po->date ?? '').'</td></tr>
</table>
</div>
<div>
<table>
<tr><td><strong>Vendor Ref No:</strong></td><td>'.e($po->vendor_ref_no ?? '').'</td></tr>
<tr><td><strong>Vendor Ref Date:</strong></td><td>'.e($po->vendor_ref_date ?? '').'</td></tr>
</table>
</div>
</div>

<div class="customer-details">
<strong>To</strong>
<p><strong>'.e($po->agency_name ?? '').'</strong></p>
<p>'.nl2br(e($po->reporting_address ?? '')).'</p>
</div>

<table class="items">
<thead>
<tr><th style="width:30px;">S.N</th><th>Description</th><th style="width:60px;">Rate</th><th style="width:50px;">Unit</th><th style="width:60px;">Discount</th><th style="width:70px;">Amount</th></tr>
</thead>
<tbody>
'.$rowHtml.'
</tbody>
</table>

<div class="totals">
<div>
<table>
<tr><td class="label">Total Amount:</td><td class="value">'.e($totalAmount).'</td></tr>
<tr><td class="label">Discount:</td><td class="value">'.e($discount).'</td></tr>
<tr><td class="label">Transportation:</td><td class="value">'.e($transportation).'</td></tr>
<tr><td class="label">GST @ 18%:</td><td class="value">'.e($gst).'</td></tr>
<tr><td class="label">Advance Amount:</td><td class="value">'.e($advance).'</td></tr>
<tr><td class="label" style="font-size:13px;font-weight:700;">Net Payable:</td><td class="value" style="font-size:13px;font-weight:700;">'.e($netAmount).'</td></tr>
</table>
</div>
</div>

<div class="amount-words">Amount in words: '.$numToWords.'</div>

<div class="po-footer">
<strong>Details</strong>
<table>
<tr><td style="width:120px;">Payment Terms:</td><td>On Completion</td></tr>
<tr><td>GSTIN:</td><td>'.e($company->gst_no ?? '').'</td></tr>
<tr><td>PAN:</td><td>'.e($company->pan_no ?? '').'</td></tr>
<tr><td>Payment Mode:</td><td>NEFT / RTGS</td></tr>
<tr><td>HSN Code:</td><td>9983</td></tr>
<tr><td>Remark:</td><td>'.nl2br(e($po->remark ?? '')).'</td></tr>
</table>
</div>

<div class="signature">
<p><strong>For Namotech Consultancy Services LLP</strong></p>
<br><br>
<p>(Authorised Signatory)</p>
</div>
</div>

<div class="print-btn">
<button onclick="window.print()">Print</button>
</div>
</body>
</html>';

        return response()->json(['html' => $html]);
    }

    private function getIndianCurrency(float $number): string
    {
        $no = round($number, 2);
        $decimal = round($no - floor($no), 2) * 100;
        $hundred = null;
        $digits_length = strlen((string) floor($no));
        $words = ['0' => '', '1' => 'One', '2' => 'Two', '3' => 'Three', '4' => 'Four', '5' => 'Five', '6' => 'Six', '7' => 'Seven', '8' => 'Eight', '9' => 'Nine', '10' => 'Ten', '11' => 'Eleven', '12' => 'Twelve', '13' => 'Thirteen', '14' => 'Fourteen', '15' => 'Fifteen', '16' => 'Sixteen', '17' => 'Seventeen', '18' => 'Eighteen', '19' => 'Nineteen', '20' => 'Twenty', '30' => 'Thirty', '40' => 'Forty', '50' => 'Fifty', '60' => 'Sixty', '70' => 'Seventy', '80' => 'Eighty', '90' => 'Ninety'];
        $digits = ['', 'Hundred', 'Thousand', 'Lakh', 'Crore'];
        $i = 0;
        $str = [];

        if ($digits_length >= 2) {
            $i = 2;
        }

        while ($i < $digits_length) {
            $divider = ($i === 2) ? 10 : 100;
            $number = floor($no % $divider);
            $no = floor($no / $divider);
            $i += $divider === 10 ? 1 : 2;

            if ($number) {
                $plural = (($counter = count($str)) && $number > 9) ? 's' : null;
                $hundred = ($counter === 1 && $str[0] !== '') ? ' and ' : null;
                $str[] = ($number < 21) ? $words[(string) $number] . ' ' . $digits[$counter] . $plural . ' ' . $hundred : $words[((int) ($number / 10) * 10)] . ' ' . $words[(string) ($number % 10)] . ' ' . $digits[$counter] . $plural . ' ' . $hundred;
            } else {
                $str[] = null;
            }
        }

        $result = implode('', array_reverse($str));

        if ((int) $decimal > 0) {
            $decimalWord = ($decimal < 21) ? $words[(string) $decimal] : $words[((int) ($decimal / 10) * 10)] . ' ' . $words[(string) ($decimal % 10)];
            $result .= ' and ' . $decimalWord . ' Paise';
        }

        return 'INR ' . ($result ?: 'Zero') . ' Only';
    }
}
