<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A bill can be cancelled; a cancelled bill can carry one credit note
 * (number typed by hand, e.g. "2025-26/CN-01").
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('bills', 'cancelled_at')) {
            return;
        }

        Schema::table('bills', function (Blueprint $table): void {
            $table->date('cancelled_at')->nullable()->after('remark');
            $table->text('cancel_reason')->nullable()->after('cancelled_at');
            $table->string('credit_note_no', 50)->nullable()->after('cancel_reason');
            $table->date('credit_note_date')->nullable()->after('credit_note_no');
        });
    }

    public function down(): void
    {
        Schema::table('bills', function (Blueprint $table): void {
            $table->dropColumn(['cancelled_at', 'cancel_reason', 'credit_note_no', 'credit_note_date']);
        });
    }
};
