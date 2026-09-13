<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StageLog extends Model
{
    protected $table = 'stage_logs';

    protected $fillable = [
        'registration_id',
        'uid_no',
        'stage_set',
        'from_person',
        'to_person',
        'note',
    ];

    public function registration(): BelongsTo
    {
        return $this->belongsTo(Registration::class, 'registration_id', 'iClientId');
    }
}
