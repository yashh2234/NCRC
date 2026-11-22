<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Client bills (invoices) in the two company formats from the Excel sheets:
 * 'ncrc' = Namotech Consultancy and Research Centre Pvt Ltd (no GST),
 * 'ncs'  = Namotech Consultancy Services LLP (tax invoice with GST).
 * Line items live in `items` (JSON list of {description, qty, hsn, rate, discount, amount}).
 * Every field except company is optional so a bill can be left blank where the Excel was blank.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('bills')) {
            return;
        }

        Schema::create('bills', function (Blueprint $table): void {
            $table->id();
            $table->string('company', 10)->index();
            $table->string('invoice_no', 50)->nullable()->index();
            $table->date('invoice_date')->nullable();
            $table->string('uid_no', 100)->nullable()->index();
            $table->date('uid_date')->nullable();
            $table->string('work_order_no', 255)->nullable();
            $table->date('work_order_date')->nullable();
            $table->string('report_no', 255)->nullable();
            $table->date('report_date')->nullable();
            $table->string('sac_code', 20)->nullable();
            $table->text('terms_of_delivery')->nullable();
            $table->string('client_name', 500)->nullable();
            $table->text('client_address')->nullable();
            $table->string('client_gstin', 50)->nullable();
            $table->longText('items')->nullable();
            $table->string('gst_type', 10)->default('none');
            $table->decimal('subtotal', 14, 2)->default(0);
            $table->decimal('transport', 14, 2)->default(0);
            $table->decimal('cgst', 14, 2)->default(0);
            $table->decimal('sgst', 14, 2)->default(0);
            $table->decimal('igst', 14, 2)->default(0);
            $table->decimal('advance', 14, 2)->default(0);
            $table->decimal('net_amount', 14, 2)->default(0);
            $table->decimal('amount_received', 14, 2)->default(0);
            $table->date('received_date')->nullable();
            $table->string('payment_mode', 100)->nullable();
            $table->text('remark')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bills');
    }
};
