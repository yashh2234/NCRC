<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('ulr_copy')) {
            Schema::create('ulr_copy', function (Blueprint $table): void {
                $table->bigInteger('id', true);
                $table->string('uid_no', 222)->nullable();
                $table->string('ulr_no', 222)->nullable();
                $table->timestamp('date')->useCurrent();
                $table->string('name_of_department', 222)->nullable();
                $table->string('name_of_agency', 222)->nullable();
                $table->string('name_of_project', 222)->nullable();
                $table->string('sample_details', 222)->nullable();
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('ulr_copy');
    }
};
