<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Jobs;
use App\Models\Quotation;
use App\Models\QuotationItem;
use App\Models\WorkOrder;
use App\Models\WorkflowStage;
use App\Models\WorkflowTemplate;
use App\Models\WorkflowTransition;
use App\Services\WorkflowEngine;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class QuotationController extends Controller
{
    public function index(): JsonResponse
    {
        $quotations = Quotation::with('items')->orderByDesc('date')->orderByDesc('id')->get()
            ->map(fn (Quotation $q) => $q->toApi());

        return response()->json(['data' => $quotations]);
    }

    public function nextNumber(Request $request): JsonResponse
    {
        $request->validate(['date' => ['nullable', 'date'], 'company' => ['nullable', Rule::in(array_keys(Quotation::COMPANIES))]]);

        return response()->json(['data' => Quotation::nextNumber($request->query('company') ?: 'ncs', $request->query('date'))]);
    }

    public function store(Request $request): JsonResponse
    {
        [$data, $items] = $this->validated($request);

        $quotation = DB::transaction(function () use ($data, $items, $request) {
            $quotation = Quotation::create($data + [
                'status' => 'draft',
                'created_by' => $request->user()?->id,
                'updated_by' => $request->user()?->id,
            ]);
            $quotation->items()->createMany($items);

            return $quotation;
        });

        return response()->json(['data' => $quotation->fresh('items')->toApi()], 201);
    }

    public function show(Quotation $quotation): JsonResponse
    {
        return response()->json(['data' => $quotation->toApi()]);
    }

    public function update(Request $request, Quotation $quotation): JsonResponse
    {
        [$data, $items] = $this->validated($request, $quotation);

        DB::transaction(function () use ($quotation, $data, $items, $request): void {
            $quotation->update($data + ['updated_by' => $request->user()?->id]);
            $quotation->items()->delete();
            $quotation->items()->createMany($items);
        });

        return response()->json(['data' => $quotation->fresh('items')->toApi()]);
    }

    public function setStatus(Request $request, Quotation $quotation): JsonResponse
    {
        $status = $request->validate(['status' => ['required', Rule::in(Quotation::STATUSES)]])['status'];

        $quotation->status = $status;
        if ($status === 'sent') {
            $quotation->sent_at ??= now();
        }
        if ($status === 'accepted') {
            $quotation->accepted_at ??= now();
        }
        $quotation->save();

        return response()->json(['data' => $quotation->toApi()]);
    }

    public function destroy(Quotation $quotation): JsonResponse
    {
        DB::transaction(function () use ($quotation): void {
            $quotation->items()->delete();
            $quotation->delete();
        });

        return response()->json(['message' => 'Quotation deleted']);
    }

    /** @return array{0: array, 1: array} quotation columns and item rows, with the totals worked out */
    private function validated(Request $request, ?Quotation $quotation = null): array
    {
        $v = $request->validate([
            'company' => ['nullable', Rule::in(array_keys(Quotation::COMPANIES))],
            'inquiry_id' => ['nullable', 'integer', 'exists:inquiries,id'],
            'quotation_no' => ['nullable', 'string', 'max:50', Rule::unique('quotations', 'quotation_no')->ignore($quotation?->id)],
            'date' => ['required', 'date'],
            'valid_until' => ['nullable', 'date'],
            'client_name' => ['required', 'string', 'max:222'],
            'client_address' => ['nullable', 'string', 'max:3000'],
            'client_gstin' => ['nullable', 'string', 'max:50'],
            'contact_person' => ['nullable', 'string', 'max:222'],
            'mobile_no' => ['nullable', 'string', 'max:50'],
            'email' => ['nullable', 'email', 'max:222'],
            'location' => ['nullable', 'string', 'max:222'],
            'ref_no' => ['nullable', 'string', 'max:255'],
            'ref_date' => ['nullable', 'date'],
            'prepared_by' => ['nullable', 'string', 'max:222'],
            'subject' => ['nullable', 'string', 'max:1000'],
            'intro' => ['nullable', 'string', 'max:3000'],
            'discount' => ['nullable', 'numeric', 'min:0', 'max:999999999'],
            'transport' => ['nullable', 'numeric', 'min:0', 'max:999999999'],
            'transport_gst' => ['nullable', 'boolean'],
            'payment_terms' => ['nullable', 'string', 'max:2000'],
            'sections' => ['nullable', 'array', 'max:30'],
            'sections.*.title' => ['nullable', 'string', 'max:200'],
            'sections.*.style' => ['nullable', Rule::in(['text', 'bullets', 'numbers'])],
            'sections.*.body' => ['nullable', 'string', 'max:10000'],
            'sections.*.half' => ['nullable', 'boolean'],
            'signatory_name' => ['nullable', 'string', 'max:222'],
            'signatory_designation' => ['nullable', 'string', 'max:222'],
            'notes' => ['nullable', 'string', 'max:3000'],
            'items' => ['required', 'array', 'min:1', 'max:200'],
            'items.*.kind' => ['nullable', Rule::in(QuotationItem::KINDS)],
            'items.*.description' => ['nullable', 'string', 'max:2000'],
            'items.*.details' => ['nullable', 'string', 'max:6000'],
            'items.*.extra' => ['nullable', 'array', 'max:30'],
            'items.*.extra.*.title' => ['nullable', 'string', 'max:2000'],
            'items.*.extra.*.details' => ['nullable', 'string', 'max:6000'],
            'items.*.quantity' => ['nullable', 'numeric', 'min:0', 'max:9999999'],
            'items.*.unit' => ['nullable', 'string', 'max:50'],
            'items.*.rate' => ['nullable', 'numeric', 'min:0', 'max:999999999'],
            'items.*.included' => ['nullable', 'boolean'],
        ], [
            'quotation_no.unique' => 'This quotation number is already used.',
            'client_name.required' => 'Enter the client name.',
            'date.required' => 'Enter the quotation date.',
            'email.email' => 'Enter a valid email address.',
        ]);

        // Items: amount = qty × rate; an "Included" item carries no amount, nor does a heading
        $items = [];
        foreach ($v['items'] as $it) {
            $description = trim((string) ($it['description'] ?? ''));
            $details = trim((string) ($it['details'] ?? ''));
            $kind = $it['kind'] ?? 'item';
            if ($kind !== 'item') {
                if ($description !== '') {
                    $items[] = [
                        'kind' => $kind, 'description' => $description, 'details' => null, 'extra' => null,
                        'quantity' => 0, 'unit' => '', 'rate' => 0, 'amount' => 0, 'included' => false, 'sort_order' => count($items),
                    ];
                }
                continue;
            }
            $extra = [];
            foreach ($it['extra'] ?? [] as $part) {
                $part = ['title' => trim((string) ($part['title'] ?? '')), 'details' => trim((string) ($part['details'] ?? ''))];
                if ($part['title'] !== '' || $part['details'] !== '') {
                    $extra[] = $part;
                }
            }
            $included = (bool) ($it['included'] ?? false);
            $quantity = round((float) ($it['quantity'] ?? 0), 2);
            $rate = $included ? 0.0 : round((float) ($it['rate'] ?? 0), 2);
            if ($description === '' && $details === '' && ! $extra && $rate == 0.0) {
                continue;
            }
            if ($description === '') {
                throw ValidationException::withMessages(['items' => 'Enter the description of work for every item.']);
            }
            $items[] = [
                'kind' => 'item',
                'description' => $description,
                'details' => $details === '' ? null : $details,
                'extra' => $extra ?: null,
                'quantity' => $quantity,
                'unit' => trim((string) ($it['unit'] ?? '')),
                'rate' => $rate,
                'amount' => round($quantity * $rate, 2),
                'included' => $included,
                'sort_order' => count($items),
            ];
        }
        if (! in_array('item', array_column($items, 'kind'), true)) {
            throw ValidationException::withMessages(['items' => 'Add at least one item.']);
        }

        $subtotal = round(array_sum(array_column($items, 'amount')), 2);
        $discount = round((float) ($v['discount'] ?? 0), 2);
        if ($discount > $subtotal) {
            throw ValidationException::withMessages(['discount' => 'Discount cannot be more than the sub total.']);
        }
        // The company is fixed once made. NCS LLP: GST always 18%, on the items less discount and, when chosen,
        // on transport too (transport then comes before GST, else after it). NCRC Pvt Ltd: no GST.
        $company = $quotation?->company ?? $v['company'] ?? 'ncs';
        $mode = $company === 'ncs' ? 'add' : 'none';
        $transport = round((float) ($v['transport'] ?? 0), 2);
        $transportGst = $company === 'ncs' && (bool) ($v['transport_gst'] ?? false);
        $tax = $mode === 'add' ? round(($subtotal - $discount + ($transportGst ? $transport : 0)) * 0.18, 2) : 0.0;
        $net = round($subtotal - $discount + $tax + $transport);
        // Highest value the amount columns hold
        if (max($subtotal, $net) > 9999999999) {
            throw ValidationException::withMessages(['items' => 'The total is too large. Check the quantities and rates.']);
        }

        $sections = [];
        foreach ($v['sections'] ?? [] as $s) {
            $title = trim((string) ($s['title'] ?? ''));
            $body = trim((string) ($s['body'] ?? ''));
            if ($title === '' && $body === '') {
                continue;
            }
            $sections[] = ['title' => $title, 'style' => $s['style'] ?? 'text', 'body' => $body, 'half' => (bool) ($s['half'] ?? false)];
        }

        $data = [];
        foreach (['client_name', 'client_address', 'client_gstin', 'contact_person', 'mobile_no', 'email', 'location',
            'ref_no', 'prepared_by', 'subject', 'intro', 'payment_terms', 'signatory_name', 'signatory_designation', 'notes'] as $key) {
            $value = trim((string) ($v[$key] ?? ''));
            $data[$key] = $value === '' ? null : $value;
        }
        foreach (['date', 'valid_until', 'ref_date'] as $key) {
            $data[$key] = $v[$key] ?? null;
        }
        if (array_key_exists('inquiry_id', $v)) {
            $data['inquiry_id'] = $v['inquiry_id'];
        }
        $no = trim((string) ($v['quotation_no'] ?? ''));
        $data['quotation_no'] = $no !== '' ? $no : ($quotation?->quotation_no ?? Quotation::nextNumber($company, $data['date']));

        return [$data + [
            'company' => $company,
            'total_amount' => $subtotal,
            'discount' => $discount,
            'gst_mode' => $mode,
            'tax_amount' => $tax,
            'transport' => $transport,
            'transport_gst' => $transportGst,
            'net_amount' => $net,
            'sections' => $sections,
        ], $items];
    }

    public function convertToWorkOrder(Quotation $quotation)
    {
        if ($quotation->status !== 'accepted') {
            return response()->json(['message' => 'Only accepted quotations can be converted to work orders'], 422);
        }

        $template = WorkflowTemplate::where('is_active', true)->first();
        if (!$template) {
            return response()->json(['message' => 'No active workflow template found'], 500);
        }

        return DB::transaction(function () use ($quotation, $template) {
            $workOrder = WorkOrder::create([
                'quotation_id' => $quotation->id,
                'work_order_no' => WorkOrder::generateWorkOrderNo(),
                'client_name' => $quotation->client_name,
                'agency_name' => $quotation->agency_name,
                'date' => now(),
                'total_amount' => $quotation->net_amount,
                'status' => 'active',
                'created_by' => auth()->id(),
            ]);

            $uidNo = $workOrder->work_order_no;
            $job = Jobs::firstOrCreate(
                ['uid_no' => $uidNo],
                [
                    'title' => 'Work Order ' . $uidNo,
                    'priority' => 'normal',
                    'workflow_template_id' => $template->id,
                    'created_by' => auth()->id(),
                    'status' => 'pending',
                ]
            );

            if ($job->wasRecentlyCreated) {
                app(WorkflowEngine::class)->startJob($job, auth()->user());
            }

            $woStage = WorkflowStage::where('template_id', $template->id)
                ->where('slug', 'work-order')->first();
            if ($woStage && $job->current_stage_id !== $woStage->id) {
                $transition = WorkflowTransition::where('template_id', $template->id)
                    ->where('from_stage_id', $job->current_stage_id)
                    ->where('to_stage_id', $woStage->id)
                    ->first();
                if ($transition) {
                    app(WorkflowEngine::class)->transition($job, $transition, auth()->user(), 'Converted from quotation');
                }
            }

            $quotation->update(['status' => 'converted']);

            return response()->json([
                'message' => 'Work order created successfully',
                'work_order' => $workOrder->fresh(),
                'job_id' => $job->id,
            ], 201);
        });
    }

    public function convertToRegistration(Quotation $quotation)
    {
        if (!in_array($quotation->status, ['accepted', 'sent', 'draft'])) {
            return response()->json(['message' => 'Quotation must be in draft, sent or accepted status to convert'], 422);
        }

        return DB::transaction(function () use ($quotation) {
            // Generate UID using the same pattern as RegistrationController
            $year = now()->format('Y');
            $lastSno = (int) DB::table('client_registration')
                ->whereYear('received_date', $year)
                ->max('sno');
            $nextSno = max($lastSno, 0) + 1;
            $uid = sprintf('NAMO/MC/%s/%05d', $year, $nextSno);

            $nextId = ((int) (DB::table('client_registration')->max('iClientId') ?? 0)) + 1;

            // Build sample details from quotation items
            $items = $quotation->items->where('kind', 'item');
            $sampleDetails = $items->pluck('description')->filter()->implode(', ');
            $totalAmount = (float) $quotation->net_amount;

            DB::table('client_registration')->insert([
                'iClientId' => $nextId,
                'sno' => $nextSno,
                'uid_no' => $uid,
                'ulr_no' => '',
                'month' => '',
                'received_date' => now()->format('d/m/Y'),
                'agency_name' => $quotation->client_name ?? '',
                'mobile_no' => $quotation->mobile_no ?? '',
                'reporting_address' => '',
                'name_of_work' => $sampleDetails ?: 'From Quotation ' . $quotation->quotation_no,
                'work' => '',
                'work_order_no' => '',
                'reference' => 'Quotation: ' . $quotation->quotation_no,
                'dist' => '',
                'payment_followup' => '',
                'advance_payment' => '0',
                'balance_dues' => (string) $totalAmount,
                'total_payment' => (string) $totalAmount,
                'financial_remark' => '',
                'mode_of_payment' => '',
                'new_back' => 'new',
                'new_back_1' => '',
                'new_back_2' => '',
                'new_back_3' => '',
                'new_back_4' => '',
                'sample_details' => $sampleDetails ?: 'N/A',
                'sample_details_1' => '',
                'sample_details_2' => '',
                'sample_details_3' => '',
                'sample_details_4' => '',
                'qty_1' => '',
                'qty_2' => '',
                'qty_3' => '',
                'qty_4' => '',
                'sample_test' => '',
                'qty' => '',
                'witness' => '',
                'field_person_name' => '',
                'remark' => 'Converted from quotation ' . $quotation->quotation_no,
                'sample_remark' => '',
                'prepared_date' => '',
                'report_no' => '',
                'dispatch_date' => '',
                'report_status' => '',
                'report_copy' => '',
                'gst_no' => '',
                'sample_nos' => '',
                'scan_copy' => '',
                'scan_copy_1' => '',
                'scan_copy_2' => '',
                'scan_copy_3' => '',
                'scan_copy_4' => '',
                'assign_to' => 'lab',
            ]);

            return response()->json([
                'message' => 'Client registration created successfully',
                'registration_id' => $nextId,
                'uid_no' => $uid,
            ], 201);
        });
    }

    public function printDiv(Quotation $quotation)
    {
        return response()->json($quotation->load(['inquiry', 'items']));
    }
}
