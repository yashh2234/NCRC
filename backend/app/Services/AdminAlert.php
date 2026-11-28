<?php

namespace App\Services;

use App\Models\Notification;
use Illuminate\Support\Facades\Log;

/**
 * Tells the full admins (bell + phone) what happens in the office: check ins and outs, new enquiries,
 * quotations, work orders, invoices cancelled and so on. The admin who did it is not told.
 *
 * type: team_attendance for check ins / outs, activity_<page> for the rest (tapping it opens that page).
 */
class AdminAlert
{
    public static function send(string $type, string $title, string $message = '', array $data = [], ?int $by = null): void
    {
        $by ??= auth()->id();
        try {
            foreach (AttendanceBook::admins() as $admin) {
                if ($by !== null && (int) $admin->id === (int) $by) {
                    continue;
                }
                Notification::create([
                    'user_id' => $admin->id,
                    'type' => $type,
                    'title' => mb_strimwidth($title, 0, 250, '…'),
                    'message' => $message === '' ? null : mb_strimwidth($message, 0, 400, '…'),
                    'data' => $data ?: null,
                    'created_at' => now(),
                ]);
            }
        } catch (\Throwable $e) {
            // A notification must never stop the save it is about
            Log::warning('Admin alert not made', ['type' => $type, 'error' => $e->getMessage()]);
        }
    }

    /** "Rahul Sharma" of the signed-in user, for the message */
    public static function who(): string
    {
        return auth()->user()?->name ?: 'Someone';
    }
}
