<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One entry in an inquiry's call / follow-up log. */
class InquiryActivity extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = [
        'inquiry_id', 'user_id', 'status', 'assigned_to', 'next_follow_up', 'remark',
    ];

    protected $casts = [
        'next_follow_up' => 'date:Y-m-d',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function assignedUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }
}
