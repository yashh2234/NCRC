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
