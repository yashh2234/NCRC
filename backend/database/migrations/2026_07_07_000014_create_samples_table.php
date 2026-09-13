<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('samples', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('job_id')->constrained('workflow_jobs')->cascadeOnDelete();
            $table->string('sample_name', 255)->nullable();
            $table->string('sample_type', 255)->nullable();
            $table->text('description')->nullable();
            $table->string('quantity', 50)->nullable();
            $table->string('unit', 50)->nullable();
            $table->string('condition', 100)->nullable();
            $table->date('received_date')->nullable();
            $table->unsignedBigInteger('collected_by')->nullable();
            $table->text('remarks')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index('job_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('samples');
    }
};
