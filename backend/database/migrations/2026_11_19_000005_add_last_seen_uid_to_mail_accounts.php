<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Highest Inbox UID already announced, so each new mail gets one bell notification. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('mail_accounts', function (Blueprint $table): void {
            if (! Schema::hasColumn('mail_accounts', 'inbox_last_uid')) {
                $table->unsignedBigInteger('inbox_last_uid')->nullable()->after('sent_folder');
            }
            if (! Schema::hasColumn('mail_accounts', 'inbox_uidvalidity')) {
                $table->unsignedBigInteger('inbox_uidvalidity')->nullable()->after('inbox_last_uid');
            }
        });
    }

    public function down(): void
    {
        Schema::table('mail_accounts', function (Blueprint $table): void {
            $table->dropColumn(['inbox_last_uid', 'inbox_uidvalidity']);
        });
    }
};
