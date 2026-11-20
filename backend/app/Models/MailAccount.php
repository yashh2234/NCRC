<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** The shared office mailbox (single row). */
class MailAccount extends Model
{
    protected $fillable = [
        'email', 'from_name', 'username', 'password',
        'imap_host', 'imap_port', 'imap_encryption',
        'smtp_host', 'smtp_port', 'smtp_encryption',
        'sent_folder', 'updated_by',
    ];

    protected $hidden = ['password'];

    protected $casts = [
        'password' => 'encrypted',
        'imap_port' => 'integer',
        'smtp_port' => 'integer',
    ];

    public static function current(): ?self
    {
        return self::query()->first();
    }
}
