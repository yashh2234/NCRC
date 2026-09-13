<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('login_sessions')) {
            return;
        }

        Schema::create('login_sessions', function (Blueprint $table): void {
            $table->id();
            $table->unsignedInteger('user_id')->index();
            $table->unsignedBigInteger('personal_access_token_id')->nullable()->unique();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->timestamp('logged_in_at');
            $table->timestamp('logged_out_at')->nullable();
            $table->timestamp('last_seen_at')->nullable();
            $table->boolean('active')->default(true);
            $table->timestamps();

            $table->index(['user_id', 'active']);
            $table->index('logged_in_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('login_sessions');
    }
};