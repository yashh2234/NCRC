<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('client_documents')) {
            Schema::create('client_documents', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('client_id')->constrained('clients')->cascadeOnDelete();
                $table->string('document_type', 100)->nullable();
                $table->string('document_name', 222);
                $table->string('file_path', 500);
                $table->string('file_size', 50)->nullable();
                $table->text('notes')->nullable();
                $table->unsignedInteger('uploaded_by')->nullable();
                $table->timestamps();

                $table->index('client_id');
                $table->index('document_type');
            });
        }

        $schema = Schema::getConnection()->getSchemaBuilder();
        if (! $schema->hasColumn('work_orders', 'priority')) {
            Schema::table('work_orders', function (Blueprint $table): void {
                $table->enum('priority', ['low', 'normal', 'high', 'urgent'])->default('normal')->after('assignment_type');
            });
        }
        if (! $schema->hasColumn('work_orders', 'attachments')) {
            Schema::table('work_orders', function (Blueprint $table): void {
                $table->json('attachments')->nullable()->after('notes');
            });
        }
        if (! $schema->hasColumn('work_orders', 'department_id')) {
            Schema::table('work_orders', function (Blueprint $table): void {
                $table->foreignId('department_id')->nullable()->constrained('departments')->nullOnDelete()->after('due_date');
            });
        }
    }

    public function down(): void
    {
        Schema::table('work_orders', function (Blueprint $table): void {
            $table->dropColumn(['priority', 'attachments', 'department_id']);
        });
        Schema::dropIfExists('client_documents');
    }
};
