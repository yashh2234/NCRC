<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * This migration is intentionally a no-op.
     *
     * It originally created a `client_registrations` (plural) table, but no
     * model or controller in this codebase ever queries that name — the
     * live registration data lives in `client_registration` (singular),
     * used by App\Models\Registration and every controller that touches
     * registrations, billing, or reports.
     *
     * `client_registrations` (plural) is provided separately as a MySQL
     * VIEW over `client_registration`, created by
     * App\Providers\AppServiceProvider::ensureLegacyClientRegistrationsView()
     * for any legacy code that still expects the plural name.
     *
     * Since Laravel stopped treating views as tables for Schema::hasTable()
     * purposes, this migration's old guard could no longer detect that view
     * and would attempt to CREATE TABLE `client_registrations`, colliding
     * with the view and failing with a 1050 "table already exists" error.
     * Rather than compete with the view for the name, this migration does
     * nothing — the view (or a fresh boot of AppServiceProvider) is the
     * single source of truth for the plural name.
     */
    public function up(): void
    {
        // Intentionally empty. See class docblock above.
    }

    public function down(): void
    {
        // Nothing to reverse.
    }
};