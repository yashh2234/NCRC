<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $schema = Schema::getConnection()->getSchemaBuilder();

        Schema::table('reports', function (Blueprint $table) use ($schema): void {
            if (! $schema->hasColumn('reports', 'assigned_to')) {
                $table->unsignedInteger('assigned_to')->nullable()->after('status');
            }
            if (! $schema->hasColumn('reports', 'assigned_at')) {
                $table->timestamp('assigned_at')->nullable()->after('assigned_to');
            }
            if (! $schema->hasColumn('reports', 'testing_started_at')) {
                $table->timestamp('testing_started_at')->nullable()->after('assigned_at');
            }
            if (! $schema->hasColumn('reports', 'report_generated_at')) {
                $table->timestamp('report_generated_at')->nullable()->after('testing_started_at');
            }
            if (! $schema->hasColumn('reports', 'approved_at')) {
                $table->timestamp('approved_at')->nullable()->after('report_generated_at');
            }
            if (! $schema->hasColumn('reports', 'approved_by')) {
                $table->unsignedInteger('approved_by')->nullable()->after('approved_at');
            }
        });
    }

    public function down(): void
    {
        Schema::table('reports', function (Blueprint $table): void {
            $columns = ['assigned_to', 'assigned_at', 'testing_started_at', 'report_generated_at', 'approved_at', 'approved_by'];
            $existing = array_filter($columns, fn (string $col) => Schema::getConnection()->getSchemaBuilder()->hasColumn('reports', $col));
            if ($existing !== []) {
                $table->dropColumn($existing);
            }
        });
    }

};
