<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Our bid value (entered as an amount or as a percentage of the tender value)
 * and whether the EMD has been deposited, online or offline.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tenders', function (Blueprint $table): void {
            if (! Schema::hasColumn('tenders', 'bid_value')) {
                $table->string('bid_value', 100)->default('')->after('value');
            }
            if (! Schema::hasColumn('tenders', 'bid_type')) {
                $table->string('bid_type', 20)->default('amount')->after('bid_value');
            }
            if (! Schema::hasColumn('tenders', 'emd_deposited')) {
                $table->string('emd_deposited', 10)->default('')->after('emd');
            }
            if (! Schema::hasColumn('tenders', 'emd_mode')) {
                $table->string('emd_mode', 20)->default('')->after('emd_deposited');
            }
        });
    }

    public function down(): void
    {
        Schema::table('tenders', function (Blueprint $table): void {
            $table->dropColumn(['bid_value', 'bid_type', 'emd_deposited', 'emd_mode']);
        });
    }
};
