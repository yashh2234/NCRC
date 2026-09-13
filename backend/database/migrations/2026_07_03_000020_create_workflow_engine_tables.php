<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('workflow_templates')) {
            Schema::create('workflow_templates', function (Blueprint $table): void {
                $table->id();
                $table->string('name', 255);
                $table->text('description')->nullable();
                $table->boolean('is_active')->default(true);
                $table->unsignedBigInteger('created_by')->nullable();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('workflow_stages')) {
            Schema::create('workflow_stages', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('template_id')->constrained('workflow_templates')->cascadeOnDelete();
                $table->string('name', 255);
                $table->string('slug', 255);
                $table->integer('sort_order')->default(0);
                $table->unsignedBigInteger('assigned_role_id')->nullable();
                $table->decimal('sla_hours', 8, 1)->nullable()->comment('Max hours for this stage');
                $table->boolean('is_start')->default(false);
                $table->boolean('is_end')->default(false);
                $table->string('color', 7)->default('#6b7280');
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('workflow_transitions')) {
            Schema::create('workflow_transitions', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('template_id')->constrained('workflow_templates')->cascadeOnDelete();
                $table->foreignId('from_stage_id')->constrained('workflow_stages')->cascadeOnDelete();
                $table->foreignId('to_stage_id')->constrained('workflow_stages')->cascadeOnDelete();
                $table->string('name', 255);
                $table->string('permission_name', 255)->nullable();
                $table->boolean('requires_approval')->default(false);
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('workflow_jobs')) {
            Schema::create('workflow_jobs', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('workflow_template_id')->nullable()->constrained('workflow_templates')->nullOnDelete();
                $table->foreignId('current_stage_id')->nullable()->constrained('workflow_stages')->nullOnDelete();
                $table->string('uid_no', 255)->unique();
                $table->string('title', 255)->nullable();
                $table->text('description')->nullable();
                $table->string('priority', 20)->default('normal')->comment('low, normal, high, urgent');
                $table->string('status', 50)->default('active')->comment('active, completed, cancelled, on_hold');
                $table->unsignedBigInteger('client_id')->nullable();
                $table->unsignedBigInteger('assigned_to')->nullable();
                $table->unsignedBigInteger('created_by')->nullable();
                $table->unsignedBigInteger('updated_by')->nullable();
                $table->timestamp('started_at')->nullable();
                $table->timestamp('completed_at')->nullable();
                $table->timestamp('due_at')->nullable();
                $table->timestamps();
                $table->softDeletes();

                $table->index('uid_no');
                $table->index('status');
                $table->index('priority');
                $table->index('assigned_to');
            });
        }

        if (!Schema::hasTable('job_timeline')) {
            Schema::create('job_timeline', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('job_id')->constrained('workflow_jobs')->cascadeOnDelete();
                $table->foreignId('from_stage_id')->nullable()->constrained('workflow_stages')->nullOnDelete();
                $table->foreignId('to_stage_id')->nullable()->constrained('workflow_stages')->nullOnDelete();
                $table->string('action', 255)->comment('transition name or custom action');
                $table->unsignedBigInteger('user_id')->nullable();
                $table->text('notes')->nullable();
                $table->json('metadata')->nullable();
                $table->timestamps();

                $table->index('job_id');
                $table->index('user_id');
            });
        }

        if (!Schema::hasTable('job_stage_tracking')) {
            Schema::create('job_stage_tracking', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('job_id')->constrained('workflow_jobs')->cascadeOnDelete();
                $table->foreignId('stage_id')->constrained('workflow_stages')->cascadeOnDelete();
                $table->timestamp('entered_at')->nullable();
                $table->timestamp('exited_at')->nullable();
                $table->timestamp('sla_deadline')->nullable();
                $table->boolean('is_overdue')->default(false);
                $table->integer('overdue_minutes')->default(0);
                $table->timestamps();

                $table->index(['job_id', 'stage_id']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('job_stage_tracking');
        Schema::dropIfExists('job_timeline');
        Schema::dropIfExists('workflow_jobs');
        Schema::dropIfExists('workflow_transitions');
        Schema::dropIfExists('workflow_stages');
        Schema::dropIfExists('workflow_templates');
    }
};
