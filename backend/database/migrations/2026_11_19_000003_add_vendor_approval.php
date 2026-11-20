<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Vendors need admin approval before they can be picked for outsourcing,
 * and outsource assignments now link to a registered vendor.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vendors', function (Blueprint $table): void {
            if (! Schema::hasColumn('vendors', 'approval_status')) {
                $table->string('approval_status', 20)->default('pending')->after('is_active');
            }
            if (! Schema::hasColumn('vendors', 'approved_by')) {
                $table->unsignedBigInteger('approved_by')->nullable()->after('approval_status');
            }
            if (! Schema::hasColumn('vendors', 'approved_at')) {
                $table->timestamp('approved_at')->nullable()->after('approved_by');
            }
        });

        // Vendors that already existed were added before approval was required.
        DB::table('vendors')->whereNull('approved_at')->update(['approval_status' => 'approved', 'approved_at' => now()]);

        Schema::table('outsource_assignments', function (Blueprint $table): void {
            if (! Schema::hasColumn('outsource_assignments', 'vendor_id')) {
                $table->unsignedBigInteger('vendor_id')->nullable()->after('registration_id');
                $table->index('vendor_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('outsource_assignments', function (Blueprint $table): void {
            $table->dropIndex(['vendor_id']);
            $table->dropColumn('vendor_id');
        });
        Schema::table('vendors', function (Blueprint $table): void {
            $table->dropColumn(['approval_status', 'approved_by', 'approved_at']);
        });
    }
};
