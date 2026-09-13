<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reports', function (Blueprint $table): void {
            if (!Schema::hasColumn('reports', 'job_id')) {
                $table->unsignedBigInteger('job_id')->nullable()->after('iReportId');
                $table->index('job_id');
            }
            if (!Schema::hasColumn('reports', 'workflow_status')) {
                $table->string('workflow_status', 50)->default('draft')->after('status');
            }
            if (!Schema::hasColumn('reports', 'submitted_at')) {
                $table->timestamp('submitted_at')->nullable()->after('report_generated_at');
            }
            if (!Schema::hasColumn('reports', 'locked_at')) {
                $table->timestamp('locked_at')->nullable()->after('approved_at');
            }
            if (!Schema::hasColumn('reports', 'locked_by')) {
                $table->unsignedBigInteger('locked_by')->nullable()->after('locked_at');
            }
        });
    }

    public function down(): void
    {
        Schema::table('reports', function (Blueprint $table): void {
            $table->dropColumn(['job_id', 'workflow_status', 'submitted_at', 'locked_at', 'locked_by']);
        });
    }
};
