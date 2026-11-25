<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/** The reset code is mailed now and may be tried a few times only; the old codes were shown on the screen. */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('password_reset_tokens')->delete();
        if (! Schema::hasColumn('password_reset_tokens', 'attempts')) {
            Schema::table('password_reset_tokens', function (Blueprint $table): void {
                $table->unsignedTinyInteger('attempts')->default(0);
            });
        }
    }

    public function down(): void
    {
        Schema::table('password_reset_tokens', fn (Blueprint $table) => $table->dropColumn('attempts'));
    }
};
