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
        'contactName' => 'contact_name',
        'contactDesignation' => 'contact_designation',
        'contactPhone' => 'contact_phone',
        'portal' => 'portal',
        'location' => 'location',
        'value' => 'value',
        'bidValue' => 'bid_value',
        'bidType' => 'bid_type',
        'emd' => 'emd',
        'emdDeposited' => 'emd_deposited',
        'emdMode' => 'emd_mode',
        'fee' => 'fee',
        'openDate' => 'open_date',
        'preBidDate' => 'pre_bid_date',
        'queryDate' => 'query_date',
        'closingDate' => 'closing_date',
        'closingTime' => 'closing_time',
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
        'sr_no', 'tender_id', 'title', 'department', 'contact_name', 'contact_designation', 'contact_phone', 'portal', 'location', 'value', 'bid_value', 'bid_type', 'emd', 'emd_deposited', 'emd_mode', 'fee',
        'open_date', 'pre_bid_date', 'query_date', 'closing_date', 'closing_time', 'opening_date',
        'eligibility', 'decision', 'submission_status', 'responsible', 'requirements',
        'tender_link', 'drive_link', 'remarks', 'created_by', 'updated_by',
        'ai_summary', 'ai_summary_file', 'ai_summary_model', 'ai_summary_at', 'ai_summary_by',
        'document_checks',
    ];

    protected $casts = [
        'ai_summary' => 'array',
        'ai_summary_at' => 'datetime',
        'document_checks' => 'array',
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

    /** A document of the checklist is known by its text, so ticks survive a new analysis that words it the same. */
    public static function checkKey(string $document): string
    {
        $text = preg_replace('/\s*\((?:pp?\.|pages?)\s*[^)]*\)/i', '', $document);

        return md5(trim((string) preg_replace('/[^\p{L}\p{N}]+/u', ' ', mb_strtolower((string) $text))));
    }

    /** @return array<int, array{by: ?string, at: ?string}|null> who ticked each of the summary's documents, null = not ticked */
    public function documentChecks(): array
    {
        $checks = $this->document_checks ?? [];

        return array_map(fn ($document) => $checks[self::checkKey((string) $document)] ?? null, array_values($this->ai_summary['documents_required'] ?? []));
    }

    /** Shape used by the frontend Tender type. */
    public function toApi(): array
    {
        $data = ['id' => $this->id, 'srNo' => $this->sr_no];
        foreach (self::FIELD_MAP as $key => $column) {
            $data[$key] = (string) ($this->{$column} ?? '');
        }
        $data['hasSummary'] = ! empty($this->ai_summary);
        $checks = $this->documentChecks();
        $data['docsTotal'] = count($checks);
        $data['docsDone'] = count(array_filter($checks));

        return $data;
    }
}
