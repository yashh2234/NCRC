<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Quotations in the NCS LLP print format: subject, transport, sections (deliverables, terms …),
 * signatory, and a grey sub-description / "Included" flag on each item.
 * gst_mode: 'add' = GST @ 18% added, 'extra' = "Extra, as applicable", 'none' = no GST line.
 */
return new class extends Migration
{
    private const QUOTATION_COLUMNS = [
        'client_address', 'client_gstin', 'subject', 'intro', 'ref_no', 'ref_date', 'prepared_by',
        'gst_mode', 'transport', 'payment_terms', 'sections', 'signatory_name', 'signatory_designation', 'updated_by',
    ];

    public function up(): void
    {
        $add = function (string $table, string $column, callable $define): void {
            if (! Schema::hasColumn($table, $column)) {
                Schema::table($table, function (Blueprint $t) use ($define): void {
                    $define($t);
                });
            }
        };

        $add('quotations', 'client_address', fn (Blueprint $t) => $t->text('client_address')->nullable());
        $add('quotations', 'client_gstin', fn (Blueprint $t) => $t->string('client_gstin', 50)->nullable());
        $add('quotations', 'subject', fn (Blueprint $t) => $t->text('subject')->nullable());
        $add('quotations', 'intro', fn (Blueprint $t) => $t->text('intro')->nullable());
        $add('quotations', 'ref_no', fn (Blueprint $t) => $t->string('ref_no', 255)->nullable());
        $add('quotations', 'ref_date', fn (Blueprint $t) => $t->date('ref_date')->nullable());
        $add('quotations', 'prepared_by', fn (Blueprint $t) => $t->string('prepared_by', 222)->nullable());
        if (! Schema::hasColumn('quotations', 'gst_mode')) {
            Schema::table('quotations', function (Blueprint $t): void {
                $t->string('gst_mode', 10)->default('add');
            });
            // Quotations saved without tax keep the total they were saved with
            DB::table('quotations')->where('tax_amount', 0)->update(['gst_mode' => 'none']);
        }
        $add('quotations', 'transport', fn (Blueprint $t) => $t->decimal('transport', 12, 2)->default(0));
        $add('quotations', 'payment_terms', fn (Blueprint $t) => $t->text('payment_terms')->nullable());
        $add('quotations', 'sections', fn (Blueprint $t) => $t->longText('sections')->nullable());
        $add('quotations', 'signatory_name', fn (Blueprint $t) => $t->string('signatory_name', 222)->nullable());
        $add('quotations', 'signatory_designation', fn (Blueprint $t) => $t->string('signatory_designation', 222)->nullable());
        $add('quotations', 'updated_by', fn (Blueprint $t) => $t->unsignedBigInteger('updated_by')->nullable());

        $add('quotation_items', 'details', fn (Blueprint $t) => $t->text('details')->nullable());
        $add('quotation_items', 'included', fn (Blueprint $t) => $t->boolean('included')->default(false));
    }

    public function down(): void
    {
        Schema::table('quotations', function (Blueprint $t): void {
            $t->dropColumn(self::QUOTATION_COLUMNS);
        });
        Schema::table('quotation_items', function (Blueprint $t): void {
            $t->dropColumn(['details', 'included']);
        });
    }
};
