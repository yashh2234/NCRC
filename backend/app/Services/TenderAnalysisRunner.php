<?php

namespace App\Services;

use App\Models\Notification;
use App\Models\Tender;
use App\Models\TenderAnalysis;
use RuntimeException;
use Throwable;

/** Reads the uploaded tender PDFs; run from the browser's request and, as a fallback, by the scheduler. */
class TenderAnalysisRunner
{
    private const MAX_ATTEMPTS = 4;

    /** Minutes to wait before the 2nd, 3rd and 4th try when the AI is busy */
    private const WAITS = [3, 8, 20];

    /** A running analysis that showed no sign of life for this long was killed with its process */
    private const STALE_MINUTES = 8;

    public function __construct(private TenderDocumentAnalyzer $analyzer, private TenderFieldFiller $filler) {}

    /** Safe to call twice; only one call gets it. */
    public function run(TenderAnalysis $row): TenderAnalysis
    {
        $attempt = $row->attempts + 1;
        $claimed = TenderAnalysis::query()->whereKey($row->id)->where('status', 'queued')->where('attempts', $row->attempts)->whereNull('closed_at')
            ->where(fn ($q) => $q->whereNull('next_try_at')->orWhere('next_try_at', '<=', now()))
            ->update(['status' => 'running', 'attempts' => $attempt, 'next_try_at' => null, 'updated_at' => now()]);
        $row->refresh();
        if (! $claimed) {
            return $row;
        }

        // Only while this attempt still owns the row (it may have been taken over or cancelled meanwhile)
        $mine = fn () => TenderAnalysis::query()->whereKey($row->id)->where('status', 'running')->where('attempts', $attempt);
        $this->analyzer->onProgress(fn () => $mine()->update(['updated_at' => now()]));

        try {
            if (empty($row->summary)) {
                if (! is_file($row->path())) {
                    throw new RuntimeException('The uploaded PDF is no longer on the server. Please upload it again.');
                }
                $summary = $this->analyzer->analyze($row->path());
                // Kept at once, so a later problem does not mean reading the PDF again
                if (! $mine()->update(['summary' => json_encode($summary), 'model' => $this->analyzer->model(), 'updated_at' => now()])) {
                    return $row->refresh();
                }
                $row->refresh();
            }

            $fields = $row->tender_id ? null : $this->filler->fill($row->summary);

            $tender = $row->tender_id ? Tender::find($row->tender_id) : null;
            if ($row->tender_id && ! $tender) {
                throw new RuntimeException('The tender was deleted.');
            }
            if (! $mine()->update(['status' => 'done', 'error' => null, 'fields' => $fields === null ? null : json_encode($fields), 'finished_at' => now(), 'updated_at' => now()])) {
                return $row->refresh();
            }
            $row->refresh();
            if ($tender) {
                self::putOnTender($row, $tender);
            }
            $row->deleteFile();
            $this->notify($row, $tender ? 'Tender summary is ready' : 'Tender analysed: check and save it',
                $tender ? "{$tender->sr_no} · {$row->file_name}" : $row->file_name);
        } catch (RuntimeException $e) {
            $this->failed($row, $attempt, $e->getMessage(), $e->getCode() === TenderDocumentAnalyzer::BUSY);
        } catch (Throwable $e) {
            report($e);
            $this->failed($row, $attempt, 'Something went wrong while reading the PDF. Please try again.', false);
        }

        return $row->refresh();
    }

    /** For the scheduler: what the browser did not start or finish (closed tab, busy AI, killed request) */
    public function runWaiting(): int
    {
        TenderAnalysis::query()->where('status', 'running')->where('updated_at', '<', now()->subMinutes(self::STALE_MINUTES))->get()
            ->each(fn (TenderAnalysis $row) => $this->failed($row, $row->attempts, 'Reading the PDF was interrupted.', true));

        $done = 0;
        $waiting = TenderAnalysis::query()->where('status', 'queued')->whereNull('closed_at')
            ->where(fn ($q) => $q->where('next_try_at', '<=', now())
                ->orWhere(fn ($q) => $q->whereNull('next_try_at')->where('updated_at', '<', now()->subSeconds(45))))
            ->orderBy('id')->limit(3)->get();
        foreach ($waiting as $row) {
            $done += $this->run($row)->status === 'done' ? 1 : 0;
        }

        // The PDFs are not kept; a failed one stays a week so it can be tried again
        TenderAnalysis::query()->where('status', 'failed')->whereNull('closed_at')->where('updated_at', '<', now()->subDays(7))->get()
            ->each(function (TenderAnalysis $row): void {
                $row->deleteFile();
                $row->update(['closed_at' => now()]);
            });
        TenderAnalysis::query()->whereNotNull('closed_at')->where('closed_at', '<', now()->subDays(30))->get()
            ->each(function (TenderAnalysis $row): void {
                $row->deleteFile();
                $row->delete();
            });

        return $done;
    }

    /** Saves the result as the tender's summary (shown by its summary button). */
    public static function putOnTender(TenderAnalysis $row, Tender $tender): void
    {
        $tender->forceFill([
            'ai_summary' => $row->summary,
            'ai_summary_file' => $row->file_name,
            'ai_summary_model' => $row->model,
            'ai_summary_at' => $row->finished_at ?? now(),
            'ai_summary_by' => $row->user_id,
        ])->save();
    }

    private function failed(TenderAnalysis $row, int $attempt, string $reason, bool $again): void
    {
        $mine = TenderAnalysis::query()->whereKey($row->id)->where('status', 'running')->where('attempts', $attempt);
        $error = mb_substr($reason, 0, 480);
        if ($again && $attempt < self::MAX_ATTEMPTS) {
            $mine->update(['status' => 'queued', 'error' => $error, 'next_try_at' => now()->addMinutes(self::WAITS[$attempt - 1] ?? 20), 'updated_at' => now()]);

            return;
        }
        if ($mine->update(['status' => 'failed', 'error' => $error, 'finished_at' => now(), 'updated_at' => now()])) {
            $this->notify($row, 'Tender PDF could not be analysed', "{$row->file_name}: {$error}");
        }
    }

    private function notify(TenderAnalysis $row, string $title, string $message): void
    {
        Notification::create([
            'user_id' => $row->user_id, 'type' => 'tender_analysis', 'title' => $title,
            'message' => mb_strimwidth($message, 0, 400, '…'),
            'data' => ['analysis_id' => $row->id, 'tender_id' => $row->tender_id], 'created_at' => now(),
        ]);
    }
}
