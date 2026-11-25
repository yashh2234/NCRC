<?php

namespace App\Services;

use App\Models\LoginSession;
use App\Models\UsageDay;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/** Counts the time a user spends in the software from the pings of the browser. */
class UsageClock
{
    /** The most one ping can add; the browser pings about every 30 seconds */
    private const MAX_SECONDS = 90;

    public function ping(User $user, string $state, int $seconds, ?string $module, ?int $tokenId): void
    {
        $date = WorkCalendar::today();
        $now = now();
        UsageDay::query()->insertOrIgnore(['user_id' => $user->id, 'date' => $date, 'first_at' => $now]);

        DB::transaction(function () use ($user, $date, $now, $state, $seconds, $module): void {
            $day = UsageDay::query()->where('user_id', $user->id)->where('date', $date)->lockForUpdate()->first();
            // Two tabs or two computers at once still count only the time that passed
            $passed = $day->last_ping_at ? max(0, (int) $day->last_ping_at->diffInSeconds($now)) : $seconds;
            $add = max(0, min($seconds, $passed, self::MAX_SECONDS));
            $active = $state === 'active';

            $day->last_ping_at = $now;
            $day->{$active ? 'active_seconds' : 'idle_seconds'} += $add;
            if ($active) {
                $day->last_active_at = $now;
            }
            $day->save();

            if ($active && $add && $module) {
                DB::table('usage_modules')->upsert(
                    [['user_id' => $user->id, 'date' => $date, 'module' => $module, 'active_seconds' => $add]],
                    ['user_id', 'date', 'module'],
                    ['active_seconds' => DB::raw('active_seconds + '.$add)],
                );
            }
        });

        $user->forceFill(['last_activity_at' => $now])->saveQuietly();
        if ($tokenId) {
            LoginSession::query()->where('personal_access_token_id', $tokenId)->update(['last_seen_at' => $now]);
        }
    }
}
