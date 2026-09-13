<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Seed "Report Staff" and "Technical" groups to match the
     * Namotech Job Tracker Excel workflow roles.
     *
     * Existing groups mapped:
     *   ID 1 Administrator  → Admin
     *   ID 6 LAB employee   → Lab
     *   ID 8 registerar     → Registration
     *   ID 7 HR Group       → Manager (closest fit)
     *   ID 9 accounts       → Manager / Accounts
     *
     * New groups:
     *   Report Staff  → Stage 4 (Report Drafting)
     *   Technical     → Stage 5 (Report Review)
     */
    public function up(): void
    {
        // Only create if they don't already exist
        if (!DB::table('groups')->where('group_name', 'Report Staff')->exists()) {
            DB::table('groups')->insert([
                'group_name' => 'Report Staff',
                'permission' => serialize([
                    'viewRegistration',
                    'viewOrder',
                    'viewReports',
                    'viewProfile',
                ]),
            ]);
        }

        if (!DB::table('groups')->where('group_name', 'Technical')->exists()) {
            DB::table('groups')->insert([
                'group_name' => 'Technical',
                'permission' => serialize([
                    'viewRegistration',
                    'viewOrder',
                    'viewReports',
                    'viewBilling',
                    'viewProfile',
                    'updateSetting',
                ]),
            ]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::table('groups')->where('group_name', 'Report Staff')->delete();
        DB::table('groups')->where('group_name', 'Technical')->delete();
    }
};
