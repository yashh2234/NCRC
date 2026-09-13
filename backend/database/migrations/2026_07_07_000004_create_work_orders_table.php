<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('work_orders')) {
            return;
        }

        Schema::create('work_orders', function (Blueprint $table): void {
            $table->id();
            $table->string('work_order_no', 50)->unique();
            $table->foreignId('inquiry_id')->nullable()->constrained('inquiries')->nullOnDelete();
            $table->foreignId('quotation_id')->nullable()->constrained('quotations')->nullOnDelete();
            $table->unsignedBigInteger('registration_id')->nullable();
            $table->string('client_name', 222);
            $table->string('agency_name', 222)->nullable();
            $table->string('contact_person', 222)->nullable();
            $table->string('mobile_no', 50)->nullable();
            $table->text('scope_of_work')->nullable();
            $table->text('terms_and_conditions')->nullable();
            $table->decimal('total_amount', 12, 2)->default(0);
            $table->decimal('advance_payment', 12, 2)->default(0);
            $table->decimal('balance_dues', 12, 2)->default(0);
            $table->string('payment_terms', 222)->nullable();
            $table->enum('status', ['draft', 'active', 'in_progress', 'completed', 'cancelled'])->default('draft');
            $table->enum('assignment_type', ['inhouse', 'outsource'])->default('inhouse');
            $table->date('due_date')->nullable();
            $table->text('notes')->nullable();
            $table->unsignedInteger('created_by')->nullable();
            $table->timestamps();

            $table->index('inquiry_id');
            $table->index('registration_id');
            $table->index('status');
            $table->index('assignment_type');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('work_orders');
    }
};
