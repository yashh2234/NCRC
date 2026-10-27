<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('reports') && ! Schema::hasColumn('reports', 'lab_data')) {
            Schema::table('reports', function (Blueprint $table): void {
                $table->json('lab_data')->nullable();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('reports') && Schema::hasColumn('reports', 'lab_data')) {
            Schema::table('reports', function (Blueprint $table): void {
                $table->dropColumn('lab_data');
            });
        }
    }
};
