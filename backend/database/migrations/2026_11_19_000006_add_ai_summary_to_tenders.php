<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** AI summary of the tender document (JSON), with when / from which file / by whom. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tenders', function (Blueprint $table): void {
            if (! Schema::hasColumn('tenders', 'ai_summary')) {
                $table->longText('ai_summary')->nullable();
                $table->string('ai_summary_file')->nullable();
                $table->string('ai_summary_model', 100)->nullable();
                $table->timestamp('ai_summary_at')->nullable();
                $table->unsignedBigInteger('ai_summary_by')->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('tenders', function (Blueprint $table): void {
            $table->dropColumn(['ai_summary', 'ai_summary_file', 'ai_summary_model', 'ai_summary_at', 'ai_summary_by']);
        });
    }
};
