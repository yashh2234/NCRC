<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('client_registration', function (Blueprint $table): void {
            if (!Schema::hasColumn('client_registration', 'job_id')) {
                $table->unsignedBigInteger('job_id')->nullable()->after('iClientId');
                $table->index('job_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('client_registration', function (Blueprint $table): void {
            $table->dropColumn('job_id');
        });
    }
};
