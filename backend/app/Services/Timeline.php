<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * The history of a record (created, edited with what changed, sent for approval, approved, payments, cancelled…),
 * kept in audit_logs (model_type + model_id) and shown by the History button of each list.
 * The UID and lab report timelines read the same rows (types Registration and Report).
 */
class Timeline
{
    /**
     * Each kind of record: the feature it belongs to (who may see it), how a record is named,
     * and the fields that are worth showing, with their labels. Other columns are not shown.
     */
    public const TYPES = [
        'Inquiry' => ['module' => 'inquiries', 'name' => 'Enquiry', 'no' => 'inquiry_no', 'fields' => [
            'client_name' => 'Client', 'contact_person' => 'Contact person', 'mobile_no' => 'Number', 'email' => 'Email', 'source' => 'Source',
            'scope_of_work' => 'Scope of work', 'source_location' => 'Location', 'budget' => 'Budget', 'priority' => 'Priority', 'status' => 'Status',
            'next_follow_up' => 'Next follow-up', 'assigned_to' => 'Handed over to', 'notes' => 'Notes',
        ]],
        'Proposal' => ['module' => 'proposals', 'name' => 'Proposal', 'no' => 'ref_no', 'fields' => [
            'ref_no' => 'Ref. No.', 'proposal_date' => 'Date', 'title' => 'Title', 'project_name' => 'Project', 'submitted_to' => 'Submitted to',
            'sections' => 'Text', 'fee_rows' => 'Fees', 'signatory_name' => 'Signatory',
        ]],
        'Quotation' => ['module' => 'quotations', 'name' => 'Quotation', 'no' => 'quotation_no', 'fields' => [
            'quotation_no' => 'Quotation No.', 'date' => 'Date', 'valid_until' => 'Valid till', 'client_name' => 'Client', 'subject' => 'Subject',
            'discount' => 'Discount', 'transport' => 'Transport', 'net_amount' => 'Total', 'payment_terms' => 'Payment terms', 'status' => 'Status',
            'sections' => 'Terms / sections', 'approval' => 'Approval', 'admin_remark' => 'Admin remark',
        ]],
        'Tender' => ['module' => 'tenders', 'name' => 'Tender', 'no' => 'sr_no', 'fields' => [
            'tender_id' => 'Tender ID', 'title' => 'Title', 'department' => 'Department', 'value' => 'Value', 'bid_value' => 'Bid value',
            'emd' => 'EMD', 'emd_deposited' => 'EMD deposited', 'closing_date' => 'Closing date', 'opening_date' => 'Opening date',
            'decision' => 'Decision', 'submission_status' => 'Submission status', 'responsible' => 'Responsible', 'remarks' => 'Remarks',
        ]],
        'WorkOrder' => ['module' => 'work_orders', 'name' => 'Work order', 'no' => 'work_order_no', 'fields' => [
            'work_order_no' => 'Work order No.', 'client_name' => 'Client', 'scope_of_work' => 'Scope', 'total_amount' => 'Total',
            'advance_payment' => 'Advance', 'balance_dues' => 'Balance', 'status' => 'Status', 'priority' => 'Priority', 'due_date' => 'Due date',
        ]],
        'Bill' => ['module' => 'billing', 'name' => 'Invoice', 'no' => 'invoice_no', 'fields' => [
            'invoice_no' => 'Invoice No.', 'invoice_date' => 'Date', 'uid_no' => 'UID', 'client_name' => 'Client', 'client_gstin' => 'GSTIN',
            'items' => 'Particulars', 'gst_type' => 'GST', 'transport' => 'Transport', 'advance' => 'Advance', 'net_amount' => 'Net due',
            'amount_received' => 'Amount received', 'received_date' => 'Received date', 'payment_mode' => 'Payment mode', 'remark' => 'Remark',
            'credit_note_no' => 'Credit note No.', 'credit_amount' => 'Credit amount',
        ]],
        'PerformaInvoice' => ['module' => 'performa', 'name' => 'Performa invoice', 'no' => 'invoice_no', 'fields' => [
            'invoice_no' => 'Performa No.', 'invoice_date' => 'Date', 'uid_no' => 'UID', 'client_name' => 'Client', 'items' => 'Particulars',
            'gst_type' => 'GST', 'transport' => 'Transport', 'net_amount' => 'Net amount', 'remark' => 'Remark',
        ]],
        'PurchaseOrder' => ['module' => 'purchase_orders', 'name' => 'Purchase order', 'no' => 'purchase_order', 'fields' => [
            'purchase_order' => 'PO No.', 'date' => 'Date', 'agency_name' => 'Vendor', 'vendor_ref_no' => 'Vendor ref.', 'total_amount' => 'Total',
            'total_discount' => 'Discount', 'transportation' => 'Transport', 'advance_amount' => 'Advance', 'gst_amount' => 'GST', 'net_amount' => 'Net amount', 'remark' => 'Remark',
        ]],
        'DailyExpense' => ['module' => 'expenses', 'name' => 'Expense entry', 'no' => 'date', 'fields' => [
            'date' => 'Date', 'expenses_category' => 'Category', 'total_income' => 'Income', 'total_expenses' => 'Expense', 'payment_mode' => 'Payment mode',
            'person_name' => 'Person', 'remark' => 'Remark', 'expenses_remark' => 'Details',
        ]],
        'Registration' => ['module' => 'registrations', 'name' => 'Registration', 'no' => 'uid_no', 'fields' => [
            'uid_no' => 'UID', 'received_date' => 'Received', 'agency_name' => 'Agency', 'mobile_no' => 'Mobile', 'name_of_work' => 'Name of work',
            'work_order_no' => 'Work order', 'sample_details' => 'Sample details', 'qty' => 'Qty', 'total_payment' => 'Total payment',
            'advance_payment' => 'Advance', 'balance_dues' => 'Dues', 'mode_of_payment' => 'Payment mode', 'payment_status' => 'Payment status',
            'report_status' => 'Report status', 'current_stage' => 'Stage', 'currently_with' => 'With', 'priority' => 'Priority',
            'target_date' => 'Target date', 'dispatch_date' => 'Dispatch date', 'remark' => 'Remark',
        ]],
        'Report' => ['module' => 'reports', 'name' => 'Lab report', 'no' => 'uid_no', 'fields' => [
            'ulr_no' => 'ULR No.', 'customer_details' => 'Customer', 'agency_name' => 'Agency', 'reference_no' => 'Reference', 'material_details' => 'Material',
            'work_order_no' => 'Work order', 'sample_date' => 'Sample date', 'sample_tested_date' => 'Tested date', 'dispatch_date' => 'Dispatch date',
            'status' => 'Status', 'assigned_to' => 'Assigned to', 'lab_data' => 'Test results', 'cancel_remark' => 'Cancel remark',
        ]],
        'UlrLink' => ['module' => 'ulr_register', 'name' => 'ULR', 'no' => 'ulr_no', 'fields' => [
            'uid_no' => 'UID', 'ulr_no' => 'ULR No.', 'date' => 'Date', 'name_of_department' => 'Department', 'name_of_agency' => 'Agency',
            'name_of_project' => 'Project', 'sample_details' => 'Samples', 'qty' => 'Qty', 'report_dispatch_date' => 'Dispatch date', 'bill_details' => 'Bill',
        ]],
        'OutsourceAssignment' => ['module' => 'outsource', 'name' => 'Outsource job', 'no' => 'party_name', 'fields' => [
            'vendor_id' => 'Vendor', 'party_name' => 'Party', 'scope_of_work' => 'Scope', 'agreed_amount' => 'Agreed amount', 'advance_payment' => 'Advance',
            'payment_status' => 'Payment status', 'payment_amount' => 'Paid', 'payment_date' => 'Payment date', 'status' => 'Status',
            'delivery_date' => 'Delivery date', 'completion_details' => 'Completion', 'notes' => 'Notes',
        ]],
        'Vendor' => ['module' => 'outsource', 'name' => 'Vendor', 'no' => 'vendor_name', 'fields' => [
            'vendor_name' => 'Name', 'contact_person' => 'Contact', 'mobile' => 'Mobile', 'email' => 'Email', 'city' => 'City', 'gst_no' => 'GST No.',
            'services_offered' => 'Services', 'is_active' => 'Active', 'approval_status' => 'Approval',
        ]],
    ];

