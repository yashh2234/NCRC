<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DocumentVersion extends Model
{
    protected $table = 'document_versions';

    protected $fillable = [
        'document_id', 'version_number',
        'file_name', 'file_path', 'file_type', 'file_size',
        'change_notes', 'created_by',
    ];

    protected function casts(): array
    {
        return ['file_size' => 'integer'];
    }

    public function document(): BelongsTo
    {
        return $this->belongsTo(Document::class);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
