<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('technical_reviews')) {
            Schema::create('technical_reviews', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('report_id');
                $table->unsignedInteger('reviewer_id')->nullable();
                $table->text('remarks')->nullable();
                $table->enum('status', ['pending', 'approved', 'returned_for_correction', 'returned_for_re_review'])->default('pending');
                $table->timestamp('reviewed_at')->nullable();
                $table->timestamp('corrected_at')->nullable();
                $table->unsignedInteger('corrected_by')->nullable();
                $table->timestamps();

                $table->index('report_id');
                $table->index('status');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('technical_reviews');
    }
};