    /** Shown as money (₹) */
    private const MONEY = ['budget', 'discount', 'transport', 'net_amount', 'value', 'bid_value', 'emd', 'total_amount', 'advance_payment', 'balance_dues',
        'advance', 'amount_received', 'credit_amount', 'total_discount', 'transportation', 'advance_amount', 'gst_amount', 'total_income',
        'total_expenses', 'total_payment', 'agreed_amount', 'payment_amount'];

    /** Names of user ids */
    private const USERS = ['assigned_to', 'responsible', 'currently_with'];

    /** A step or a change of a record. $changes: [[label, before, after], …] */
    public static function log(string $type, int|string|null $id, string $action, string $description, array $changes = []): void
    {
        if ($id === null || $id === '' || ! isset(self::TYPES[$type])) {
            return;
        }
        try {
            AuditLog::query()->create([
                'user_id' => auth()->id(),
                'action' => $action,
                'model_type' => $type,
                'model_id' => (int) $id,
                'description' => mb_substr($description, 0, 250),
                'old_values' => $changes ? array_map(fn ($c) => [$c[0], $c[1]], $changes) : null,
                'new_values' => $changes ? array_map(fn ($c) => [$c[0], $c[2]], $changes) : null,
                'ip_address' => request()?->ip(),
                'user_agent' => mb_substr((string) request()?->userAgent(), 0, 250),
                'created_at' => now(),
            ]);
        } catch (\Throwable) {
            // The history must never stop the saving itself
        }
    }

