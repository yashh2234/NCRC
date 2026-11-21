<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Proposal extends Model
{
    protected $fillable = [
        'ref_no', 'proposal_date', 'title', 'project_name', 'submitted_to',
        'sections', 'fee_rows', 'fee_note', 'supporting_info',
        'signatory_name', 'signatory_designation', 'brief',
        'created_by', 'updated_by',
    ];

    protected $casts = [
        'proposal_date' => 'date',
        'sections' => 'array',
        'fee_rows' => 'array',
    ];

    public function toApi(bool $full = true): array
    {
        $rows = is_array($this->fee_rows) ? $this->fee_rows : [];
        $data = [
            'id' => $this->id,
            'ref_no' => $this->ref_no ?? '',
            'proposal_date' => $this->proposal_date?->format('Y-m-d') ?? '',
            'title' => $this->title,
            'project_name' => $this->project_name ?? '',
            'submitted_to' => $this->submitted_to ?? '',
            'total' => array_sum(array_map(fn ($r) => (float) ($r['amount'] ?? 0), $rows)),
            'updated_at' => $this->updated_at?->toIso8601String(),
            'updated_by' => $this->updated_by ? User::find($this->updated_by)?->name : null,
        ];

        if ($full) {
            $data += [
                'sections' => is_array($this->sections) ? $this->sections : [],
                'fee_rows' => $rows,
                'fee_note' => $this->fee_note ?? '',
                'supporting_info' => $this->supporting_info ?? '',
                'signatory_name' => $this->signatory_name ?? '',
                'signatory_designation' => $this->signatory_designation ?? '',
                'brief' => $this->brief ?? '',
            ];
        }

        return $data;
    }
}
