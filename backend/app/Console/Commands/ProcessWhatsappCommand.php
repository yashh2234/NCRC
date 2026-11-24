<?php

namespace App\Console\Commands;

use App\Services\WhatsappInquiries;
use Illuminate\Console\Command;

/** Saves WhatsApp messages that are still waiting as inquiries. */
class ProcessWhatsappCommand extends Command
{
    protected $signature = 'whatsapp:process';

    protected $description = 'Turn received WhatsApp messages into inquiries';

    public function handle(WhatsappInquiries $inquiries): int
    {
        $this->info('Saved: '.$inquiries->process());

        return self::SUCCESS;
    }
}
