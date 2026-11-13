<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('client_registration') || Schema::hasColumn('client_registration', 'payment_received_date')) {
            return;
        }

        Schema::table('client_registration', function (Blueprint $table): void {
            $table->string('payment_received_date')->nullable();
        });
    }

    public function down(): void
    {
        if (Schema::hasTable('client_registration') && Schema::hasColumn('client_registration', 'payment_received_date')) {
            Schema::table('client_registration', function (Blueprint $table): void {
                $table->dropColumn('payment_received_date');
            });
        }
    }
};
