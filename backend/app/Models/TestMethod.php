<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TestMethod extends Model
{
    protected $table = 'test_methods';
    protected $fillable = ['test_id', 'method_name', 'procedure', 'equipment_required'];

    public function test(): BelongsTo
    {
        return $this->belongsTo(Test::class);
    }
}
