<?php

use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * The job role is now only a label. Users who had no pages ticked opened their role's pages, and users with the
 * "admin" job role opened everything: write that onto the user, so nobody loses a page they could open.
 */
return new class extends Migration
{
    private const ROLE_PAGES = [
        'registration' => ['tenders', 'inquiries', 'registrations', 'quotations', 'work_orders', 'billing', 'due_reports'],
        'lab' => ['tenders', 'outsource', 'ulr_add', 'ulr_register', 'reports'],
        'report_staff' => ['tenders', 'reports', 'final_reports', 'ulr_add', 'ulr_register'],
        'technical' => ['tenders', 'reports', 'final_reports', 'work_orders', 'ulr_add', 'ulr_register'],
        'manager' => ['tenders', 'inquiries', 'registrations', 'billing', 'expenses', 'purchase_orders', 'due_reports', 'quotations', 'proposals', 'work_orders'],
        'staff' => ['tenders'],
    ];

    public function up(): void
    {
        foreach (User::query()->get() as $user) {
            if ($user->isFullAdmin()) {
                continue;
            }
            $stored = $user->getAttributes()['tracker_role'] ?? null;
            $role = $user->tracker_role ?: 'staff';
            $pages = is_array($user->allowed_modules) ? $user->allowed_modules : null;
            if ($stored === 'admin' || $role === 'admin') {
                $pages = User::FEATURE_KEYS;
            } elseif ($pages === null) {
                $pages = array_values(array_intersect(self::ROLE_PAGES[$role] ?? self::ROLE_PAGES['staff'], User::FEATURE_KEYS));
            } else {
                continue;
            }
            DB::table('users')->where('id', $user->id)->update(['allowed_modules' => json_encode(array_values(array_unique($pages)))]);
        }
    }

    public function down(): void
    {
        // The pages stay ticked: nothing to undo
    }
};
