<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/** A mailbox: shared with everyone who has Mail access (owner_id null), or one user's own. */
class MailAccount extends Model
{
    /** Filled in when an account is added; can be changed per account */
    public const DEFAULT_BCC = 'namotech.omendra@gmail.com, manager@namotech.in';

    protected $fillable = [
        'email', 'from_name', 'username', 'password',
        'imap_host', 'imap_port', 'imap_encryption',
        'smtp_host', 'smtp_port', 'smtp_encryption',
        'sent_folder', 'default_bcc', 'owner_id', 'updated_by',
    ];

    protected $hidden = ['password'];

    protected $casts = [
        'password' => 'encrypted',
        'imap_port' => 'integer',
        'smtp_port' => 'integer',
        'owner_id' => 'integer',
    ];

    /** Accounts this user may open, the shared ones first */
    public static function visibleTo(User $user): Builder
    {
        return self::query()
            ->where(fn (Builder $q) => $q->whereNull('owner_id')->orWhere('owner_id', $user->id))
            ->orderByRaw('owner_id is not null')->orderBy('id');
    }

    /** The account asked for if the user may open it, else the first one */
    public static function forUser(User $user, ?int $id = null): ?self
    {
        return ($id ? self::visibleTo($user)->whereKey($id)->first() : null) ?? self::visibleTo($user)->first();
    }

    public function isShared(): bool
    {
        return $this->owner_id === null;
    }

    /** Shared mailboxes are the admins' to change, own ones the owner's */
    public function canBeManagedBy(User $user): bool
    {
        return $this->isShared() ? $user->isFullAdmin() : $this->owner_id === (int) $user->id;
    }

    /** Gmail puts a copy of what its SMTP server sends into Sent by itself */
    public function savesSentItself(): bool
    {
        return (bool) preg_match('/(^|\.)(gmail|googlemail)\.com$/i', $this->smtp_host);
    }
}
