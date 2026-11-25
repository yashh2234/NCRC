<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tender PDFs read in the background (tender_analyses), and on tenders: the closing time, the contact person
 * on the client's side and the ticked documents of the summary's checklist.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tenders', function (Blueprint $table): void {
            if (! Schema::hasColumn('tenders', 'closing_time')) {
                $table->string('closing_time', 5)->default('')->after('closing_date');
            }
            if (! Schema::hasColumn('tenders', 'contact_name')) {
                $table->string('contact_name')->default('')->after('department');
                $table->string('contact_designation')->default('')->after('contact_name');
                $table->string('contact_phone', 100)->default('')->after('contact_designation');
            }
            if (! Schema::hasColumn('tenders', 'document_checks')) {
                $table->longText('document_checks')->nullable();
            }
        });

        if (Schema::hasTable('tender_analyses')) {
            return;
        }

        Schema::create('tender_analyses', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('user_id')->index();
            // Empty until the tender made from this PDF is saved
            $table->unsignedBigInteger('tender_id')->nullable()->index();
            $table->string('file_name');
            $table->string('status', 20)->default('queued')->index();
            $table->unsignedTinyInteger('attempts')->default(0);
            $table->string('error', 500)->nullable();
            $table->string('model', 100)->nullable();
            $table->longText('summary')->nullable();
            $table->longText('fields')->nullable();
            $table->timestamp('next_try_at')->nullable();
            $table->timestamp('finished_at')->nullable();
            // Saved, opened or dismissed: no longer shown to the user
            $table->timestamp('closed_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tender_analyses');
        Schema::table('tenders', function (Blueprint $table): void {
            $table->dropColumn(['closing_time', 'contact_name', 'contact_designation', 'contact_phone', 'document_checks']);
        });
    }
};
