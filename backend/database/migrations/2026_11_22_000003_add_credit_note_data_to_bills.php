<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A credit note keeps its own copy of the document (client, references, particulars, amounts),
 * pre-filled from the invoice and editable without changing the invoice.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('bills', 'credit_note_data')) {
            return;
        }

        Schema::table('bills', function (Blueprint $table): void {
            $table->longText('credit_note_data')->nullable()->after('credit_note_date');
            $table->decimal('credit_amount', 14, 2)->default(0)->after('credit_note_data');
        });
    }

    public function down(): void
    {
        Schema::table('bills', function (Blueprint $table): void {
            $table->dropColumn(['credit_note_data', 'credit_amount']);
        });
    }
};
