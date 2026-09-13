<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasTable('report_versions')) {
            Schema::create('report_versions', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('report_id')->index();
                $table->string('uid_no')->index();
                $table->string('report_type')->index();
                $table->integer('version_number')->default(1);
                $table->text('change_notes')->nullable();
                $table->json('snapshot_data')->nullable();
                $table->string('pdf_path')->nullable();
                $table->unsignedBigInteger('created_by')->nullable();
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('report_versions');
    }
};
