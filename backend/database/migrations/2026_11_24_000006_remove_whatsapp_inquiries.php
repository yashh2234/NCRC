<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The WhatsApp inquiry idea was dropped. Removes its tables (with the saved Meta app secret) and column where the
 * earlier migration 2026_11_24_000005 had already been run; does nothing elsewhere. Inquiries are not touched.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('whatsapp_messages');
        Schema::dropIfExists('whatsapp_settings');
        if (Schema::hasColumn('inquiries', 'needs_check')) {
            Schema::table('inquiries', function (Blueprint $table): void {
                $table->dropColumn('needs_check');
            });
        }
    }

    public function down(): void
    {
        // Nothing to bring back
    }
};
