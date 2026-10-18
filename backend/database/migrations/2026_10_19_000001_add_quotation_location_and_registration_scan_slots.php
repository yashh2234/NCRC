<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('quotations') && ! Schema::hasColumn('quotations', 'location')) {
            Schema::table('quotations', function (Blueprint $table): void {
                $table->string('location', 222)->nullable()->after('email');
            });
        }

        if (Schema::hasTable('client_registration')) {
            $columns = [];
            for ($slot = 5; $slot <= 9; $slot++) {
                $column = 'scan_copy_' . $slot;
                if (! Schema::hasColumn('client_registration', $column)) {
                    $columns[] = $column;
                }
            }
            if ($columns) {
                Schema::table('client_registration', function (Blueprint $table) use ($columns): void {
                    foreach ($columns as $column) {
                        $table->text($column)->nullable();
                    }
                });
            }
            if (! Schema::hasColumn('client_registration', 'is_draft')) {
                Schema::table('client_registration', function (Blueprint $table): void {
                    $table->boolean('is_draft')->default(false)->after('payment_status');
                });
            }
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('quotations') && Schema::hasColumn('quotations', 'location')) {
            Schema::table('quotations', function (Blueprint $table): void {
                $table->dropColumn('location');
            });
        }

        if (Schema::hasTable('client_registration')) {
            $columns = [];
            for ($slot = 5; $slot <= 9; $slot++) {
                $column = 'scan_copy_' . $slot;
                if (Schema::hasColumn('client_registration', $column)) {
                    $columns[] = $column;
                }
            }
            if ($columns) {
                Schema::table('client_registration', function (Blueprint $table) use ($columns): void {
                    $table->dropColumn($columns);
                });
            }
            if (Schema::hasColumn('client_registration', 'is_draft')) {
                Schema::table('client_registration', function (Blueprint $table): void {
                    $table->dropColumn('is_draft');
                });
            }
        }
    }
};
