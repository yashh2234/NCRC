<?php

namespace App\Console\Commands;

use App\Services\MailInboxWatcher;
use Illuminate\Console\Command;

/** Checks the Inbox of every mail account and sends bell notifications for new mail. */
class CheckMailCommand extends Command
{
    protected $signature = 'mail:check';

    protected $description = 'Check the mail accounts and notify their users about new mail';

    public function handle(MailInboxWatcher $watcher): int
    {
        $accounts = $watcher->checkAll();
        foreach ($accounts as $name => $unread) {
            $this->info($unread === null ? "{$name}: could not be reached" : "{$name}: {$unread} unread");
        }
        if (! $accounts) {
            $this->info('No mail account set up.');
        }

        return self::SUCCESS;
    }
}
