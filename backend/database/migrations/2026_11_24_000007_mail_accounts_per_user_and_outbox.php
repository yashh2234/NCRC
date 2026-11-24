<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Several mail accounts: owner_id null = shared office mailbox (everyone with Mail access), else only that user's.
 * default_bcc is filled into every new mail of the account. mail_outbox holds mails while they are being sent;
 * their text and files are in storage/app/private/mail-outbox/{id}.
 */
return new class extends Migration
{
    private const DEFAULT_BCC = 'namotech.omendra@gmail.com, manager@namotech.in';

    public function up(): void
    {
        if (! Schema::hasColumn('mail_accounts', 'owner_id')) {
            Schema::table('mail_accounts', function (Blueprint $table): void {
                $table->unsignedBigInteger('owner_id')->nullable()->index();
            });
        }
        if (! Schema::hasColumn('mail_accounts', 'default_bcc')) {
            Schema::table('mail_accounts', function (Blueprint $table): void {
                $table->string('default_bcc', 1000)->default('');
            });
            DB::table('mail_accounts')->update(['default_bcc' => self::DEFAULT_BCC]);
        }

        if (! Schema::hasTable('mail_outbox')) {
            Schema::create('mail_outbox', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('user_id')->index();
                $table->unsignedBigInteger('mail_account_id');
                $table->string('subject', 500)->default('');
                $table->string('status', 20)->default('queued')->index();
                $table->unsignedTinyInteger('attempts')->default(0);
                $table->string('error', 500)->nullable();
                $table->boolean('in_sent')->default(false);
                $table->boolean('in_drafts')->default(false);
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('mail_outbox');
        Schema::table('mail_accounts', function (Blueprint $table): void {
            $table->dropIndex(['owner_id']);
            $table->dropColumn(['owner_id', 'default_bcc']);
        });
    }
};
