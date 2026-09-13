<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('ulr_link')) {
            Schema::create('ulr_link', function (Blueprint $table) {
                $table->increments('id');
                $table->string('uid_no', 222);
                $table->string('ulr_no', 222);
                $table->date('date');
                $table->string('ndate', 222)->default('');
                $table->string('name_of_department', 222)->default('');
                $table->string('name_of_agency', 222)->default('');
                $table->string('name_of_project', 888)->default('');
                $table->string('sample_details', 222)->default('');
                $table->string('qty', 222)->default('');
                $table->string('parameters', 222)->default('');
                $table->string('testing_period', 222)->default('');
                $table->date('sample_received_date')->nullable();
                $table->date('report_dispatch_date')->nullable();
                $table->string('bill_details', 222)->default('');
                $table->string('signature_remark', 222)->default('');
            });
        }

        if (!Schema::hasTable('ulr_copy')) {
            Schema::create('ulr_copy', function (Blueprint $table) {
                $table->increments('id');
                $table->string('uid_no', 222);
                $table->string('ulr_no', 222);
                $table->dateTime('date')->useCurrent();
                $table->string('name_of_department', 222)->default('');
                $table->string('name_of_agency', 222)->default('');
                $table->string('name_of_project', 222)->default('');
                $table->string('sample_details', 222)->default('');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('ulr_copy');
        Schema::dropIfExists('ulr_link');
    }
};
