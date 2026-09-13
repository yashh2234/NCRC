<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('outsource_assignments', function (Blueprint $table): void {
            $table->decimal('advance_payment', 12, 2)->default(0)->after('agreed_amount');
            $table->decimal('remaining_payment', 12, 2)->default(0)->after('advance_payment');
        });
    }

    public function down(): void
    {
        Schema::table('outsource_assignments', function (Blueprint $table): void {
            $table->dropColumn(['advance_payment', 'remaining_payment']);
        });
    }
};
