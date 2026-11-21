<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Client proposals printed on the Namotech letterhead. The text lives in `sections`
 * (JSON list of {heading, body, fee}); the fee table rows live in `fee_rows`.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('proposals')) {
            return;
        }

        Schema::create('proposals', function (Blueprint $table): void {
            $table->id();
            $table->string('ref_no', 100)->nullable();
            $table->date('proposal_date')->nullable();
            $table->string('title', 500);
            $table->string('project_name', 500)->nullable();
            $table->text('submitted_to')->nullable();
            $table->longText('sections')->nullable();
            $table->longText('fee_rows')->nullable();
            $table->string('fee_note', 500)->nullable();
            $table->text('supporting_info')->nullable();
            $table->string('signatory_name', 150)->nullable();
            $table->string('signatory_designation', 150)->nullable();
            $table->longText('brief')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('proposals');
    }
};
