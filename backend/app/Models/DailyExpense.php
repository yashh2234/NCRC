<?php

namespace App\Models;

use App\Models\Concerns\RecordsTimeline;
use Illuminate\Database\Eloquent\Model;

class DailyExpense extends Model
{
    use RecordsTimeline;

    protected $table = 'daily_expenses';
    protected $primaryKey = 'iExpensesId';
    public $incrementing = false;
    public $timestamps = false;

    protected $fillable = [
        'id', 'iExpensesId', 'date', 'opening_balance', 'total_income',
        'total_expenses', 'closing_balance', 'expenses_category',
        'expenses_remark', 'payment_mode', 'remark', 'person_name',
        'created_date',
    ];

    protected $casts = [
        'date' => 'date',
    ];
}
