<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReportVersion extends Model
{
    protected $fillable = [
        'report_id',
        'uid_no',
        'report_type',
        'version_number',
        'change_notes',
        'snapshot_data',
        'pdf_path',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'snapshot_data' => 'array',
            'version_number' => 'integer',
        ];
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
