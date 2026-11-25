<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** kind: website (a page of the company site) or fact */
class CompanyKnowledge extends Model
{
    protected $table = 'company_knowledge';

    protected $fillable = ['kind', 'title', 'content', 'url', 'status', 'created_by', 'decided_by'];

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
