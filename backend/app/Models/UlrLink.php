<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class UlrLink extends Model
{
    protected $table = 'ulr_link';
    public $timestamps = false;
    protected $fillable = [
        'uid_no',
        'ulr_no',
        'date',
        'ndate',
        'name_of_department',
        'name_of_agency',
        'name_of_project',
        'sample_details',
        'qty',
        'parameters',
        'testing_period',
        'sample_received_date',
        'report_dispatch_date',
        'bill_details',
        'signature_remark',
    ];

    /** Old-software text columns are NOT NULL without defaults */
    public const TEXT_COLUMNS = [
        'uid_no', 'ulr_no', 'ndate', 'name_of_department', 'name_of_agency', 'name_of_project', 'sample_details',
        'qty', 'parameters', 'testing_period', 'bill_details', 'signature_remark',
    ];

    protected static function booted(): void
    {
        // New rows: empty text instead of NULL, ndate (dd/mm/yyyy) from date, empty dates as NULL
        static::creating(function (UlrLink $link): void {
            foreach (self::TEXT_COLUMNS as $column) {
                $link->{$column} = (string) ($link->{$column} ?? '');
            }
            if ($link->ndate === '' && $link->date) {
                $link->ndate = self::dmy((string) $link->date);
            }
            foreach (['sample_received_date', 'report_dispatch_date'] as $column) {
                if (blank($link->{$column})) {
                    $link->{$column} = null;
                }
            }
        });
    }

    /** 2026-01-31 → 31/01/2026 (the old software's ndate column) */
    public static function dmy(string $date): string
    {
        return preg_match('/^(\d{4})-(\d{2})-(\d{2})/', $date, $m) ? "$m[3]/$m[2]/$m[1]" : '';
    }
}
