<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('document_categories')) {
            Schema::create('document_categories', function (Blueprint $table): void {
                $table->id();
                $table->string('name', 255);
                $table->string('slug', 255)->nullable();
                $table->unsignedBigInteger('parent_id')->nullable();
                $table->integer('sort_order')->default(0);
                $table->text('description')->nullable();
                $table->string('icon', 50)->nullable()->default('folder');
                $table->boolean('is_active')->default(true);
                $table->unsignedBigInteger('created_by')->nullable();
                $table->timestamps();

                $table->foreign('parent_id')->references('id')->on('document_categories')->cascadeOnDelete();
                $table->index('slug');
                $table->index('parent_id');
            });
        }

        if (!Schema::hasTable('documents')) {
            Schema::create('documents', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('category_id')->nullable();
                $table->string('title', 255);
                $table->text('description')->nullable();
                $table->string('file_name', 255);
                $table->string('file_path', 500);
                $table->string('file_type', 100)->nullable()->comment('MIME type');
                $table->string('file_extension', 20)->nullable();
                $table->unsignedBigInteger('file_size')->default(0)->comment('Size in bytes');
                $table->json('metadata')->nullable()->comment('OCR data, EXIF, etc');
                $table->string('tags', 500)->nullable();
                $table->unsignedBigInteger('linked_job_id')->nullable();
                $table->string('linked_model_type', 255)->nullable();
                $table->unsignedBigInteger('linked_model_id')->nullable();
                $table->unsignedBigInteger('created_by')->nullable();
                $table->unsignedBigInteger('updated_by')->nullable();
                $table->timestamps();
                $table->softDeletes();

                $table->foreign('category_id')->references('id')->on('document_categories')->nullOnDelete();
                $table->index('file_type');
                $table->index('tags');
                $table->index('linked_job_id');
                $table->index(['linked_model_type', 'linked_model_id']);
            });
        }

        if (!Schema::hasTable('document_versions')) {
            Schema::create('document_versions', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('document_id')->constrained('documents')->cascadeOnDelete();
                $table->integer('version_number');
                $table->string('file_name', 255);
                $table->string('file_path', 500);
                $table->string('file_type', 100)->nullable();
                $table->unsignedBigInteger('file_size')->default(0);
                $table->text('change_notes')->nullable();
                $table->unsignedBigInteger('created_by')->nullable();
                $table->timestamps();

                $table->index(['document_id', 'version_number']);
            });
        }

        if (!Schema::hasTable('document_downloads')) {
            Schema::create('document_downloads', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('document_id')->constrained('documents')->cascadeOnDelete();
                $table->unsignedBigInteger('user_id')->nullable();
                $table->string('ip_address', 45)->nullable();
                $table->string('user_agent', 500)->nullable();
                $table->timestamps();

                $table->index('user_id');
                $table->index('created_at');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('document_downloads');
        Schema::dropIfExists('document_versions');
        Schema::dropIfExists('documents');
        Schema::dropIfExists('document_categories');
    }
};
