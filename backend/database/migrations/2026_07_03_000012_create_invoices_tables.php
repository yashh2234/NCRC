<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('invoices')) {
            Schema::create('invoices', function (Blueprint $table): void {
                $table->bigInteger('iInvoiceId', true);
                $table->date('date')->nullable();
                $table->string('invoice_no', 222)->nullable();
                $table->string('work_order_no', 222)->nullable();
                $table->date('work_order_date')->nullable();
                $table->string('report_no', 222)->nullable();
                $table->date('report_date')->nullable();
                $table->string('agency_name', 222)->nullable();
                $table->string('reporting_address', 222)->nullable();
                $table->string('agency_gst', 222)->nullable();
                $table->string('agency_state', 222)->nullable();
                $table->string('terms_of_delivery', 222)->nullable();
                $table->string('total_amount', 222)->default('0');
                $table->string('total_discount', 222)->default('0');
                $table->string('transportation', 222)->default('0');
                $table->string('sgst_amount', 222)->default('0');
                $table->string('cgst_amount', 222)->default('0');
                $table->string('gst_amount', 222)->default('0');
                $table->string('net_amount', 222)->default('0');
                $table->string('advance_amount', 222)->default('0');
                $table->unsignedBigInteger('user_id')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('invoice_list')) {
            Schema::create('invoice_list', function (Blueprint $table): void {
                $table->bigInteger('iIlid', true);
                $table->bigInteger('iInvoiceId');
                $table->string('description', 222)->nullable();
                $table->string('unit', 222)->nullable();
                $table->string('rate', 222)->default('0');
                $table->string('discount', 222)->default('0');
                $table->string('amount', 222)->default('0');
                $table->string('set_count', 222)->nullable();
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('invoice_list');
        Schema::dropIfExists('invoices');
    }
};
