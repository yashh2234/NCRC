<?php

namespace App\Console\Commands;

use App\Services\MailSender;
use Illuminate\Console\Command;

/** Sends mails that are still waiting in the outbox (normally they go out at once). */
class SendMailOutboxCommand extends Command
{
    protected $signature = 'mail:outbox';

    protected $description = 'Send mails waiting in the outbox';

    public function handle(MailSender $sender): int
    {
        ini_set('memory_limit', '512M');
        $this->info('Sent: '.$sender->runWaiting());

        return self::SUCCESS;
    }
}
