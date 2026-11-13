<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Per-user feature access.
 *  - allowed_modules: JSON list of sidebar features this user can open.
 *    NULL = not configured yet, so the user keeps the defaults of their job role.
 *  - tracker_role: job role (registration, lab, report_staff, technical, manager, staff)
 *    used for the dashboard and job queues. NULL = derived from the legacy group name.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            if (! Schema::hasColumn('users', 'allowed_modules')) {
                $table->text('allowed_modules')->nullable();
            }
            if (! Schema::hasColumn('users', 'tracker_role')) {
                $table->string('tracker_role', 50)->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $columns = array_values(array_filter(
                ['allowed_modules', 'tracker_role'],
                fn (string $column): bool => Schema::hasColumn('users', $column),
            ));
            if ($columns) {
                $table->dropColumn($columns);
            }
        });
    }
};
