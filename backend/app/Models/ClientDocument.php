<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ClientDocument extends Model
{
    protected $table = 'client_documents';
    protected $fillable = ['client_id', 'document_type', 'document_name', 'file_path', 'file_size', 'notes', 'uploaded_by'];

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }
}
