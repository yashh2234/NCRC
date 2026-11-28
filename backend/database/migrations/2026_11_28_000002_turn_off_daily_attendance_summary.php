<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /** Admins now get every check in and check out, so the 11:00 summary is off (it can be turned on again in Team › Settings) */
    public function up(): void
    {
        DB::table('hr_settings')->where('key', 'daily_summary')->update(['value' => json_encode(false)]);
    }

    public function down(): void
    {
        DB::table('hr_settings')->where('key', 'daily_summary')->update(['value' => json_encode(true)]);
    }
};
