<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('outsource_assignments', function (Blueprint $table): void {
            if (!Schema::hasColumn('outsource_assignments', 'vendor_report')) {
                $table->string('vendor_report', 500)->nullable()->after('notes');
            }
        });
    }

    public function down(): void
    {
        Schema::table('outsource_assignments', function (Blueprint $table): void {
            $table->dropColumn('vendor_report');
        });
    }
};
