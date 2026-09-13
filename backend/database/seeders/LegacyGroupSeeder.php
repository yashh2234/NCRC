<?php

namespace Database\Seeders;

use App\Models\LegacyGroup;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class LegacyGroupSeeder extends Seeder
{
    public function run(): void
    {
        $groups = [
            1 => [
                'group_name' => 'Administrator',
                'permissions' => [
                    'createUser', 'updateUser', 'viewUser', 'deleteUser',
                    'createGroup', 'updateGroup', 'viewGroup', 'deleteGroup',
                    'createBilling', 'updateBilling', 'viewBilling', 'deleteBilling',
                    'createRegistration', 'updateRegistration', 'viewRegistration', 'deleteRegistration',
                    'createOrder', 'updateOrder', 'viewOrder', 'deleteOrder',
                    'viewReports', 'updateCompany', 'viewProfile', 'updateSetting',
                ],
            ],
            6 => [
                'group_name' => 'LAB employee',
                'permissions' => ['viewRegistration', 'createOrder', 'updateOrder', 'viewOrder', 'viewProfile', 'updateSetting'],
            ],
            7 => [
                'group_name' => 'HR Group',
                'permissions' => [
                    'createUser', 'updateUser', 'viewUser', 'createGroup', 'updateGroup', 'viewGroup',
                    'createBilling', 'updateBilling', 'viewBilling', 'createRegistration', 'updateRegistration',
                    'viewRegistration', 'createOrder', 'updateOrder', 'viewOrder', 'updateCompany',
                    'viewProfile', 'updateSetting',
                ],
            ],
            8 => [
                'group_name' => 'registerar',
                'permissions' => ['createBilling', 'updateBilling', 'viewBilling', 'createRegistration', 'updateRegistration', 'viewRegistration', 'createOrder', 'updateOrder', 'viewOrder', 'deleteOrder', 'viewProfile'],
            ],
            9 => [
                'group_name' => 'accounts',
                'permissions' => ['createBilling', 'updateBilling', 'viewBilling', 'createRegistration', 'updateRegistration', 'viewRegistration', 'updateCompany', 'viewProfile', 'updateSetting'],
            ],
        ];

        foreach ($groups as $id => $group) {
            LegacyGroup::query()->updateOrCreate(
                ['id' => $id],
                [
                    'group_name' => $group['group_name'],
                    'permission' => serialize($group['permissions']),
                ],
            );
        }

        $superAdmin = User::query()->where('email', 'admin@admin.com')->first();

        if ($superAdmin) {
            DB::table('user_group')->updateOrInsert(
                ['user_id' => $superAdmin->id],
                ['group_id' => 1],
            );
        }
    }
}