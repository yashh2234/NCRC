<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('dispatches')) {
            return;
        }

        Schema::create('dispatches', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('report_id')->nullable();
            $table->foreignId('work_order_id')->nullable()->constrained('work_orders')->nullOnDelete();
            $table->unsignedBigInteger('registration_id')->nullable();
            $table->date('dispatch_date');
            $table->enum('dispatch_method', ['courier', 'hand_delivery', 'email', 'post'])->default('courier');
            $table->string('courier_name', 222)->nullable();
            $table->string('tracking_number', 222)->nullable();
            $table->string('recipient_name', 222)->nullable();
            $table->text('recipient_address')->nullable();
            $table->string('received_by', 222)->nullable();
            $table->timestamp('received_at')->nullable();
            $table->enum('status', ['pending', 'dispatched', 'delivered', 'returned'])->default('pending');
            $table->text('notes')->nullable();
            $table->unsignedInteger('dispatched_by')->nullable();
            $table->timestamps();

            $table->index('work_order_id');
            $table->index('registration_id');
            $table->index('status');
            $table->index('dispatch_date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dispatches');
    }
};
