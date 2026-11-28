<?php

namespace App\Services;

use App\Models\Bill;
use App\Models\Client;
use App\Models\Inquiry;
use App\Models\Proposal;
use App\Models\PurchaseOrder;
use App\Models\Quotation;
use App\Models\Tender;
use App\Models\WorkOrder;

/**
 * Admins are told when new work comes into the office. Hooked to the models, so a record made anywhere
 * (a form, or a quotation turned into a work order) is told once. Only what a signed-in user does counts:
 * imports and scheduled jobs do not send these.
 * Registrations and expenses are saved without their models: their controllers call AdminAlert themselves.
 */
class AdminActivity
{
    public static function register(): void
    {
        self::created(Inquiry::class, 'inquiries', fn (Inquiry $m) => ["New enquiry {$m->inquiry_no}", self::line([$m->client_name, $m->mobile_no, $m->source])]);
        self::created(WorkOrder::class, 'work_orders', fn (WorkOrder $m) => ["New work order {$m->work_order_no}", self::line([$m->client_name, $m->total_amount ? '₹'.number_format((float) $m->total_amount) : null])]);
        self::created(Tender::class, 'tenders', fn (Tender $m) => ['New tender'.($m->tender_id ? " {$m->tender_id}" : ''), self::line([$m->title, $m->department])]);
        self::created(Proposal::class, 'proposals', fn (Proposal $m) => ['New proposal'.($m->ref_no ? " {$m->ref_no}" : ''), self::line([$m->title, $m->submitted_to])]);
        self::created(PurchaseOrder::class, 'purchase_orders', fn (PurchaseOrder $m) => ['New purchase order'.($m->purchase_order ? " {$m->purchase_order}" : ''), self::line([$m->agency_name, $m->net_amount ? '₹'.number_format((float) $m->net_amount) : null])]);
        self::created(Client::class, 'clients', fn (Client $m) => ['New client', self::line([$m->company_name, $m->contact_person, $m->city])]);

        // Quotation sent / accepted / rejected
        Quotation::updated(function (Quotation $q): void {
            if (! auth()->check() || ! $q->wasChanged('status') || ! in_array($q->status, ['sent', 'accepted', 'rejected'], true)) {
                return;
            }
            AdminAlert::send('activity_quotations', "Quotation {$q->quotation_no} ".$q->status,
                self::line([$q->client_name, $q->net_amount ? '₹'.number_format((float) $q->net_amount) : null, 'by '.AdminAlert::who()]), ['quotation_id' => $q->id]);
        });

        // Invoice cancelled (a credit note made for it shows in the message)
        Bill::updated(function (Bill $b): void {
            if (! auth()->check() || ! $b->wasChanged('cancelled_at') || ! $b->cancelled_at) {
                return;
            }
            AdminAlert::send('activity_billing', "Invoice {$b->invoice_no} cancelled",
                self::line([$b->client_name, $b->credit_note_no ? "credit note {$b->credit_note_no}" : null, $b->cancel_reason, 'by '.AdminAlert::who()]), ['bill_id' => $b->id]);
        });
    }

    /** @param  class-string  $model */
    private static function created(string $model, string $page, \Closure $text): void
    {
        $model::created(function ($m) use ($page, $text): void {
            if (! auth()->check()) {
                return;
            }
            [$title, $message] = $text($m);
            AdminAlert::send('activity_'.$page, $title, self::line([$message, 'by '.AdminAlert::who()]), ['id' => $m->getKey()]);
        });
    }

    /** The parts that are filled, joined with " · " */
    public static function line(array $parts): string
    {
        return implode(' · ', array_filter(array_map(fn ($p) => trim((string) $p), $parts), fn ($p) => $p !== ''));
    }
}
