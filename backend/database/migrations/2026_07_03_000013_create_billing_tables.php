<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('billing')) {
            Schema::create('billing', function (Blueprint $table): void {
                $table->bigInteger('id', true);
                $table->string('uid_no', 222)->nullable();
                $table->string('bill_no', 222)->nullable();
                $table->string('bill_amount', 222)->default('0');
                $table->string('advance_amount', 222)->default('0');
                $table->string('mode_of_payment', 222)->nullable();
                $table->string('amount_received', 222)->default('0');
                $table->string('amount_received_date', 222)->nullable();
                $table->string('due_amount', 222)->default('0');
                $table->string('discount', 222)->default('0');
                $table->string('payment_followup', 222)->nullable();
                $table->string('remark', 222)->nullable();
                $table->timestamp('created_date')->useCurrent();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('sms_reminder_log')) {
            Schema::create('sms_reminder_log', function (Blueprint $table): void {
                $table->bigInteger('id', true);
                $table->bigInteger('iClientId');
                $table->date('sent_date');
                $table->string('balance_amount', 222)->nullable();
                $table->string('advance_amount', 222)->nullable();
                $table->string('total_amount', 222)->nullable();
                $table->timestamps();
            });
        }

        $schema = Schema::getConnection()->getSchemaBuilder();
        if ($schema->hasColumn('client_registration', 'financial_remark') && ! $schema->hasColumn('client_registration', 'mode_of_payment')) {
            // already has financial_remark
        }
        if (! $schema->hasColumn('client_registration', 'mode_of_payment')) {
            Schema::table('client_registration', function (Blueprint $table): void {
                $table->string('mode_of_payment', 222)->nullable()->after('financial_remark');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('sms_reminder_log');
        Schema::dropIfExists('billing');
    }
};
