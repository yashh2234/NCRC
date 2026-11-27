<?php

namespace App\Models\Concerns;

use App\Services\Timeline;

/** The record's history (History button): created, what changed, approvals, payments, cancel, deleted. */
trait RecordsTimeline
{
    public static function bootRecordsTimeline(): void
    {
        static::created(fn ($m) => Timeline::created($m, class_basename($m)));
        static::updated(fn ($m) => Timeline::updated($m, class_basename($m)));
        static::deleted(fn ($m) => Timeline::deleted($m, class_basename($m)));
    }
}
