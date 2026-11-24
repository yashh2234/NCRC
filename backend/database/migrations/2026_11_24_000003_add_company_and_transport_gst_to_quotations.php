<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Quotations from either company: 'ncs' (NCS LLP, GST always 18%) or 'ncrc' (NCRC Pvt Ltd, no GST), and a
 * choice on LLP quotations whether GST is charged on transport (transport then comes before GST).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('quotations', function (Blueprint $table): void {
            if (! Schema::hasColumn('quotations', 'company')) {
                $table->string('company', 10)->default('ncs')->index();
            }
            if (! Schema::hasColumn('quotations', 'transport_gst')) {
                $table->boolean('transport_gst')->default(false);
            }
        });
    }

    public function down(): void
    {
        Schema::table('quotations', function (Blueprint $table): void {
            $table->dropIndex(['company']);
            $table->dropColumn(['company', 'transport_gst']);
        });
    }
};
