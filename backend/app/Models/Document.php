<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class Document extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'category_id', 'title', 'description',
        'file_name', 'file_path', 'file_type', 'file_extension', 'file_size',
        'metadata', 'tags',
        'linked_job_id', 'linked_model_type', 'linked_model_id',
        'created_by', 'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'metadata' => 'array',
            'file_size' => 'integer',
        ];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(DocumentCategory::class, 'category_id');
    }

    public function versions(): HasMany
    {
        return $this->hasMany(DocumentVersion::class, 'document_id')->orderBy('version_number', 'desc');
    }

    public function latestVersion()
    {
        return $this->hasOne(DocumentVersion::class, 'document_id')->latestOfMany('version_number');
    }

    public function downloads(): HasMany
    {
        return $this->hasMany(DocumentDownload::class, 'document_id');
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function humanFileSize(): string
    {
        $bytes = $this->file_size;
        $units = ['B', 'KB', 'MB', 'GB'];
        for ($i = 0; $bytes > 1024; $i++) $bytes /= 1024;
        return round($bytes, 1) . ' ' . ($units[$i] ?? 'TB');
    }
}
