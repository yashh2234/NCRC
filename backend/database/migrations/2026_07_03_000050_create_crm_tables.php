<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('clients')) {
            Schema::create('clients', function (Blueprint $table): void {
                $table->id();
                $table->string('uid', 255)->nullable()->unique()->comment('Client code');
                $table->string('company_name', 255);
                $table->string('contact_person', 255)->nullable();
                $table->string('phone', 50)->nullable();
                $table->string('mobile', 50)->nullable();
                $table->string('email', 255)->nullable();
                $table->string('website', 255)->nullable();
                $table->text('address')->nullable();
                $table->string('city', 100)->nullable();
                $table->string('state', 100)->nullable();
                $table->string('pincode', 20)->nullable();
                $table->string('gst_no', 50)->nullable();
                $table->string('pan_no', 50)->nullable();
                $table->string('category', 100)->nullable()->comment('Government, Private, PSU, etc');
                $table->text('notes')->nullable();
                $table->boolean('is_active')->default(true);
                $table->unsignedBigInteger('created_by')->nullable();
                $table->unsignedBigInteger('updated_by')->nullable();
                $table->timestamps();
                $table->softDeletes();

                $table->index('company_name');
                $table->index('phone');
                $table->index('mobile');
                $table->index('email');
            });
        }

        if (!Schema::hasTable('client_contacts')) {
            Schema::create('client_contacts', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('client_id')->constrained('clients')->cascadeOnDelete();
                $table->string('name', 255);
                $table->string('designation', 255)->nullable();
                $table->string('phone', 50)->nullable();
                $table->string('mobile', 50)->nullable();
                $table->string('email', 255)->nullable();
                $table->boolean('is_primary')->default(false);
                $table->text('notes')->nullable();
                $table->timestamps();

                $table->index('client_id');
            });
        }

        if (!Schema::hasTable('client_communications')) {
            Schema::create('client_communications', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('client_id')->constrained('clients')->cascadeOnDelete();
                $table->string('type', 50)->default('note')->comment('call, email, meeting, note');
                $table->string('subject', 255)->nullable();
                $table->text('body')->nullable();
                $table->unsignedBigInteger('contact_id')->nullable();
                $table->unsignedBigInteger('user_id')->nullable();
                $table->timestamp('communication_date')->nullable();
                $table->timestamps();

                $table->index('client_id');
                $table->index('type');
                $table->index('communication_date');
            });
        }

        // Add client_id to existing client_registration table
        if (Schema::hasTable('client_registration') && !Schema::hasColumn('client_registration', 'client_id')) {
            Schema::table('client_registration', function (Blueprint $table): void {
                $table->unsignedBigInteger('client_id')->nullable();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('client_registration', 'client_id')) {
            Schema::table('client_registration', function (Blueprint $table): void {
                $table->dropForeign(['client_id']);
                $table->dropColumn('client_id');
            });
        }
        Schema::dropIfExists('client_communications');
        Schema::dropIfExists('client_contacts');
        Schema::dropIfExists('clients');
    }
};
