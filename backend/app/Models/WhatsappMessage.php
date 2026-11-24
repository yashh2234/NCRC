<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** A message received from an allowed sender; status pending → saved (or failed after several tries). */
class WhatsappMessage extends Model
{
    protected $fillable = ['wamid', 'sender', 'user_id', 'body', 'status', 'attempts', 'error', 'inquiry_id'];
}
