<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('client_registration', function (Blueprint $table) {
            if (!Schema::hasColumn('client_registration', 'current_stage')) {
                $table->string('current_stage')->default('1. Registered')->after('report_status');
            }
            if (!Schema::hasColumn('client_registration', 'currently_with')) {
                $table->string('currently_with')->nullable()->after('current_stage');
            }
            if (!Schema::hasColumn('client_registration', 'priority')) {
                $table->string('priority')->default('Medium')->after('currently_with');
            }
            if (!Schema::hasColumn('client_registration', 'target_date')) {
                $table->date('target_date')->nullable()->after('priority');
            }
            if (!Schema::hasColumn('client_registration', 'payment_status')) {
                $table->string('payment_status')->default('Not Invoiced')->after('target_date');
            }
        });

        if (!Schema::hasTable('stage_logs')) {
            Schema::create('stage_logs', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('registration_id');
                $table->string('uid_no')->nullable();
                $table->string('stage_set');
                $table->string('from_person')->nullable();
                $table->string('to_person')->nullable();
                $table->text('note')->nullable();
                $table->timestamps();

                $table->index('registration_id');
                $table->index('uid_no');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('stage_logs');

        Schema::table('client_registration', function (Blueprint $table) {
            $columns = ['current_stage', 'currently_with', 'priority', 'target_date', 'payment_status'];
            foreach ($columns as $col) {
                if (Schema::hasColumn('client_registration', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
