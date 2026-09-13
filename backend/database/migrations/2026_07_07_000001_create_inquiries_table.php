<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('inquiries')) {
            return;
        }

        Schema::create('inquiries', function (Blueprint $table): void {
            $table->id();
            $table->string('inquiry_no', 50)->unique();
            $table->string('client_name', 222);
            $table->string('agency_name', 222)->nullable();
            $table->string('contact_person', 222)->nullable();
            $table->string('mobile_no', 50)->nullable();
            $table->string('email', 222)->nullable();
            $table->enum('inquiry_type', ['letter', 'email', 'phone', 'walk_in', 'reference'])->default('walk_in');
            $table->text('scope_of_work')->nullable();
            $table->string('source_location', 222)->nullable();
            $table->enum('priority', ['low', 'normal', 'high', 'urgent'])->default('normal');
            $table->enum('status', ['new', 'contacted', 'quoted', 'converted', 'cancelled'])->default('new');
            $table->text('notes')->nullable();
            $table->date('received_date');
            $table->timestamp('contacted_at')->nullable();
            $table->unsignedInteger('assigned_to')->nullable();
            $table->unsignedInteger('created_by')->nullable();
            $table->timestamps();

            $table->index('status');
            $table->index('inquiry_type');
            $table->index('received_date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inquiries');
    }
};
