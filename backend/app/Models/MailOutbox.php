<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** A mail on its way: queued → sending → sent, or failed (then it is put in Drafts). */
class MailOutbox extends Model
{
    protected $table = 'mail_outbox';

    protected $fillable = ['user_id', 'mail_account_id', 'subject', 'status', 'attempts', 'error', 'in_sent', 'in_drafts'];

    protected $casts = ['in_sent' => 'boolean', 'in_drafts' => 'boolean', 'attempts' => 'integer', 'user_id' => 'integer'];

    /** Folder with payload.json and the attached files */
    public function dir(): string
    {
        return storage_path('app/private/mail-outbox/'.(int) $this->id);
    }

    public function toApi(): array
    {
        return $this->only(['id', 'subject', 'status', 'error', 'in_sent', 'in_drafts']);
    }
}
