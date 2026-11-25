<?php

namespace App\Services;

use App\Models\Holiday;
use App\Models\HrSetting;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/** Indian dates: which days the office is closed, and for whom. */
class WorkCalendar
{
    public const ZONE = 'Asia/Kolkata';

    private ?array $settings = null;

    public static function today(): string
    {
        return now(self::ZONE)->toDateString();
    }

    /** The UTC moments an Indian date range starts and ends (end not included) */
    public static function bounds(string $from, string $to): array
    {
        return [Carbon::parse($from, self::ZONE)->utc(), Carbon::parse($to, self::ZONE)->addDay()->utc()];
    }

    /** @return string[] */
    public static function dates(string $from, string $to): array
    {
        $dates = [];
        for ($day = Carbon::parse($from, 'UTC'), $end = Carbon::parse($to, 'UTC'); $day <= $end; $day->addDay()) {
            $dates[] = $day->toDateString();
        }

        return $dates;
    }

    public function settings(): array
    {
        return $this->settings ??= HrSetting::values();
    }

    public function isWeeklyOff(string $date): bool
    {
        $day = Carbon::parse($date, 'UTC');

        return in_array($day->dayOfWeek, $this->settings()['weekly_off'], true)
            || ($day->dayOfWeek === Carbon::SATURDAY && in_array((int) ceil($day->day / 7), $this->settings()['saturdays_off'], true));
    }

    /** @return array<string, string> date => name of the office holidays */
    public function holidays(string $from, string $to): array
    {
        return Holiday::query()->where('type', 'holiday')->whereBetween('date', [$from, $to])->orderBy('date')->get()
            ->groupBy(fn (Holiday $h) => $h->date->toDateString())
            ->map(fn ($list) => $list->pluck('name')->implode(', '))->all();
    }

    /** @return array<int, array<string, string>> user id => date => name of the optional holidays users chose */
    public function optionalPicks(string $from, string $to): array
    {
        $picks = [];
        $rows = DB::table('optional_holiday_picks as p')->join('holidays as h', 'h.id', '=', 'p.holiday_id')
            ->where('h.type', 'optional')->whereBetween('h.date', [$from, $to])->get(['p.user_id', 'h.date', 'h.name']);
        foreach ($rows as $row) {
            $picks[(int) $row->user_id][substr((string) $row->date, 0, 10)] = $row->name;
        }

        return $picks;
    }

    /** @return string[] the days of the range this user is expected to work */
    public function workingDays(int $userId, string $from, string $to): array
    {
        $closed = $this->holidays($from, $to) + ($this->optionalPicks($from, $to)[$userId] ?? []);

        return array_values(array_filter(self::dates($from, $to), fn (string $d) => ! isset($closed[$d]) && ! $this->isWeeklyOff($d)));
    }
}
