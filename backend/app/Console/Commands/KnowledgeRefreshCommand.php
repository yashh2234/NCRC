<?php

namespace App\Console\Commands;

use App\Services\CompanyKnowledgeBase;
use Illuminate\Console\Command;

class KnowledgeRefreshCommand extends Command
{
    protected $signature = 'knowledge:refresh';

    protected $description = 'Read the company website again for the proposal AI';

    public function handle(CompanyKnowledgeBase $base): int
    {
        $this->info('Pages read: '.$base->refresh());

        return self::SUCCESS;
    }
}
