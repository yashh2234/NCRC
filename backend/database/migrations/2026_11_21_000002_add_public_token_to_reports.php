<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Secret token for the public report link (QR code on the print → reports.namotech.in/r/{token}).
 * Random, so one client cannot guess the link of another client's report.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('reports', 'public_token')) {
            return;
        }
        // Old rows may hold 0000-00-00 dates: alter without strict date checks
        $mode = DB::selectOne('SELECT @@SESSION.sql_mode AS m')->m;
        DB::statement("SET SESSION sql_mode = ''");
        try {
            Schema::table('reports', function ($table): void {
                $table->string('public_token', 40)->nullable()->unique();
            });
        } finally {
            DB::statement('SET SESSION sql_mode = ?', [$mode]);
        }
    }

    public function down(): void
    {
        Schema::table('reports', function ($table): void {
            $table->dropUnique(['public_token']);
            $table->dropColumn('public_token');
        });
    }
};
