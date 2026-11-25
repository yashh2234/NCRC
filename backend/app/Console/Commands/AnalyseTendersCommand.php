<?php

namespace App\Console\Commands;

use App\Models\TenderAnalysis;
use App\Services\TenderAnalysisRunner;
use Illuminate\Console\Command;

/** Reads tender PDFs that are still waiting (normally they are read at once). */
class AnalyseTendersCommand extends Command
{
    protected $signature = 'tender:analyse {id? : only this analysis}';

    protected $description = 'Analyse uploaded tender PDFs that are waiting';

    public function handle(TenderAnalysisRunner $runner): int
    {
        ini_set('memory_limit', '512M');
        if ($id = $this->argument('id')) {
            $row = TenderAnalysis::find((int) $id);
            $this->info($row ? $runner->run($row)->status : 'Not found');

            return self::SUCCESS;
        }
        $this->info('Analysed: '.$runner->runWaiting());

        return self::SUCCESS;
    }
}
