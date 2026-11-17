<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Tender extends Model
{
    /** API (camelCase, as used by the frontend) => database column. */
    public const FIELD_MAP = [
        'tenderId' => 'tender_id',
        'title' => 'title',
        'department' => 'department',
        'portal' => 'portal',
        'location' => 'location',
        'value' => 'value',
        'emd' => 'emd',
        'fee' => 'fee',
        'openDate' => 'open_date',
        'preBidDate' => 'pre_bid_date',
        'queryDate' => 'query_date',
        'closingDate' => 'closing_date',
        'openingDate' => 'opening_date',
        'eligibility' => 'eligibility',
        'decision' => 'decision',
        'submissionStatus' => 'submission_status',
        'responsible' => 'responsible',
        'requirements' => 'requirements',
        'tenderLink' => 'tender_link',
        'driveLink' => 'drive_link',
        'remarks' => 'remarks',
    ];

    public const SR_PREFIX = 'NCS/TENDER';

    protected $fillable = [
        'sr_no', 'tender_id', 'title', 'department', 'portal', 'location', 'value', 'emd', 'fee',
        'open_date', 'pre_bid_date', 'query_date', 'closing_date', 'opening_date',
        'eligibility', 'decision', 'submission_status', 'responsible', 'requirements',
        'tender_link', 'drive_link', 'remarks', 'created_by', 'updated_by',
    ];

    /** Next free Sr. No. for the given year, e.g. NCS/TENDER/2026/007. */
    public static function nextSrNo(?int $year = null): string
    {
        $year ??= (int) date('Y');
        $prefix = self::SR_PREFIX . "/{$year}/";
        $max = self::query()
            ->where('sr_no', 'like', $prefix . '%')
            ->pluck('sr_no')
            ->reduce(fn (int $highest, string $srNo): int => max($highest, (int) substr($srNo, strlen($prefix))), 0);

        return $prefix . str_pad((string) ($max + 1), 3, '0', STR_PAD_LEFT);
    }

    /** Shape used by the frontend Tender type. */
    public function toApi(): array
    {
        $data = ['id' => $this->id, 'srNo' => $this->sr_no];
        foreach (self::FIELD_MAP as $key => $column) {
            $data[$key] = (string) ($this->{$column} ?? '');
        }

        return $data;
    }
}
