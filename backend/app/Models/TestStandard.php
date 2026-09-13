<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TestStandard extends Model
{
    protected $table = 'test_standards';
    protected $fillable = ['test_id', 'standard_name', 'description'];

    public function test(): BelongsTo
    {
        return $this->belongsTo(Test::class);
    }
}
