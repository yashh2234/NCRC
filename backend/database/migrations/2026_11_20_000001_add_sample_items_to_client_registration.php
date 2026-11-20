<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Stores each registration's samples as JSON: category, New/Back, and the selected
 * test sub-types with their qty and rate (so custom tests keep their rate).
 * The old sample_details / qty columns are still filled for tables and reports.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('client_registration') || Schema::hasColumn('client_registration', 'sample_items')) {
            return;
        }

        Schema::table('client_registration', function (Blueprint $table): void {
            // utf8mb4 so custom test names in any script save safely (the legacy table is latin1)
            $table->longText('sample_items')->charset('utf8mb4')->collation('utf8mb4_unicode_ci')->nullable();
        });
    }

    public function down(): void
    {
        if (Schema::hasTable('client_registration') && Schema::hasColumn('client_registration', 'sample_items')) {
            Schema::table('client_registration', function (Blueprint $table): void {
                $table->dropColumn('sample_items');
            });
        }
    }
};
