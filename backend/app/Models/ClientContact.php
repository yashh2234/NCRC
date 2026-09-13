<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ClientContact extends Model
{
    protected $table = 'client_contacts';

    protected $fillable = [
        'client_id', 'name', 'designation',
        'phone', 'mobile', 'email',
        'is_primary', 'notes',
    ];

    protected function casts(): array
    {
        return ['is_primary' => 'boolean'];
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }
}
