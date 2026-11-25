<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Quotation items: heading and sub-heading rows over the items (kind), and further heading + text pairs
 * inside one item (extra).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('quotation_items', function (Blueprint $table): void {
            if (! Schema::hasColumn('quotation_items', 'kind')) {
                $table->string('kind', 12)->default('item')->after('quotation_id');
            }
            if (! Schema::hasColumn('quotation_items', 'extra')) {
                $table->longText('extra')->nullable()->after('details');
            }
        });
    }

    public function down(): void
    {
        Schema::table('quotation_items', function (Blueprint $table): void {
            $table->dropColumn(['kind', 'extra']);
        });
    }
};