    // ─── From the models (trait RecordsTimeline) ──────────────────────────

    public static function created(Model $m, string $type): void
    {
        self::log($type, $m->getKey(), 'created', 'Created'.self::number($m, $type));
    }

    public static function deleted(Model $m, string $type): void
    {
        self::log($type, $m->getKey(), 'deleted', 'Deleted'.self::number($m, $type));
    }

    /** An edit: the steps it means (approval, payment, cancel…) and the fields that changed */
    public static function updated(Model $m, string $type): void
    {
        $before = [];
        foreach (array_keys($m->getChanges()) as $key) {
            $before[$key] = $m->getRawOriginal($key);
        }
        self::changed($type, $m->getKey(), $before, $m->getAttributes());
    }

    /** Also for tables saved without a model (registrations, expenses): rows before and after */
    public static function changed(string $type, int|string|null $id, array $before, array $after): void
    {
        $steps = [];
        $fields = self::TYPES[$type]['fields'] ?? [];

        foreach (['' => '', 'cn_' => 'Credit note '] as $prefix => $what) {
            $key = $prefix.'approval';
            if (array_key_exists($key, $before) && ($before[$key] ?? null) !== ($after[$key] ?? null)) {
                $remark = trim((string) ($after[$prefix.'approval_remark'] ?? ''));
                $steps[] = match ($after[$key] ?? null) {
                    'pending' => ['approval', $what.'Sent for approval'],
                    'approved' => ['approved', $what.'Approved'],
                    'returned' => ['sent_back', $what.'Sent back'.($remark !== '' ? ': '.$remark : '')],
                    default => null,
                };
            }
        }
        if (array_key_exists('cancelled_at', $before) && (bool) ($before['cancelled_at'] ?? null) !== (bool) ($after['cancelled_at'] ?? null)) {
            $steps[] = ($after['cancelled_at'] ?? null)
                ? ['cancelled', 'Cancelled'.(($after['cancel_reason'] ?? '') !== '' ? ': '.$after['cancel_reason'] : '')]
                : ['restored', 'Cancel undone'];
        }
        if (array_key_exists('amount_received', $before) && (float) ($before['amount_received'] ?? 0) !== (float) ($after['amount_received'] ?? 0)) {
            $how = array_filter([
                ($after['received_date'] ?? null) ? 'on '.self::show('received_date', $after['received_date']) : null,
                ($after['payment_mode'] ?? '') !== '' ? 'by '.$after['payment_mode'] : null,
            ]);
            $steps[] = ['payment', 'Payment received: '.self::show('amount_received', $before['amount_received'] ?? 0).' → '.self::show('amount_received', $after['amount_received'] ?? 0)
                .($how ? ' ('.implode(', ', $how).')' : '')];
            $paid = true;
        }
        if ($type === 'Report' && array_key_exists('status', $before) && ($before['status'] ?? null) !== ($after['status'] ?? null)) {
            $steps[] = ['status', 'Status: '.($before['status'] ?: '-').' → '.($after['status'] ?: '-')];
        }
        $steps = array_values(array_filter($steps));

        // Fields worth showing; what a step already says is not repeated
        $said = ['approval', 'cn_approval', 'amount_received', $type === 'Report' ? 'status' : ''];
        if (! empty($paid)) {
            // Said with the payment
            array_push($said, 'received_date', 'payment_mode');
        }
        $changes = [];
        foreach ($fields as $key => $label) {
            if (! array_key_exists($key, $before) || in_array($key, $said, true)) {
                continue;
            }
            [$rawA, $rawB] = [self::plain($before[$key] ?? null), self::plain($after[$key] ?? null)];
            if ($rawA === $rawB) {
                continue;
            }
            [$a, $b] = [self::show($key, $before[$key] ?? null), self::show($key, $after[$key] ?? null)];
            // A list with as many entries as before: say it was changed
            $changes[] = [$label, $a, $a === $b ? $b.' (changed)' : $b];
        }

        foreach ($steps as [$action, $text]) {
            self::log($type, $id, $action, $text);
        }
        if ($changes) {
            self::log($type, $id, 'updated', 'Edited: '.implode(', ', array_column($changes, 0)), $changes);
        }
    }

