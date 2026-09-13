<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Master permissions table
        if (!Schema::hasTable('permissions')) {
            Schema::create('permissions', function (Blueprint $table): void {
                $table->id();
                $table->string('name', 255)->unique();
                $table->string('guard_name', 255)->default('web');
                $table->string('module', 100)->nullable()->comment('Module this permission belongs to');
                $table->string('action', 100)->nullable()->comment('Action type: create, read, update, delete, approve, etc');
                $table->string('description', 255)->nullable();
                $table->timestamps();

                $table->index('module');
            });
        }

        // Role-permission pivot
        if (!Schema::hasTable('role_has_permissions')) {
            Schema::create('role_has_permissions', function (Blueprint $table): void {
                $table->foreignId('permission_id')->constrained('permissions')->cascadeOnDelete();
                $table->unsignedBigInteger('role_id');
                $table->string('role_type', 255)->default('App\\Models\\LegacyGroup');

                $table->primary(['permission_id', 'role_id', 'role_type']);
            });
        }

        // User-role pivot (replaces user_group for new system)
        if (!Schema::hasTable('model_has_roles')) {
            Schema::create('model_has_roles', function (Blueprint $table): void {
                $table->unsignedBigInteger('role_id');
                $table->string('role_type', 255)->default('App\\Models\\LegacyGroup');
                $table->unsignedBigInteger('model_id');
                $table->string('model_type', 255)->default('App\\Models\\User');

                $table->primary(['role_id', 'model_id', 'model_type']);
                $table->index(['model_id', 'model_type']);
            });
        }

        // Direct user-permission assignments (overrides)
        if (!Schema::hasTable('model_has_permissions')) {
            Schema::create('model_has_permissions', function (Blueprint $table): void {
                $table->foreignId('permission_id')->constrained('permissions')->cascadeOnDelete();
                $table->unsignedBigInteger('model_id');
                $table->string('model_type', 255)->default('App\\Models\\User');

                $table->primary(['permission_id', 'model_id', 'model_type']);
                $table->index(['model_id', 'model_type']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('model_has_permissions');
        Schema::dropIfExists('model_has_roles');
        Schema::dropIfExists('role_has_permissions');
        Schema::dropIfExists('permissions');
    }
};
