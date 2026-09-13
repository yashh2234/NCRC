<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ClientCommunication extends Model
{
    protected $table = 'client_communications';

    protected $fillable = [
        'client_id', 'type', 'subject', 'body',
        'contact_id', 'user_id', 'communication_date',
    ];

    protected function casts(): array
    {
        return ['communication_date' => 'datetime'];
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
