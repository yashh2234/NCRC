<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** What the proposal AI knows about the company: pages of the website, and facts approved by an admin. */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('company_knowledge')) {
            return;
        }
        Schema::create('company_knowledge', function (Blueprint $table): void {
            $table->id();
            $table->string('kind', 10)->index();
            $table->string('title', 200);
            $table->text('content');
            $table->string('url', 190)->nullable()->unique();
            $table->string('status', 10)->default('approved')->index();
            $table->unsignedInteger('created_by')->nullable();
            $table->unsignedInteger('decided_by')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('company_knowledge');
    }
};
