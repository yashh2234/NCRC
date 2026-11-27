<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // One row per phone / browser that allowed notifications
        Schema::create('push_subscriptions', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->index();
            $table->string('endpoint', 700);
            $table->string('endpoint_hash', 64)->unique();
            $table->string('p256dh', 255);
            $table->string('auth', 255);
            $table->string('device', 255)->nullable();
            $table->timestamp('last_used_at')->nullable();
            $table->timestamps();
        });

        Schema::table('users', function (Blueprint $table) {
            // {"categories": {"approvals": true, ...}, "quiet_from": "22:00", "quiet_to": "07:00"}
            $table->json('push_prefs')->nullable();
        });

        Schema::table('attendances', function (Blueprint $table) {
            $table->string('in_selfie', 255)->nullable();
            $table->string('out_selfie', 255)->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('push_subscriptions');
        Schema::table('users', fn (Blueprint $table) => $table->dropColumn('push_prefs'));
        Schema::table('attendances', fn (Blueprint $table) => $table->dropColumn(['in_selfie', 'out_selfie']));
    }
};
