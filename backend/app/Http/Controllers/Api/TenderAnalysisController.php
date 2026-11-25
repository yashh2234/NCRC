<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Tender;
use App\Models\TenderAnalysis;
use App\Services\TenderAnalysisRunner;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;

/** Tender PDFs read in the background. Everyone sees only their own. */
class TenderAnalysisController extends Controller
{
    /** Waiting, running, and finished ones the user has not looked at yet */
    public function index(Request $request): JsonResponse
    {
        $rows = TenderAnalysis::query()->where('user_id', $request->user()->id)->whereNull('closed_at')->orderBy('id')->get();

        return response()->json(['data' => $rows->map(fn (TenderAnalysis $row) => $row->toApi())]);
    }

    /** Takes the PDF; run() then reads it. With a tender the result becomes its summary, without one a new tender. */
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'document' => ['required', 'file', 'mimes:pdf', 'max:51200'],
            'tender_id' => ['nullable', 'integer', 'exists:tenders,id'],
        ], [
            'document.mimes' => 'Upload the tender document as a PDF.',
            'document.max' => 'The PDF is larger than 50 MB.',
            'document.uploaded' => 'The PDF could not be uploaded. It may be larger than the server allows.',
        ]);

        $tenderId = $request->integer('tender_id') ?: null;
        abort_if($tenderId && TenderAnalysis::query()->where('tender_id', $tenderId)->whereIn('status', ['queued', 'running'])->exists(),
            422, 'A document of this tender is already being analysed.');

        $file = $request->file('document');
        $row = TenderAnalysis::create([
            'user_id' => $request->user()->id,
            'tender_id' => $tenderId,
            'file_name' => mb_substr($file->getClientOriginalName(), 0, 250),
            'status' => 'queued',
        ]);
        try {
            File::ensureDirectoryExists(dirname($row->path()));
            $file->move(dirname($row->path()), basename($row->path()));
        } catch (\Throwable $e) {
            $row->delete();
            throw $e;
        }

        return response()->json(['data' => $row->refresh()->toApi()], 201);
    }

    /** Reads it within this request; the browser does not have to wait for the answer. */
    public function run(Request $request, TenderAnalysis $analysis, TenderAnalysisRunner $runner): JsonResponse
    {
        $this->own($request, $analysis);

        // The local development server handles one request at a time and would be stuck until it is read
        if (PHP_SAPI === 'cli-server') {
            $command = escapeshellarg(PHP_BINARY).' '.escapeshellarg(base_path('artisan')).' tender:analyse '.(int) $analysis->id;
            pclose(popen(PHP_OS_FAMILY === 'Windows' ? "start \"\" /B {$command} > NUL 2>&1" : "{$command} > /dev/null 2>&1 &", 'r'));

            return response()->json(['data' => $analysis->toApi()]);
        }

        ini_set('memory_limit', '512M');
        @set_time_limit(900);
        ignore_user_abort(true);

        return response()->json(['data' => $runner->run($analysis)->toApi()]);
    }

    public function show(Request $request, TenderAnalysis $analysis): JsonResponse
    {
        $this->own($request, $analysis);

        return response()->json(['data' => $analysis->toApi(true)]);
    }

    public function retry(Request $request, TenderAnalysis $analysis): JsonResponse
    {
        $this->own($request, $analysis);
        abort_unless($analysis->status === 'failed' && is_file($analysis->path()), 422, 'This PDF cannot be tried again. Please upload it again.');
        $analysis->update(['status' => 'queued', 'attempts' => 0, 'error' => null, 'next_try_at' => null, 'finished_at' => null, 'closed_at' => null]);

        return response()->json(['data' => $analysis->toApi()]);
    }

    /** For a PDF whose tender is already in the list: the result becomes the summary of that tender. */
    public function attach(Request $request, TenderAnalysis $analysis): JsonResponse
    {
        $this->own($request, $analysis);
        $data = $request->validate(['tender_id' => ['required', 'integer', 'exists:tenders,id']]);

        $tender = DB::transaction(function () use ($analysis, $data): Tender {
            $row = TenderAnalysis::query()->lockForUpdate()->findOrFail($analysis->id);
            abort_unless($row->status === 'done' && $row->tender_id === null, 422, 'This analysis is already saved.');
            $tender = Tender::query()->findOrFail($data['tender_id']);
            TenderAnalysisRunner::putOnTender($row, $tender);
            $row->update(['tender_id' => $tender->id, 'closed_at' => now()]);

            return $tender;
        });

        return response()->json(['data' => $tender->toApi()]);
    }

    /** Not shown any more; an unfinished one is stopped. The summary of a saved tender is not touched. */
    public function destroy(Request $request, TenderAnalysis $analysis): JsonResponse
    {
        $this->own($request, $analysis);
        if (in_array($analysis->status, ['queued', 'running'], true)) {
            $analysis->fill(['status' => 'failed', 'error' => 'Cancelled.']);
        }
        $analysis->fill(['closed_at' => now()])->save();
        $analysis->deleteFile();

        return response()->json(['message' => 'Closed']);
    }

    private function own(Request $request, TenderAnalysis $analysis): void
    {
        abort_unless($analysis->user_id === (int) $request->user()->id, 404);
    }
}
