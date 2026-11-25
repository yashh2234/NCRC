<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Performa invoices of NCS LLP; kept apart from the bills, so they never count as invoices. */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('performa_invoices')) {
            return;
        }

        Schema::create('performa_invoices', function (Blueprint $table): void {
            $table->id();
            $table->string('invoice_no', 50)->unique();
            $table->date('invoice_date')->nullable();
            $table->string('uid_no', 100)->nullable();
            $table->date('uid_date')->nullable();
            $table->string('work_order_no', 255)->nullable();
            $table->date('work_order_date')->nullable();
            $table->string('report_no', 255)->nullable();
            $table->date('report_date')->nullable();
            $table->text('terms_of_delivery')->nullable();
            $table->string('client_name', 500)->nullable();
            $table->text('client_address')->nullable();
            $table->string('client_gstin', 50)->nullable();
            $table->longText('items')->nullable();
            // intra = CGST 9% + SGST 9%, inter = IGST 18%
            $table->string('gst_type', 10)->default('intra');
            $table->decimal('subtotal', 14, 2)->default(0);
            $table->decimal('transport', 14, 2)->default(0);
            $table->decimal('cgst', 14, 2)->default(0);
            $table->decimal('sgst', 14, 2)->default(0);
            $table->decimal('igst', 14, 2)->default(0);
            $table->decimal('net_amount', 14, 2)->default(0);
            $table->text('remark')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('performa_invoices');
    }
};
