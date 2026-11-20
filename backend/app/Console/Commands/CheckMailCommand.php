<?php

namespace App\Console\Commands;

use App\Services\MailInboxWatcher;
use Illuminate\Console\Command;
use Throwable;

/** Checks the office Inbox and sends bell notifications for new mail. */
class CheckMailCommand extends Command
{
    protected $signature = 'mail:check';

    protected $description = 'Check the office mailbox and notify Mail users about new mail';

    public function handle(MailInboxWatcher $watcher): int
    {
        try {
            $status = $watcher->status(fresh: true);
        } catch (Throwable $e) {
            $this->error('Mail check failed: '.$e->getMessage());

            return self::FAILURE;
        }

        $this->info($status['configured'] ? "Inbox unread: {$status['unread']}" : 'Office mailbox not set up.');

        return self::SUCCESS;
    }
}
