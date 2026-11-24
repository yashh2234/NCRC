<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Inquiries sent as WhatsApp messages to the office's WhatsApp Business number (Meta Cloud API webhook).
 * Every message of an allowed sender is kept first and turned into an inquiry after that, so none is lost.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('inquiries', 'needs_check')) {
            Schema::table('inquiries', function (Blueprint $table): void {
                $table->boolean('needs_check')->default(false);
            });
        }

        if (! Schema::hasTable('whatsapp_settings')) {
            Schema::create('whatsapp_settings', function (Blueprint $table): void {
                $table->id();
                $table->boolean('enabled')->default(false);
                $table->text('app_secret')->nullable();
                $table->text('verify_token')->nullable();
                $table->string('phone_number_id', 50)->nullable();
                $table->json('senders')->nullable();
                $table->timestamp('verified_at')->nullable();
                $table->timestamp('last_message_at')->nullable();
                $table->string('last_problem', 255)->nullable();
                $table->timestamp('last_problem_at')->nullable();
                $table->unsignedBigInteger('updated_by')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('whatsapp_messages')) {
            Schema::create('whatsapp_messages', function (Blueprint $table): void {
                $table->id();
                $table->string('wamid', 190)->unique();
                $table->string('sender', 30);
                $table->unsignedBigInteger('user_id');
                $table->text('body');
                $table->string('status', 20)->default('pending')->index();
                $table->unsignedTinyInteger('attempts')->default(0);
                $table->string('error', 255)->nullable();
                $table->unsignedBigInteger('inquiry_id')->nullable();
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('whatsapp_messages');
        Schema::dropIfExists('whatsapp_settings');
        Schema::table('inquiries', function (Blueprint $table): void {
            $table->dropColumn('needs_check');
        });
    }
};
