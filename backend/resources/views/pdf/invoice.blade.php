<!doctype html>
<html><head><meta charset="utf-8"><style>
body{font-family:DejaVu Sans, sans-serif;font-size:12px;color:#222}h1{margin:0 0 8px}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border:1px solid #bbb;padding:7px;text-align:left}th{background:#eef3f2}.right{text-align:right}.muted{color:#666}
</style></head><body>
<h1>{{ $company->name ?? config('app.name') }}</h1>
<p class="muted">Invoice: {{ $invoice->invoice_no ?? $invoice->iInvoiceId }}</p>
<table><tr><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr>
@foreach($invoice->items ?? [] as $item)<tr><td>{{ $item->description ?? $item->item_name ?? '' }}</td><td>{{ $item->quantity ?? 1 }}</td><td class="right">{{ number_format((float)($item->rate ?? 0), 2) }}</td><td class="right">{{ number_format((float)($item->amount ?? 0), 2) }}</td></tr>@endforeach
<tr><th colspan="3" class="right">Net amount</th><th class="right">{{ number_format((float)$invoice->net_amount, 2) }}</th></tr></table>
<p><strong>Amount in words:</strong> {{ $amount_in_words }}</p>
</body></html>
