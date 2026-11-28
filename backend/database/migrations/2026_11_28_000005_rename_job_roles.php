<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Job roles now: Registration, Lab, Report, Accounts, Manager (only a label).
 * Technical becomes Report; Staff becomes no job role; the super admin has none.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('users')->where('tracker_role', 'technical')->update(['tracker_role' => 'report_staff']);
        DB::table('users')->where('tracker_role', 'staff')->update(['tracker_role' => null]);
        DB::table('users')->where('id', 1)->update(['tracker_role' => null]);
    }

    public function down(): void
    {
        // Labels only: nothing to undo
    }
};
