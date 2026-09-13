<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('outsource_assignments')) {
            return;
        }

        Schema::create('outsource_assignments', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('work_order_id')->constrained('work_orders')->cascadeOnDelete();
            $table->unsignedBigInteger('registration_id')->nullable();
            $table->string('party_name', 222);
            $table->string('party_contact', 222)->nullable();
            $table->string('party_email', 222)->nullable();
            $table->text('scope_of_work')->nullable();
            $table->decimal('agreed_amount', 12, 2)->default(0);
            $table->enum('payment_status', ['pending', 'partial', 'paid'])->default('pending');
            $table->decimal('payment_amount', 12, 2)->default(0);
            $table->date('payment_date')->nullable();
            $table->string('payment_reference', 222)->nullable();
            $table->enum('status', ['assigned', 'in_progress', 'completed', 'cancelled'])->default('assigned');
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->text('completion_details')->nullable();
            $table->date('delivery_date')->nullable();
            $table->text('notes')->nullable();
            $table->unsignedInteger('assigned_by')->nullable();
            $table->timestamps();

            $table->index('work_order_id');
            $table->index('registration_id');
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('outsource_assignments');
    }
};
