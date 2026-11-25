<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// SLA Monitoring — every 5 minutes
Schedule::command('jobs:check-sla')->everyFiveMinutes()->withoutOverlapping();

// Deadline reminders — every hour
Schedule::command('jobs:send-reminders')->hourly()->withoutOverlapping();

// Auto-transition completed stages — every 15 minutes
Schedule::command('jobs:auto-transition')->everyFifteenMinutes()->withoutOverlapping();

// Mails that could not be sent at once (closed tab, connection trouble)
Schedule::command('mail:outbox')->everyMinute()->withoutOverlapping(30);

// Mail accounts: bell notifications for new mail (the top-bar poll also does this while people are online).
Schedule::command('mail:check')->everyFiveMinutes()->withoutOverlapping();

// Attendance: check outs that were forgotten; the admins' summary at 11:00 (Indian time)
Schedule::command('attendance:close')->hourly()->withoutOverlapping();
Schedule::command('attendance:summary')->dailyAt('11:00')->timezone('Asia/Kolkata');

// What the proposal AI knows from the company website
Schedule::command('knowledge:refresh')->weeklyOn(1, '03:30')->withoutOverlapping();

// Tender PDFs not read yet (closed tab, busy AI). Last in the list: reading one can take minutes.
Schedule::command('tender:analyse')->everyMinute()->withoutOverlapping(30);
