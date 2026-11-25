<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** A tender PDF being read in the background: queued → running → done, or failed. */
class TenderAnalysis extends Model
{
    protected $fillable = [
        'user_id', 'tender_id', 'file_name', 'status', 'attempts', 'error', 'model',
        'summary', 'fields', 'next_try_at', 'finished_at', 'closed_at',
    ];

    protected $casts = [
        'user_id' => 'integer',
        'tender_id' => 'integer',
        'attempts' => 'integer',
        'summary' => 'array',
        'fields' => 'array',
        'next_try_at' => 'datetime',
        'finished_at' => 'datetime',
        'closed_at' => 'datetime',
    ];

    /** The uploaded PDF; kept only until it has been read. */
    public function path(): string
    {
        return storage_path('app/private/tender-analyses/'.(int) $this->id.'.pdf');
    }

    public function deleteFile(): void
    {
        if (is_file($this->path())) {
            @unlink($this->path());
        }
    }

    public function toApi(bool $withResult = false): array
    {
        $data = [
            'id' => $this->id,
            'tenderId' => $this->tender_id,
            'file' => $this->file_name,
            'status' => $this->status,
            'error' => $this->error,
            'retrying' => $this->status === 'queued' && $this->attempts > 0,
            // The browser starts it when nobody else has
            'due' => $this->status === 'queued' && ($this->next_try_at === null || $this->next_try_at->isPast()),
            'canRetry' => $this->status === 'failed' && is_file($this->path()),
            'createdAt' => $this->created_at?->toIso8601String(),
            'finishedAt' => $this->finished_at?->toIso8601String(),
        ];
        if ($withResult) {
            $data['summary'] = $this->summary;
            $data['fields'] = (object) ($this->fields ?? []);
        }

        return $data;
    }
}
