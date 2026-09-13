<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('purchaseorder')) {
            Schema::create('purchaseorder', function (Blueprint $table): void {
                $table->integer('iPurchaseorderId', true)->primary();
                $table->date('date')->nullable();
                $table->string('purchase_order', 222)->nullable();
                $table->string('agency_name', 222)->nullable();
                $table->string('reporting_address', 222)->nullable();
                $table->string('vendor_ref_no', 222)->nullable();
                $table->date('vendor_ref_date')->nullable();
                $table->string('total_amount', 111)->default('0');
                $table->string('total_discount', 111)->default('0');
                $table->string('transportation', 111)->default('0');
                $table->string('advance_amount', 111)->default('0');
                $table->string('gst_amount', 222)->default('0');
                $table->string('net_amount', 222)->default('0');
                $table->string('remark', 555)->nullable();
                $table->string('user_id', 222)->nullable();
            });
        }

        if (! Schema::hasTable('purchaseorder_list')) {
            Schema::create('purchaseorder_list', function (Blueprint $table): void {
                $table->integer('iPlid', true)->primary();
                $table->integer('iPurchaseorderId')->index();
                $table->string('description', 222)->nullable();
                $table->string('unit', 222)->nullable();
                $table->string('rate', 222)->default('0');
                $table->string('discount', 222)->default('0');
                $table->string('amount', 222)->default('0');
                $table->string('set_count', 222)->default('1');
                $table->dateTime('create_date')->nullable();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('purchaseorder_list');
        Schema::dropIfExists('purchaseorder');
    }
};
