<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('test_results', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('job_id')->constrained('workflow_jobs')->cascadeOnDelete();
            $table->foreignId('job_assignment_id')->nullable()->constrained('job_assignments')->nullOnDelete();
            $table->foreignId('test_id')->constrained('tests')->cascadeOnDelete();
            $table->foreignId('category_id')->nullable()->constrained('test_categories')->nullOnDelete();
            $table->string('test_name', 255)->nullable();
            $table->string('result_value', 255)->nullable();
            $table->string('unit', 100)->nullable();
            $table->string('specification_limit', 255)->nullable();
            $table->string('standard_name', 255)->nullable();
            $table->string('method_name', 255)->nullable();
            $table->enum('status', ['pending', 'in_progress', 'completed', 'failed'])->default('pending');
            $table->text('remarks')->nullable();
            $table->unsignedBigInteger('tested_by')->nullable();
            $table->timestamp('tested_at')->nullable();
            $table->timestamps();

            $table->index(['job_id', 'status']);
            $table->index('job_assignment_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('test_results');
    }
};
