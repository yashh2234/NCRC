<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $schema = Schema::getConnection()->getSchemaBuilder();
        Schema::table('users', function (Blueprint $table) use ($schema): void {
            if (! $schema->hasColumn('users', 'department_id')) {
                $table->foreignId('department_id')->nullable()->constrained('departments')->nullOnDelete()->after('is_active');
            }
            if (! $schema->hasColumn('users', 'designation_id')) {
                $table->foreignId('designation_id')->nullable()->constrained('designations')->nullOnDelete()->after('department_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropForeign(['department_id']);
            $table->dropForeign(['designation_id']);
            $table->dropColumn(['department_id', 'designation_id']);
        });
    }
};
