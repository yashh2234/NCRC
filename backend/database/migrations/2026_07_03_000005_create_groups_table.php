<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('groups')) {
            return;
        }

        Schema::create('groups', function (Blueprint $table): void {
            $table->increments('id');
            $table->string('group_name');
            $table->text('permission');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('groups');
    }
};