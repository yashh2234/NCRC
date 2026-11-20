<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The shared office mailbox shown on the Mail page (one row). The same IMAP / SMTP
 * details Thunderbird uses; the password is stored encrypted with APP_KEY.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('mail_accounts')) {
            return;
        }

        Schema::create('mail_accounts', function (Blueprint $table): void {
            $table->id();
            $table->string('email');
            $table->string('from_name')->default('');
            $table->string('username');
            $table->text('password');
            $table->string('imap_host');
            $table->unsignedSmallInteger('imap_port')->default(993);
            $table->string('imap_encryption', 10)->default('ssl');
            $table->string('smtp_host');
            $table->unsignedSmallInteger('smtp_port')->default(465);
            $table->string('smtp_encryption', 10)->default('ssl');
            $table->string('sent_folder')->default('');
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mail_accounts');
    }
};
