<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/** Mails sent from the app show "Namotech" as the sender, as in Thunderbird (they showed the old default "NCRC"). */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('mail_accounts')) {
            DB::table('mail_accounts')->whereIn('from_name', ['NCRC', ''])->update(['from_name' => 'Namotech']);
        }
    }

    public function down(): void
    {
        // The name can be changed in Mail > Account Settings
    }
};
