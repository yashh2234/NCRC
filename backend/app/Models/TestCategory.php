<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TestCategory extends Model
{
    protected $table = 'test_categories';
    protected $fillable = ['name', 'description', 'is_active', 'created_by'];

    public function tests(): HasMany
    {
        return $this->hasMany(Test::class, 'category_id');
    }
}
