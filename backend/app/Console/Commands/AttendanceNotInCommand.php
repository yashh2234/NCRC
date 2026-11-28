<?php

namespace App\Console\Commands;

use App\Services\AdminAlert;
use App\Services\AttendanceBook;
use App\Services\WorkCalendar;
use Illuminate\Console\Command;

/** At 11:00 on working days: admins get the names of those not checked in yet (leave and on-duty are left out) */
class AttendanceNotInCommand extends Command
{
    protected $signature = 'attendance:not-in';

    protected $description = 'Tell the admins who has not checked in by 11:00';

    public function handle(AttendanceBook $book): int
    {
        // null on a holiday or weekly off
        $groups = $book->daySummary(WorkCalendar::today());
        if ($groups === null || ! $groups['not_in']) {
            return self::SUCCESS;
        }
        $count = count($groups['not_in']);
        AdminAlert::send('team_not_in', "{$count} not checked in by 11:00", implode(', ', $groups['not_in']), [], 0);

        return self::SUCCESS;
    }
}
