<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Quotations made or changed by a user wait for approval; those that exist already count as approved. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('quotations', function (Blueprint $table): void {
            if (Schema::hasColumn('quotations', 'approval')) {
                return;
            }
            // approved, pending (waiting), returned (sent back with a remark)
            $table->string('approval', 12)->default('approved');
            $table->text('approval_remark')->nullable();
            $table->unsignedBigInteger('approval_by')->nullable();
            $table->timestamp('approval_at')->nullable();
            $table->unsignedBigInteger('approval_requested_by')->nullable();
            $table->timestamp('approval_requested_at')->nullable();
            // What it looked like when it was last approved, to show what changed
            $table->longText('approved_content')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('quotations', function (Blueprint $table): void {
            $table->dropColumn(['approval', 'approval_remark', 'approval_by', 'approval_at', 'approval_requested_by', 'approval_requested_at', 'approved_content']);
        });
    }
};
