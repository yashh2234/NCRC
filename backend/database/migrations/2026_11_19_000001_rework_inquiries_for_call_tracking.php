<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Inquiry menu: phone/walk-in leads with budget, work categories (from the sample test
 * category list), handover user, a sales-pipeline status and a call / follow-up log.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inquiries', function (Blueprint $table): void {
            if (!Schema::hasColumn('inquiries', 'budget')) {
                $table->string('budget', 100)->nullable()->after('source_location');
            }
            if (!Schema::hasColumn('inquiries', 'work_categories')) {
                $table->json('work_categories')->nullable()->after('budget');
            }
            if (!Schema::hasColumn('inquiries', 'next_follow_up')) {
                $table->date('next_follow_up')->nullable()->after('contacted_at');
                $table->index('next_follow_up');
            }
        });

        // The old enum (new/contacted/quoted/converted/cancelled) is replaced by the call pipeline.
        Schema::table('inquiries', function (Blueprint $table): void {
            $table->string('status', 30)->default('new')->change();
            $table->string('inquiry_type', 20)->default('phone')->change();
        });

        DB::table('inquiries')->where('status', 'contacted')->update(['status' => 'interested']);
        DB::table('inquiries')->where('status', 'quoted')->update(['status' => 'quotation_sent']);
        DB::table('inquiries')->where('status', 'converted')->update(['status' => 'won']);
        DB::table('inquiries')->where('status', 'cancelled')->update(['status' => 'lost']);

        if (!Schema::hasTable('inquiry_activities')) {
            Schema::create('inquiry_activities', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('inquiry_id');
                $table->unsignedInteger('user_id')->nullable();
                $table->string('status', 30)->nullable();
                $table->unsignedInteger('assigned_to')->nullable();
                $table->date('next_follow_up')->nullable();
                $table->text('remark')->nullable();
                $table->timestamp('created_at')->nullable();

                $table->index('inquiry_id');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('inquiry_activities');

        Schema::table('inquiries', function (Blueprint $table): void {
            $table->dropIndex(['next_follow_up']);
            $table->dropColumn(['budget', 'work_categories', 'next_follow_up']);
        });
    }
};
