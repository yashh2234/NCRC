<?php

namespace App\Console\Commands;

use App\Services\AttendanceBook;
use Illuminate\Console\Command;

class AttendanceCloseCommand extends Command
{
    protected $signature = 'attendance:close';

    protected $description = 'End the attendance of earlier days that was left without a check out';

    public function handle(AttendanceBook $book): int
    {
        $this->info('Closed: '.$book->closeForgotten());

        return self::SUCCESS;
    }
}
