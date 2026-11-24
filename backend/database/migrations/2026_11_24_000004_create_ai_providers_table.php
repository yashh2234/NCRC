<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Free AI services, tried in sort_order: when one is full or not answering
 * the next is used. Separate from the Gemini key of Proposals / Tenders. Keys are stored encrypted.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('ai_providers')) {
            return;
        }

        Schema::create('ai_providers', function (Blueprint $table): void {
            $table->id();
            $table->string('provider', 30)->unique();
            $table->text('api_key')->nullable();
            $table->string('model', 150)->nullable();
            $table->boolean('enabled')->default(true);
            $table->unsignedTinyInteger('sort_order')->default(0);
            $table->timestamp('paused_until')->nullable();
            $table->string('last_error', 500)->nullable();
            $table->timestamp('last_ok_at')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ai_providers');
    }
};
