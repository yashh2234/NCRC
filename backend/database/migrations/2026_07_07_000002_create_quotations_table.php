<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('quotations')) {
            return;
        }

        Schema::create('quotations', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('inquiry_id')->nullable()->constrained('inquiries')->nullOnDelete();
            $table->string('quotation_no', 50)->unique();
            $table->date('date');
            $table->date('valid_until')->nullable();
            $table->string('client_name', 222);
            $table->string('agency_name', 222)->nullable();
            $table->string('contact_person', 222)->nullable();
            $table->string('mobile_no', 50)->nullable();
            $table->string('email', 222)->nullable();
            $table->decimal('total_amount', 12, 2)->default(0);
            $table->decimal('discount', 12, 2)->default(0);
            $table->decimal('tax_amount', 12, 2)->default(0);
            $table->decimal('net_amount', 12, 2)->default(0);
            $table->text('terms_and_conditions')->nullable();
            $table->enum('status', ['draft', 'sent', 'accepted', 'rejected', 'expired'])->default('draft');
            $table->enum('sent_via', ['email', 'phone', 'hand_delivery', 'courier'])->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('accepted_at')->nullable();
            $table->text('notes')->nullable();
            $table->unsignedInteger('created_by')->nullable();
            $table->timestamps();

            $table->index('inquiry_id');
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('quotations');
    }
};