    // ─── For the History panel ──────────────────────────────────────────

    public static function entries(string $type, int $id): array
    {
        return AuditLog::query()->with('user')->where('model_type', $type)->where('model_id', $id)
            ->orderByDesc('created_at')->orderByDesc('id')->limit(200)->get()
            ->map(fn (AuditLog $log) => [
                'id' => $log->id,
                'action' => $log->action,
                'event' => $log->description ?: $log->action,
                'timestamp' => $log->created_at?->toIso8601String(),
                'user' => $log->user?->name,
                'changes' => collect($log->new_values ?? [])->map(fn ($new, $i) => [
                    'label' => $new[0] ?? '',
                    'from' => $log->old_values[$i][1] ?? '',
                    'to' => $new[1] ?? '',
                ])->values(),
            ])->all();
    }

    public static function canSee(User $user, string $type): bool
    {
        if (! isset(self::TYPES[$type])) {
            return false;
        }
        $modules = $user->allowed_modules;
        // No list: the job role decides on the screens; everything the menu shows may be seen
        return $user->isFullAdmin() || ! is_array($modules) || in_array(self::TYPES[$type]['module'], $modules, true);
    }

    // ─── Values as people read them ─────────────────────────────────────

    private static function number(Model $m, string $type): string
    {
        $no = $m->getAttribute(self::TYPES[$type]['no'] ?? '');

        return $no ? ' · '.self::show(self::TYPES[$type]['no'], $no) : '';
    }

    /** For comparing: JSON text and arrays alike, numbers as numbers (12 = 12.00) */
    private static function plain(mixed $value): string
    {
        if (is_string($value) && $value !== '' && in_array($value[0], ['[', '{'], true)) {
            $decoded = json_decode($value, true);
            if (is_array($decoded)) {
                $value = $decoded;
            }
        }
        if (is_array($value)) {
            return (string) json_encode($value);
        }
        if (is_numeric($value)) {
            return (string) (0 + $value);
        }

        return trim((string) ($value ?? ''));
    }

    private static function show(string $key, mixed $value): string
    {
        if ($value === null || $value === '' || $value === []) {
            return '-';
        }
        if (is_string($value) && ($value[0] ?? '') !== '' && in_array($value[0], ['[', '{'], true)) {
            $decoded = json_decode($value, true);
            if (is_array($decoded)) {
                $value = $decoded;
            }
        }
        if (is_array($value)) {
            // Lists (particulars, sections, results): how many, not every value
            return count($value).' '.(count($value) === 1 ? 'entry' : 'entries');
        }
        if (is_bool($value)) {
            return $value ? 'Yes' : 'No';
        }
        if (in_array($key, self::MONEY, true) && is_numeric($value)) {
            return '₹'.number_format((float) $value, 2);
        }
        if (in_array($key, self::USERS, true) && is_numeric($value)) {
            return User::query()->find((int) $value)?->name ?? (string) $value;
        }
        if (is_string($value) && preg_match('/^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}(:\d{2})?)?$|^\d{4}-\d{2}-\d{2}T/', $value)) {
            try {
                $date = Carbon::parse($value);

                return str_contains($value, ':') && $date->format('H:i') !== '00:00' ? $date->format('d-m-Y H:i') : $date->format('d-m-Y');
            } catch (\Throwable) {
                // not a date after all
            }
        }

        return mb_strimwidth(trim((string) $value), 0, 200, '…');
    }
}
