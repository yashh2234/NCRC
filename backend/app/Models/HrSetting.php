<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class HrSetting extends Model
{
    public const DEFAULTS = [
        // Weekly off: days of the week (0 = Sunday) and which Saturdays of the month
        'weekly_off' => [0],
        'saturdays_off' => [],
        'optional_limit' => 2,
        // Users who are not in the attendance lists
        'hidden_users' => [],
        'office_lat' => null,
        'office_lng' => null,
        'office_radius' => 200,
        'daily_summary' => false,
        // Checking in after this (first check in of a working day) tells the admins "late"
        'office_start' => '09:30',
    ];

    protected $table = 'hr_settings';

    protected $primaryKey = 'key';

    protected $keyType = 'string';

    public $incrementing = false;

    public $timestamps = false;

    protected $fillable = ['key', 'value'];

    protected $casts = ['value' => 'json'];

    /** @return array<string, mixed> */
    public static function values(): array
    {
        return array_merge(self::DEFAULTS, self::query()->get()->pluck('value', 'key')->only(array_keys(self::DEFAULTS))->all());
    }

    public static function put(array $values): void
    {
        foreach (array_intersect_key($values, self::DEFAULTS) as $key => $value) {
            self::query()->updateOrCreate(['key' => $key], ['value' => $value]);
        }
    }
}
