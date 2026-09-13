<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Billing extends Model
{
    protected $table = 'billing';

    protected $primaryKey = 'id';

    public $timestamps = false;

    protected $fillable = [
        'uid_no', 'bill_no', 'bill_amount', 'advance_amount', 'mode_of_payment',
        'amount_received', 'amount_received_date', 'due_amount', 'discount',
        'payment_followup', 'remark',
    ];

    protected $casts = [
        'created_date' => 'datetime',
    ];
}
