<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('departments')) {
            Schema::create('departments', function (Blueprint $table): void {
                $table->id();
                $table->string('name', 222)->unique();
                $table->string('code', 50)->nullable()->unique();
                $table->text('description')->nullable();
                $table->unsignedInteger('head_of_department')->nullable();
                $table->boolean('is_active')->default(true);
                $table->unsignedInteger('created_by')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('designations')) {
            Schema::create('designations', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('department_id')->nullable()->constrained('departments')->nullOnDelete();
                $table->string('name', 222);
                $table->text('description')->nullable();
                $table->boolean('is_active')->default(true);
                $table->unsignedInteger('created_by')->nullable();
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('designations');
        Schema::dropIfExists('departments');
    }
};
