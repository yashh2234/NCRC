<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('vendors')) {
            Schema::create('vendors', function (Blueprint $table): void {
                $table->id();
                $table->string('vendor_name', 222);
                $table->string('contact_person', 222)->nullable();
                $table->string('mobile', 50)->nullable();
                $table->string('phone', 50)->nullable();
                $table->string('email', 222)->nullable();
                $table->string('website', 222)->nullable();
                $table->text('address')->nullable();
                $table->string('city', 100)->nullable();
                $table->string('state', 100)->nullable();
                $table->string('pincode', 20)->nullable();
                $table->string('gst_no', 50)->nullable();
                $table->string('pan_no', 50)->nullable();
                $table->text('services_offered')->nullable();
                $table->text('notes')->nullable();
                $table->boolean('is_active')->default(true);
                $table->unsignedInteger('created_by')->nullable();
                $table->timestamps();

                $table->index('vendor_name');
                $table->index('mobile');
            });
        }

        if (! Schema::hasTable('vendor_contacts')) {
            Schema::create('vendor_contacts', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('vendor_id')->constrained('vendors')->cascadeOnDelete();
                $table->string('name', 222);
                $table->string('designation', 222)->nullable();
                $table->string('mobile', 50)->nullable();
                $table->string('email', 222)->nullable();
                $table->boolean('is_primary')->default(false);
                $table->timestamps();

                $table->index('vendor_id');
            });
        }

        if (! Schema::hasTable('vendor_services')) {
            Schema::create('vendor_services', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('vendor_id')->constrained('vendors')->cascadeOnDelete();
                $table->foreignId('test_id')->nullable()->constrained('tests')->nullOnDelete();
                $table->string('service_name', 222);
                $table->text('description')->nullable();
                $table->decimal('rate', 12, 2)->default(0);
                $table->string('turnaround_time', 100)->nullable();
                $table->timestamps();

                $table->index('vendor_id');
                $table->index('test_id');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('vendor_services');
        Schema::dropIfExists('vendor_contacts');
        Schema::dropIfExists('vendors');
    }
};
