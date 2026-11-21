<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * ulr_link (old software table) had NOT NULL date columns without defaults, and the old rows hold
 * 0000-00-00. Under Laravel's strict SQL mode a new ULR row (+ New Create, Excel import) could not be
 * saved. Allow NULL; existing values are left as they are.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('ulr_link')) {
            return;
        }
        // Old rows contain 0000-00-00: alter without strict date checks
        $mode = DB::selectOne('SELECT @@SESSION.sql_mode AS m')->m;
        DB::statement("SET SESSION sql_mode = ''");
        try {
            DB::statement('ALTER TABLE ulr_link MODIFY sample_received_date DATE NULL, MODIFY report_dispatch_date DATE NULL');
        } finally {
            DB::statement('SET SESSION sql_mode = ?', [$mode]);
        }
    }

    public function down(): void
    {
        // Leave the columns nullable: going back would break rows saved since.
    }
};
