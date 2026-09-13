<?php

namespace Database\Seeders;

use App\Models\CubeReport;
use App\Models\LegacyGroup;
use App\Models\Registration;
use App\Models\Report;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        \App\Services\WorkflowEngine::seedDefaultWorkflow();

        User::query()->updateOrCreate([
            'email' => 'admin@admin.com',
        ], [
            'username' => 'super admin',
            'firstname' => 'super',
            'lastname' => 'admin',
            'phone' => '',
            'gender' => 1,
            'is_admin' => true,
            'password' => 'password',
        ]);

        $this->call(LegacyGroupSeeder::class);

        $superAdmin = User::query()->where('email', 'admin@admin.com')->first();

        if ($superAdmin) {
            DB::table('user_group')->updateOrInsert(
                ['user_id' => $superAdmin->id],
                ['group_id' => 1],
            );
        }

        Registration::query()->create([
            'uid_no' => 'REG-2026-0001',
            'received_date' => now()->toDateString(),
            'agency_name' => 'Legacy Works Agency',
            'reporting_address' => 'Main Office, Sample City',
            'mobile_no' => '09000000001',
            'name_of_work' => 'Concrete cube testing',
            'sample_details' => 'First sample migrated from the legacy intake flow.',
            'total_payment' => 2500,
            'advance_payment' => 1500,
            'balance_dues' => 1000,
            'payment_followup' => 'Call tomorrow',
            'remark' => 'Seeded record',
            'qty' => '3',
            'assign_to' => 'lab',
        ]);

        Registration::query()->create([
            'uid_no' => 'REG-2026-0002',
            'received_date' => now()->subDay()->toDateString(),
            'agency_name' => 'Bridge Build Ltd',
            'reporting_address' => 'North Industrial Estate',
            'mobile_no' => '09000000002',
            'name_of_work' => 'Bitumen core test',
            'sample_details' => 'Pending payment record for the billing queue.',
            'total_payment' => 1800,
            'advance_payment' => 1800,
            'balance_dues' => 0,
            'payment_followup' => 'Settled',
            'remark' => 'Seeded record',
            'qty' => '2',
            'assign_to' => 'lab',
        ]);

        Report::query()->create([
            'iReportId' => 1,
            'uid_no' => 'REG-2026-0001',
            'ulr_no' => 'NCS/LAB/2026/00001',
            'customer_details' => 'Sample customer details for cube testing',
            'agency_name' => 'Legacy Works Agency',
            'reference_no' => 'REF-001',
            'material_details' => 'Concrete cube',
            'source_location' => 'Main Office, Sample City',
            'work_order_no' => 'WO-001',
            'sample_date' => now()->subDays(3)->toDateString(),
            'sample_tested_date' => now()->toDateString(),
            'dispatch_date' => now()->toDateString(),
            'sampled_by' => 'Inspector A',
            'environment_condition' => 'Normal',
            'report_type' => 'cc_cube',
            'status' => 'Pending',
            'user_id' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        CubeReport::query()->create([
            'iReportId' => 1,
            'uid_no' => 'REG-2026-0001',
            'location' => 'Main Office, Sample City',
            'size_of_cube' => '150',
            'date_of_casting' => now()->subDays(3)->toDateString(),
            'date_of_testing' => now()->toDateString(),
            'age_of_specimen' => '28',
            'avg_comp_strength' => '0',
            'is_code_comp_strength' => '0',
            'load_1' => '0',
            'load_2' => '0',
            'load_3' => '0',
            'comp_strength_1' => '0',
            'comp_strength_2' => '0',
            'comp_strength_3' => '0',
            'set_count' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
