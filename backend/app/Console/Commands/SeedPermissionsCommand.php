<?php

namespace App\Console\Commands;

use App\Services\PermissionRegistrar;
use Illuminate\Console\Command;

class SeedPermissionsCommand extends Command
{
    protected $signature = 'permissions:seed';
    protected $description = 'Seed default permissions and assign all to admin role';

    public function handle(): void
    {
        PermissionRegistrar::seedDefaultPermissions();
        $this->info('Default permissions seeded successfully.');

        // Auto-assign all to admin role
        $adminRole = \App\Models\LegacyGroup::find(1);
        if ($adminRole) {
            $allPerms = \App\Models\Permission::pluck('name')->toArray();
            app(PermissionRegistrar::class)->syncRolePermissions($adminRole, $allPerms);
            $this->info('All permissions assigned to Administrator role.');
        }

        $this->info('Done.');
    }
}
