<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('reports')) {
            Schema::create('reports', function (Blueprint $table): void {
                $table->bigIncrements('iReportId');
                $table->string('uid_no')->index();
                $table->string('ulr_no')->nullable();
                $table->text('customer_details');
                $table->string('agency_name');
                $table->string('reference_no')->nullable();
                $table->text('material_details')->nullable();
                $table->text('source_location')->nullable();
                $table->string('work_order_no')->nullable();
                $table->date('sample_date')->nullable();
                $table->date('sample_tested_date')->nullable();
                $table->date('dispatch_date')->nullable();
                $table->string('sampled_by')->nullable();
                $table->string('environment_condition')->nullable();
                $table->string('report_type');
                $table->string('status')->default('Pending');
                $table->string('cancel_remark')->nullable();
                $table->unsignedBigInteger('user_id')->nullable();
                $table->unsignedBigInteger('created_by')->nullable();
                $table->unsignedBigInteger('updated_by')->nullable();
                $table->unsignedBigInteger('updated_date')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('cube_reports')) {
            Schema::create('cube_reports', function (Blueprint $table): void {
                $table->bigIncrements('iCubeId');
                $table->unsignedBigInteger('iReportId');
                $table->string('uid_no')->index();
                $table->string('location')->nullable();
                $table->string('size_of_cube')->nullable();
                $table->date('date_of_casting')->nullable();
                $table->date('date_of_testing')->nullable();
                $table->string('age_of_specimen')->nullable();
                $table->string('avg_comp_strength')->nullable();
                $table->string('is_code_comp_strength')->nullable();
                $table->string('load_1')->nullable();
                $table->string('load_2')->nullable();
                $table->string('load_3')->nullable();
                $table->string('comp_strength_1')->nullable();
                $table->string('comp_strength_2')->nullable();
                $table->string('comp_strength_3')->nullable();
                $table->unsignedInteger('set_count')->default(1);
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('cube_reports');
        Schema::dropIfExists('reports');
    }
};
