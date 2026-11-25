<?php

namespace App\Console\Commands;

use App\Models\Attendance;
use App\Models\HrSetting;
use App\Services\AttendanceBook;
use App\Services\WorkCalendar;
use Illuminate\Console\Command;

/** Tells the admins in the bell who is in, on leave and not in yet. */
class AttendanceSummaryCommand extends Command
{
    protected $signature = 'attendance:summary';

    protected $description = 'Send the admins the attendance of today';

    public function handle(AttendanceBook $book): int
    {
        // Nothing to say before anyone uses the attendance, or on a closed day
        if (! HrSetting::values()['daily_summary'] || ! Attendance::query()->exists()) {
            return self::SUCCESS;
        }
        $groups = $book->daySummary(WorkCalendar::today());
        if ($groups === null) {
            return self::SUCCESS;
        }

        $text = [];
        foreach (['not_in' => 'Not in', 'on_leave' => 'On leave', 'on_duty' => 'On duty'] as $key => $label) {
            if ($groups[$key]) {
                $text[] = "{$label}: ".implode(', ', $groups[$key]);
            }
        }
        $title = 'Attendance today: '.count($groups['present']).' in, '.count($groups['on_leave']).' on leave, '.count($groups['not_in']).' not in';
        foreach (AttendanceBook::admins() as $admin) {
            $book->notify($admin->id, $title, implode(' · ', $text));
        }

        return self::SUCCESS;
    }
}
