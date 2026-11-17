<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Tender;
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

        $tender = DB::transaction(fn () => Tender::create($values + [
            'sr_no' => Tender::nextSrNo(),
            'created_by' => $request->user()?->id,
            'updated_by' => $request->user()?->id,
        ]));

        return response()->json(['data' => $tender->toApi()], 201);
    }

    public function update(Request $request, Tender $tender): JsonResponse
    {
        $tender->update($this->validated($request) + ['updated_by' => $request->user()?->id]);

        return response()->json(['data' => $tender->toApi()]);
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
