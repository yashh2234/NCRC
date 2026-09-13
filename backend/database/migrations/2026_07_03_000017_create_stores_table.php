<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('stores')) {
            Schema::create('stores', function (Blueprint $table) {
                $table->increments('id');
                $table->string('name', 255);
                $table->integer('active')->default(1);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('stores');
    }
};
