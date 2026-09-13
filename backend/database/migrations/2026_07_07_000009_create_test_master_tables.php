<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('test_categories')) {
            Schema::create('test_categories', function (Blueprint $table): void {
                $table->id();
                $table->string('name', 222)->unique();
                $table->text('description')->nullable();
                $table->boolean('is_active')->default(true);
                $table->unsignedInteger('created_by')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('tests')) {
            Schema::create('tests', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('category_id')->nullable()->constrained('test_categories')->nullOnDelete();
                $table->string('name', 222);
                $table->string('code', 50)->nullable()->unique();
                $table->text('description')->nullable();
                $table->string('unit', 50)->nullable();
                $table->string('sample_type', 222)->nullable();
                $table->text('specification_limit')->nullable();
                $table->decimal('standard_rate', 12, 2)->default(0);
                $table->boolean('is_active')->default(true);
                $table->unsignedInteger('created_by')->nullable();
                $table->timestamps();

                $table->index('category_id');
            });
        }

        if (! Schema::hasTable('test_standards')) {
            Schema::create('test_standards', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('test_id')->nullable()->constrained('tests')->cascadeOnDelete();
                $table->string('standard_name', 222);
                $table->text('description')->nullable();
                $table->timestamps();

                $table->index('test_id');
            });
        }

        if (! Schema::hasTable('test_methods')) {
            Schema::create('test_methods', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('test_id')->nullable()->constrained('tests')->cascadeOnDelete();
                $table->string('method_name', 222);
                $table->text('procedure')->nullable();
                $table->string('equipment_required', 222)->nullable();
                $table->timestamps();

                $table->index('test_id');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('test_methods');
        Schema::dropIfExists('test_standards');
        Schema::dropIfExists('tests');
        Schema::dropIfExists('test_categories');
    }
};
