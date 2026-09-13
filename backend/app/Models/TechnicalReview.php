<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TechnicalReview extends Model
{
    protected $table = 'technical_reviews';
    protected $fillable = ['report_id', 'reviewer_id', 'remarks', 'status', 'reviewed_at', 'corrected_at', 'corrected_by'];

    protected $casts = ['reviewed_at' => 'datetime', 'corrected_at' => 'datetime'];
}
