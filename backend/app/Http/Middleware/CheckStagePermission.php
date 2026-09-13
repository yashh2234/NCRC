<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class CheckStagePermission
{
    public function handle(Request $request, Closure $next, string $permission)
    {
        $user = Auth::user();
        if (!$user) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        if ($user->is_admin) {
            return $next($request);
        }

        $userPermissions = method_exists($user, 'legacyPermissions') ? $user->legacyPermissions() : [];

        if (!in_array($permission, $userPermissions, true)) {
            $stagePermissions = [
                'stage.inquiry' => 'create_inquiries',
                'stage.quotation' => 'create_quotations',
                'stage.work-order' => 'create_work_orders',
                'stage.registration' => 'create_registrations',
                'stage.sample-received' => 'manage_samples',
                'stage.assigned' => 'assign_jobs',
                'stage.testing' => 'perform_testing',
                'stage.report-draft' => 'create_reports',
                'stage.technical-review' => 'review_reports',
                'stage.approval' => 'approve_reports',
                'stage.billing' => 'manage_billing',
                'stage.dispatch' => 'manage_dispatch',
                'stage.completed' => 'view_completed',
            ];

            $required = $stagePermissions[$permission] ?? $permission;
            if (!in_array($required, $userPermissions, true)) {
                return response()->json(['message' => 'Forbidden: insufficient stage permissions'], 403);
            }
        }

        return $next($request);
    }
}
