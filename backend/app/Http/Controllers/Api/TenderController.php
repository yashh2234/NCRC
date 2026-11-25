<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Tender;
use App\Models\TenderAnalysis;
use App\Models\User;
use App\Services\TenderAnalysisRunner;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TenderController extends Controller
{
    public function index(): JsonResponse
    {
        $tenders = Tender::query()->orderBy('id')->get()->map(fn (Tender $tender) => $tender->toApi());

        return response()->json(['data' => $tenders]);
    }

    public function store(Request $request): JsonResponse
    {
        $values = $this->validated($request);

        $analysisId = $request->validate(['analysisId' => ['nullable', 'integer']])['analysisId'] ?? null;

        $tender = DB::transaction(function () use ($request, $values, $analysisId): Tender {
            $analysis = null;
            if ($analysisId) {
                $analysis = TenderAnalysis::query()->lockForUpdate()->where('user_id', $request->user()?->id)->findOrFail($analysisId);
                abort_unless($analysis->status === 'done' && $analysis->tender_id === null, 422, 'This analysed tender is already saved.');
            }

            $tender = Tender::create($values + [
                'sr_no' => Tender::nextSrNo(),
                'created_by' => $request->user()?->id,
                'updated_by' => $request->user()?->id,
            ]);
            // The summary of the PDF stays on the tender
            if ($analysis) {
                TenderAnalysisRunner::putOnTender($analysis, $tender);
                $analysis->update(['tender_id' => $tender->id, 'closed_at' => now()]);
            }

            return $tender;
        });

        return response()->json(['data' => $tender->toApi()], 201);
    }

    public function update(Request $request, Tender $tender): JsonResponse
    {
        $tender->update($this->validated($request) + ['updated_by' => $request->user()?->id]);

        return response()->json(['data' => $tender->toApi()]);
    }

    /** Saved AI summary of the tender document. */
    public function summary(Tender $tender): JsonResponse
    {
        return response()->json(['data' => $this->presentSummary($tender)]);
    }

    /** Ticks or unticks one document of the summary's checklist, for everyone. */
    public function checkDocument(Request $request, Tender $tender): JsonResponse
    {
        $data = $request->validate(['document' => ['required', 'string', 'max:5000'], 'checked' => ['required', 'boolean']]);

        $tender = DB::transaction(function () use ($request, $tender, $data): Tender {
            $tender = Tender::query()->lockForUpdate()->findOrFail($tender->id);
            $key = Tender::checkKey($data['document']);
            $known = array_map(fn ($d) => Tender::checkKey((string) $d), $tender->ai_summary['documents_required'] ?? []);
            abort_unless(in_array($key, $known, true), 422, 'The document list has changed. Please open the summary again.');

            $checks = $tender->document_checks ?? [];
            if ($data['checked']) {
                $checks[$key] ??= ['by' => $request->user()?->name, 'at' => now()->toIso8601String()];
            } else {
                unset($checks[$key]);
            }
            $tender->forceFill(['document_checks' => $checks])->save();

            return $tender;
        });

        return response()->json(['data' => $this->presentSummary($tender), 'tender' => $tender->toApi()]);
    }

    private function presentSummary(Tender $tender): ?array
    {
        if (empty($tender->ai_summary)) {
            return null;
        }

        return [
            'summary' => $tender->ai_summary,
            'checks' => $tender->documentChecks(),
            'file' => $tender->ai_summary_file,
            'model' => $tender->ai_summary_model,
            'analysed_at' => $tender->ai_summary_at?->toIso8601String(),
            'analysed_by' => $tender->ai_summary_by ? User::find($tender->ai_summary_by)?->name : null,
        ];
    }

    public function destroy(Tender $tender): JsonResponse
    {
        $tender->delete();

        return response()->json(['message' => 'Tender deleted']);
    }

    /**
     * One-time upload of tenders that were saved in a browser's localStorage before
     * tenders were stored on the server. Tenders whose Tender ID already exists are
     * skipped; a clashing Sr. No. gets a fresh one.
     */
    public function import(Request $request): JsonResponse
    {
        $request->validate([
            'tenders' => ['required', 'array', 'max:1000'],
            'tenders.*.title' => ['required', 'string'],
            'tenders.*.srNo' => ['nullable', 'string', 'max:50'],
        ]);

        $imported = 0;
        $skipped = 0;

        DB::transaction(function () use ($request, &$imported, &$skipped): void {
            foreach ($request->input('tenders') as $item) {
                $values = $this->mapFields(is_array($item) ? $item : []);
                $tenderId = trim($values['tender_id'] ?? '');

                $duplicate = $tenderId !== ''
                    ? Tender::query()->where('tender_id', $tenderId)->exists()
                    : Tender::query()->where('title', $values['title'] ?? '')->exists();
                if ($duplicate) {
                    $skipped++;
                    continue;
                }

                $srNo = trim((string) ($item['srNo'] ?? ''));
                if ($srNo === '' || Tender::query()->where('sr_no', $srNo)->exists()) {
                    $srNo = Tender::nextSrNo();
                }

                Tender::create($values + [
                    'sr_no' => $srNo,
                    'created_by' => $request->user()?->id,
                    'updated_by' => $request->user()?->id,
                ]);
                $imported++;
            }
        });

        return response()->json(['imported' => $imported, 'skipped' => $skipped]);
    }

    private function validated(Request $request): array
    {
        $rules = [];
        foreach (array_keys(Tender::FIELD_MAP) as $key) {
            $rules[$key] = ['nullable', 'string'];
        }
        $rules['title'] = ['required', 'string'];
        $rules['tenderId'] = ['required', 'string', 'max:255'];
        $rules['bidType'] = ['nullable', 'in:amount,percent'];
        $rules['emdDeposited'] = ['nullable', 'in:Yes,No'];
        $rules['closingTime'] = ['nullable', 'date_format:H:i'];
        $rules['contactName'] = ['nullable', 'string', 'max:255'];
        $rules['contactDesignation'] = ['nullable', 'string', 'max:255'];
        $rules['contactPhone'] = ['nullable', 'string', 'max:100'];
        $rules['emdMode'] = ['nullable', 'in:Online,Offline'];

        return $this->mapFields($request->validate($rules));
    }

    /** camelCase API payload => database columns (missing / null values become ''). */
    private function mapFields(array $input): array
    {
        $values = [];
        foreach (Tender::FIELD_MAP as $key => $column) {
            $value = $input[$key] ?? '';
            $values[$column] = is_scalar($value) ? trim((string) $value) : '';
        }

        return $values;
    }
}
