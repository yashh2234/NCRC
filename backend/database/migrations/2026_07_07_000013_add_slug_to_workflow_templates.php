<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('workflow_templates', function (Blueprint $table): void {
            $table->string('slug', 255)->unique()->nullable()->after('name');
        });
    }

    public function down(): void
    {
        Schema::table('workflow_templates', function (Blueprint $table): void {
            $table->dropColumn('slug');
        });
    }
};
