<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SmsReminderLog extends Model
{
    protected $table = 'sms_reminder_log';

    protected $primaryKey = 'id';

    public $timestamps = false;

    protected $fillable = [
        'iClientId', 'sent_date', 'balance_amount', 'advance_amount', 'total_amount',
    ];

    protected $casts = [
        'sent_date' => 'datetime',
    ];

    public function client()
    {
        return $this->belongsTo(Registration::class, 'iClientId', 'iClientId');
    }
}
