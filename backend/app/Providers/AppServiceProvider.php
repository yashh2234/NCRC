<?php

namespace App\Providers;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->ensureLegacyClientRegistrationsView();
    }

    private function ensureLegacyClientRegistrationsView(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }

        if ($this->viewExists('client_registrations')) {
            return;
        }

        if (! Schema::hasTable('client_registration')) {
            return;
        }

        DB::statement('CREATE OR REPLACE VIEW `client_registrations` AS SELECT * FROM `client_registration`');
    }

    /**
     * Check whether a MySQL view exists.
     *
     * Schema::hasTable() only inspects information_schema.tables and does
     * not detect views (this changed in a recent Laravel version), so it
     * can never be used to guard against re-creating a view that already
     * exists.
     */
    private function viewExists(string $name): bool
    {
        $database = DB::getDatabaseName();

        return DB::table('information_schema.views')
            ->where('table_schema', $database)
            ->where('table_name', $name)
            ->exists();
    }
}