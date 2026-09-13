<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\UserActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TrackingController extends Controller
{
    public function ping(Request $request): JsonResponse
    {
        $user = $request->user();
        $user->forceFill(['last_activity_at' => now()])->save();

        return response()->json(['ok' => true]);
    }

    public function page(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'page' => ['required', 'string', 'max:100'],
        ]);

        UserActivity::query()->create([
            'user_id' => $request->user()->id,
            'action' => 'page_visit',
            'module' => $validated['page'],
            'ip_address' => $request->ip(),
            'created_at' => now(),
        ]);

        return response()->json(['ok' => true]);
    }

    public function summary(Request $request): JsonResponse
    {
        $onlineThreshold = now()->subMinutes(5);

        $onlineUsers = User::query()
            ->where('last_activity_at', '>=', $onlineThreshold)
            ->where('is_active', true)
            ->get(['id', 'firstname', 'lastname', 'username', 'last_activity_at'])
            ->map(fn (User $u): array => [
                'id' => $u->id,
                'name' => $u->name,
                'last_activity_at' => optional($u->last_activity_at)->diffForHumans(),
            ]);

        $todayActiveUsers = UserActivity::query()
            ->where('action', '!=', 'page_visit')
            ->whereDate('created_at', today())
            ->distinct('user_id')
            ->count('user_id');

        $todayActivities = UserActivity::query()
            ->where('action', '!=', 'page_visit')
            ->whereDate('created_at', today())
            ->count();

        $userActivityToday = User::query()
            ->whereHas('activities', fn ($q) => $q->where('action', '!=', 'page_visit')->whereDate('created_at', today()))
            ->withCount(['activities as today_actions' => fn ($q) => $q->where('action', '!=', 'page_visit')->whereDate('created_at', today())])
            ->limit(10)
            ->get(['id', 'firstname', 'lastname', 'username'])
            ->map(fn (User $u): array => [
                'id' => $u->id,
                'name' => $u->name,
                'today_actions' => (int) $u->today_actions,
            ]);

        $reportGenerations = UserActivity::query()
            ->where('action', 'report_generated')
            ->whereDate('created_at', today())
            ->count();

        $sampleRegistrations = UserActivity::query()
            ->where('action', 'sample_registered')
            ->whereDate('created_at', today())
            ->count();

        return response()->json([
            'online_users' => $onlineUsers,
            'online_count' => $onlineUsers->count(),
            'today_active_users' => $todayActiveUsers,
            'today_activities' => $todayActivities,
            'user_activity_today' => $userActivityToday,
            'today_reports_generated' => $reportGenerations,
            'today_samples_registered' => $sampleRegistrations,
        ]);
    }

    public function userActivity(Request $request, ?int $userId = null): JsonResponse
    {
        $id = $userId ?? $request->user()->id;

        $activities = UserActivity::query()
            ->where('user_id', $id)
            ->where('action', '!=', 'page_visit')
            ->orderByDesc('created_at')
            ->limit(50)
            ->get()
            ->map(fn (UserActivity $a): array => [
                'id' => $a->id,
                'action' => $a->action,
                'module' => $a->module,
                'details' => $a->details,
                'ip_address' => $a->ip_address,
                'created_at' => optional($a->created_at)->format('d M Y H:i'),
                'time_ago' => $a->created_at?->diffForHumans(),
            ]);

        $user = User::query()->find($id, ['id', 'firstname', 'lastname', 'username', 'last_activity_at', 'is_active', 'is_admin']);

        $totalToday = UserActivity::query()->where('user_id', $id)->where('action', '!=', 'page_visit')->whereDate('created_at', today())->count();
        $lastSeen = $user?->last_activity_at;

        return response()->json([
            'user' => $user ? [
                'id' => $user->id,
                'name' => $user->name,
                'username' => $user->username,
                'is_active' => (bool) $user->is_active,
                'is_admin' => (bool) $user->is_admin,
                'last_activity_at' => optional($lastSeen)->diffForHumans(),
                'online' => $lastSeen && $lastSeen >= now()->subMinutes(5),
            ] : null,
            'activities' => $activities,
            'total_today' => $totalToday,
        ]);
    }
}
