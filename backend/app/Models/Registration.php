<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Registration extends Model
{
    protected $table = 'client_registration';

    protected $primaryKey = 'iClientId';

    public $incrementing = false;

    public $timestamps = false;

    protected $fillable = [
        'iClientId', 'client_id', 'job_id', 'sno', 'uid_no', 'ulr_no', 'month',
        'received_date', 'agency_name', 'mobile_no', 'reporting_address',
        'name_of_work', 'work', 'work_order_no', 'reference', 'dist',
        'payment_followup', 'advance_payment', 'balance_dues', 'total_payment',
        'financial_remark', 'mode_of_payment',
        'new_back', 'new_back_1', 'new_back_2', 'new_back_3', 'new_back_4',
        'sample_details', 'sample_details_1', 'sample_details_2', 'sample_details_3', 'sample_details_4',
        'qty_1', 'qty_2', 'qty_3', 'qty_4', 'sample_test',
        'qty', 'witness', 'field_person_name', 'remark', 'sample_remark',
        'prepared_date', 'report_no', 'dispatch_date', 'report_status',
        'report_copy', 'gst_no', 'sample_nos',
        'scan_copy', 'scan_copy_1', 'scan_copy_2', 'scan_copy_3', 'scan_copy_4',
        'assign_to', 'current_stage', 'currently_with', 'priority', 'target_date', 'payment_status',
    ];

    protected $casts = [];

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class, 'client_id');
    }

    public function job(): BelongsTo
    {
        return $this->belongsTo(Jobs::class, 'job_id');
    }

    public function stageLogs()
    {
        return $this->hasMany(StageLog::class, 'registration_id', 'iClientId')->orderBy('created_at', 'desc');
    }
}
