<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $schema = Schema::getConnection()->getSchemaBuilder();

        if (! Schema::hasTable('invoices')) {
            Schema::create('invoices', function (Blueprint $table): void {
                $table->integer('iInvoiceId', true)->primary();
                $table->date('date');
                $table->string('invoice_no', 222);
                $table->string('work_order_no', 222);
                $table->date('work_order_date');
                $table->string('report_no', 222);
                $table->date('report_date');
                $table->string('agency_name', 222);
                $table->string('reporting_address', 222);
                $table->string('agency_gst', 222);
                $table->string('agency_state', 222);
                $table->string('terms_of_delivery', 222);
                $table->string('total_amount', 222)->default('0');
                $table->string('total_discount', 222)->default('0');
                $table->string('transportation', 222)->default('0');
                $table->string('sgst_amount', 222)->default('0');
                $table->string('cgst_amount', 222)->default('0');
                $table->string('gst_amount', 222)->default('0');
                $table->string('net_amount', 222)->default('0');
                $table->string('advance_amount', 222)->default('0');
                $table->integer('user_id');
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('invoice_list')) {
            Schema::create('invoice_list', function (Blueprint $table): void {
                $table->integer('iIlid', true)->primary();
                $table->integer('iInvoiceId')->index();
                $table->string('description', 222);
                $table->string('unit', 222);
                $table->string('rate', 222)->default('0');
                $table->string('discount', 222)->default('0');
                $table->string('amount', 222)->default('0');
                $table->string('set_count', 222)->default('1');
                $table->dateTime('create_date');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('invoice_list');
        Schema::dropIfExists('invoices');
    }
};
