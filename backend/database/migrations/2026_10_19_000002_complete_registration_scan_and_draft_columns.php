<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('client_registration')) {
            return;
        }

        $scanColumns = [];
        for ($slot = 5; $slot <= 9; $slot++) {
            $column = 'scan_copy_' . $slot;
            if (! Schema::hasColumn('client_registration', $column)) {
                $scanColumns[] = $column;
            }
        }

        if ($scanColumns) {
            Schema::table('client_registration', function (Blueprint $table) use ($scanColumns): void {
                foreach ($scanColumns as $column) {
                    $table->text($column)->nullable();
                }
            });
        }

        if (! Schema::hasColumn('client_registration', 'is_draft')) {
            Schema::table('client_registration', function (Blueprint $table): void {
                $table->boolean('is_draft')->default(false);
            });
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('client_registration')) {
            return;
        }

        $columns = [];
        for ($slot = 5; $slot <= 9; $slot++) {
            $column = 'scan_copy_' . $slot;
            if (Schema::hasColumn('client_registration', $column)) {
                $columns[] = $column;
            }
        }
        if (Schema::hasColumn('client_registration', 'is_draft')) {
            $columns[] = 'is_draft';
        }

        if ($columns) {
            Schema::table('client_registration', function (Blueprint $table) use ($columns): void {
                $table->dropColumn($columns);
            });
        }
    }
};
