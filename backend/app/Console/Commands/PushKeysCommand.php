<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Minishlink\WebPush\VAPID;

/** Makes the key pair for phone notifications; put the two lines in .env (once, keep them: new keys end every subscription). */
class PushKeysCommand extends Command
{
    protected $signature = 'push:keys';

    protected $description = 'Print a new VAPID key pair for Web Push notifications';

    public function handle(): int
    {
        $keys = VAPID::createVapidKeys();
        $this->line('WEBPUSH_PUBLIC_KEY='.$keys['publicKey']);
        $this->line('WEBPUSH_PRIVATE_KEY='.$keys['privateKey']);
        $this->warn('Keep these. Changing them later stops notifications until each phone allows them again.');

        return self::SUCCESS;
    }
}
