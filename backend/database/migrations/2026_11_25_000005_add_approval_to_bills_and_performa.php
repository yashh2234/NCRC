<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Invoices, credit notes (kept on their invoice: cn_*) and performa invoices made or changed by a user
 * wait for approval; those that exist already count as approved.
 */
return new class extends Migration
{
    private const SETS = ['bills' => ['', 'cn_'], 'performa_invoices' => ['']];

    public function up(): void
    {
        foreach (self::SETS as $name => $prefixes) {
            foreach ($prefixes as $p) {
                if (Schema::hasColumn($name, $p.'approval')) {
                    continue;
                }
                Schema::table($name, function (Blueprint $table) use ($p): void {
                    // approved, pending (waiting), returned (sent back with a remark)
                    $table->string($p.'approval', 12)->default('approved');
                    $table->text($p.'approval_remark')->nullable();
                    $table->unsignedBigInteger($p.'approval_by')->nullable();
                    $table->timestamp($p.'approval_at')->nullable();
                    $table->unsignedBigInteger($p.'approval_requested_by')->nullable();
                    $table->timestamp($p.'approval_requested_at')->nullable();
                    // What it looked like when it was last approved, to show what changed
                    $table->longText($p.'approved_content')->nullable();
                });
            }
        }
    }

    public function down(): void
    {
        $columns = ['approval', 'approval_remark', 'approval_by', 'approval_at', 'approval_requested_by', 'approval_requested_at', 'approved_content'];
        foreach (self::SETS as $name => $prefixes) {
            foreach ($prefixes as $p) {
                Schema::table($name, fn (Blueprint $table) => $table->dropColumn(array_map(fn ($c) => $p.$c, $columns)));
            }
        }
    }
};
