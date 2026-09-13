<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuditLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = AuditLog::query()->with('user:id,firstname,lastname,username');

        if ($request->query('action')) {
            $query->where('action', $request->query('action'));
        }

        if ($request->query('user_id')) {
            $query->where('user_id', $request->query('user_id'));
        }

        $logs = $query->orderByDesc('created_at')->limit(100)->get()->map(fn (AuditLog $log): array => [
            'id' => $log->id,
            'user_id' => $log->user_id,
            'user_name' => $log->user?->name ?? 'System',
            'action' => $log->action,
            'model_type' => $log->model_type,
            'model_id' => $log->model_id,
            'description' => $log->description,
            'old_values' => $log->old_values,
            'new_values' => $log->new_values,
            'ip_address' => $log->ip_address,
            'created_at' => optional($log->created_at)->format('d M Y H:i'),
        ]);

        return response()->json(['data' => $logs]);
    }

    public static function record(
        string $action,
        ?string $modelType = null,
        ?int $modelId = null,
        ?string $description = null,
        ?array $oldValues = null,
        ?array $newValues = null,
    ): void {
        $request = request();
        AuditLog::query()->create([
            'user_id' => $request->user()?->id,
            'action' => $action,
            'model_type' => $modelType,
            'model_id' => $modelId,
            'description' => $description,
            'old_values' => $oldValues ? json_encode($oldValues) : null,
            'new_values' => $newValues ? json_encode($newValues) : null,
            'ip_address' => $request->ip(),
            'user_agent' => substr((string) $request->userAgent(), 0, 255),
            'created_at' => now(),
        ]);
    }
}
