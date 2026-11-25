<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/** Where an enquiry came from; the software now says "Enquiry" instead of "Inquiry". */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inquiries', function (Blueprint $table): void {
            if (! Schema::hasColumn('inquiries', 'source')) {
                $table->string('source', 40)->nullable()->after('email');
                $table->string('source_detail', 200)->nullable()->after('source');
                $table->index('source');
            }
        });

        if (Schema::hasTable('workflow_stages')) {
            DB::table('workflow_stages')->where('slug', 'inquiry')->where('name', 'Inquiry')->update(['name' => 'Enquiry']);
        }
        DB::table('inquiry_activities')->where('remark', 'Inquiry created')->update(['remark' => 'Enquiry created']);
    }

    public function down(): void
    {
        Schema::table('inquiries', function (Blueprint $table): void {
            $table->dropIndex(['source']);
            $table->dropColumn(['source', 'source_detail']);
        });
    }
};
