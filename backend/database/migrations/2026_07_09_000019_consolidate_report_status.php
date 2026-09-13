<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reports', function (Blueprint $table): void {
            if (Schema::hasColumn('reports', 'workflow_status')) {
                DB::statement("UPDATE reports SET status = workflow_status WHERE workflow_status IS NOT NULL AND workflow_status != 'draft'");
                $table->dropColumn('workflow_status');
            }
        });
    }

    public function down(): void
    {
        Schema::table('reports', function (Blueprint $table): void {
            if (!Schema::hasColumn('reports', 'workflow_status')) {
                $table->string('workflow_status', 50)->default('draft')->after('status');
            }
        });
    }
};
