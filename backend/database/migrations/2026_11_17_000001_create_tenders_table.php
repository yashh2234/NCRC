<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tender tracker entries. Previously kept only in each browser's localStorage,
 * so tenders entered by one user were invisible to everyone else.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('tenders')) {
            return;
        }

        Schema::create('tenders', function (Blueprint $table): void {
            $table->id();
            $table->string('sr_no', 50)->unique();
            $table->string('tender_id')->default('');
            $table->text('title');
            $table->string('department')->default('');
            $table->string('portal')->default('');
            $table->string('location')->default('');
            $table->string('value', 100)->default('');
            $table->string('emd', 100)->default('');
            $table->string('fee', 100)->default('');
            $table->string('open_date', 10)->default('');
            $table->string('pre_bid_date', 10)->default('');
            $table->string('query_date', 10)->default('');
            $table->string('closing_date', 10)->default('');
            $table->string('opening_date', 10)->default('');
            $table->string('eligibility', 50)->default('');
            $table->string('decision', 50)->default('');
            $table->string('submission_status', 50)->default('');
            $table->string('responsible')->default('');
            $table->text('requirements')->nullable();
            $table->text('tender_link')->nullable();
            $table->text('drive_link')->nullable();
            $table->text('remarks')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tenders');
    }
};
