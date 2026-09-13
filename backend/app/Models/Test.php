<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Test extends Model
{
    protected $table = 'tests';
    protected $fillable = ['category_id', 'name', 'code', 'description', 'unit', 'sample_type', 'specification_limit', 'standard_rate', 'is_active', 'created_by'];

    public function category(): BelongsTo
    {
        return $this->belongsTo(TestCategory::class, 'category_id');
    }

    public function standards(): HasMany
    {
        return $this->hasMany(TestStandard::class, 'test_id');
    }

    public function methods(): HasMany
    {
        return $this->hasMany(TestMethod::class, 'test_id');
    }
}
