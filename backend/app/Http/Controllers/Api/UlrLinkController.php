<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\UlrLink;
use App\Services\XlsxReader;
use App\Models\UlrCopy;
use App\Models\Registration;
use App\Models\Report;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class UlrLinkController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = UlrLink::query();

        $startDate = $request->query('start_date');
        $endDate = $request->query('end_date');
        $uidNo = trim((string) $request->query('uid_no', ''));
        if ($startDate) $query->whereDate('date', '>=', $startDate);
        if ($endDate) $query->whereDate('date', '<=', $endDate);
        if ($uidNo !== '') $query->where('uid_no', 'like', '%' . $uidNo . '%');

        $links = $query->orderByDesc('id')->limit(200)->get();
        return response()->json(['data' => $links]);
    }

    public function export(Request $request): JsonResponse
    {
        $query = UlrLink::query();

        $startDate = $request->query('start_date');
        $endDate = $request->query('end_date');
        $uidNo = trim((string) $request->query('uid_no', ''));
        if ($startDate) $query->whereDate('date', '>=', $startDate);
        if ($endDate) $query->whereDate('date', '<=', $endDate);
        if ($uidNo !== '') $query->where('uid_no', 'like', '%' . $uidNo . '%');

        // Old software exported every row (no 1000 cap).
        // Plain rows (not models): an export can be 60k+ rows (~95 MB peak).
        @ini_set('memory_limit', '512M');
        $links = $this->latestFirst($query)->toBase()->get(['date', 'ulr_no', 'uid_no', 'name_of_agency', 'name_of_project', 'sample_details']);
        $this->restoreHindiWork($links);
        return response()->json(['data' => $links]);
    }

    /**
     * Latest filled data on top: ULRs linked to a UID, newest date first. Blank ULR numbers
     * (pre-loaded from the Excel list, not linked yet) come after them, also newest first.
     */
    private function latestFirst($query)
    {
        return $query->orderByRaw("TRIM(uid_no) = ''")->orderByDesc('date')->orderByDesc('id');
    }

    /**
     * Older ulr_link rows lost their Hindi "Name of Work" (stored as literal "?????").
     * The same UID's registration still has the real text, so show that instead.
     */
    private function restoreHindiWork($rows): void
    {
        $broken = $rows->filter(fn ($r) => str_contains((string) $r->name_of_project, '??') && trim((string) $r->uid_no) !== '');
        if ($broken->isEmpty()) return;

        $works = collect();
        foreach ($broken->pluck('uid_no')->unique()->chunk(1000) as $uids) {
            $works = $works->merge(
                Registration::whereIn('uid_no', $uids->all())->pluck('name_of_work', 'uid_no')
            );
        }
        $works = $works->mapWithKeys(fn ($w, $uid) => [strtolower(trim($uid)) => $w]);

        $broken->each(function ($r) use ($works) {
            $work = $works[strtolower(trim($r->uid_no))] ?? null;
            if ($work && !str_contains($work, '??')) $r->name_of_project = $work;
        });
    }

    public function dropdown(Request $request): JsonResponse
    {
        $date = $request->query('date', date('Y-m-d'));
        
        $links = UlrLink::query()
            ->whereDate('date', $date)
            ->get()
            ->map(function ($ulr) {
                return [
                    'id' => $ulr->id,
                    'ulr_no' => $ulr->ulr_no,
                    'uid_no' => $ulr->uid_no,
                    'is_assigned' => trim((string) $ulr->uid_no) !== '',
                    'label' => $ulr->ulr_no . (trim((string) $ulr->uid_no) !== '' ? ' (Assigned)' : ''),
                ];
            });

        return response()->json(['data' => $links]);
    }

    /**
     * Import the year's ULR list (e.g. "NCS 2026.xlsx": ULR No. + Date columns) into the date-wise pool
     * that the Add ULR page offers. ULRs already linked to a UID are never changed.
     */
    public function importPool(Request $request): JsonResponse
    {
        $request->validate(['file' => 'required|file|max:20480']);

        try {
            $rows = XlsxReader::firstSheetRows($request->file('file')->getRealPath());
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Could not read the Excel file: ' . $e->getMessage()], 422);
        }

        // Header row: the "ULR No." and "Date" columns
        $ulrCol = $dateCol = null;
        $headerRow = 0;
        foreach (array_slice($rows, 0, 10, true) as $n => $cells) {
            foreach ($cells as $col => $value) {
                $v = strtolower(trim($value));
                if ($ulrCol === null && str_contains($v, 'ulr')) $ulrCol = $col;
                if ($dateCol === null && preg_match('/^date\b/', $v)) $dateCol = $col;
            }
            if ($ulrCol !== null && $dateCol !== null) { $headerRow = $n; break; }
            $ulrCol = $dateCol = null;
        }
        if ($ulrCol === null || $dateCol === null) {
            return response()->json(['message' => 'The Excel needs a "ULR No." column and a "Date" column in its header row.'], 422);
        }

        // ULR → date from the Excel
        $list = [];
        $invalid = 0;
        foreach ($rows as $n => $cells) {
            if ($n <= $headerRow) continue;
            $ulr = preg_replace('/\.0+$/', '', trim((string) ($cells[$ulrCol] ?? '')));
            if ($ulr === '') continue;
            $date = $this->excelDate($cells[$dateCol] ?? '');
            if (! $date) { $invalid++; continue; }
            $list[$ulr] = $date;
        }
        if (! $list) {
            return response()->json(['message' => 'No ULR numbers with a date were found in the Excel.'], 422);
        }

        $added = $moved = $same = $linkedKept = 0;
        DB::transaction(function () use ($list, &$added, &$moved, &$same, &$linkedKept) {
            $years = array_values(array_unique(array_map(fn ($d) => (int) substr($d, 0, 4), $list)));
            // The ULR series repeats every year: match within the same year
            $existing = UlrLink::query()
                ->where(function ($q) use ($years) {
                    foreach ($years as $y) $q->orWhereBetween('date', ["$y-01-01", "$y-12-31"]);
                })
                ->whereIn('ulr_no', array_map('strval', array_keys($list)))
                ->lockForUpdate()
                ->get(['id', 'ulr_no', 'date', 'uid_no'])
                ->groupBy(fn ($r) => trim((string) $r->ulr_no) . '|' . substr((string) $r->date, 0, 4));

            $insert = [];
            foreach ($list as $ulr => $date) {
                $rowsForUlr = $existing->get($ulr . '|' . substr($date, 0, 4));
                if (! $rowsForUlr) {
                    $insert[] = array_merge(array_fill_keys(UlrLink::TEXT_COLUMNS, ''), [
                        'ulr_no' => (string) $ulr, 'date' => $date, 'ndate' => UlrLink::dmy($date),
                        'sample_received_date' => null, 'report_dispatch_date' => null,
                    ]);
                    $added++;
                    continue;
                }
                if ($rowsForUlr->contains(fn ($r) => substr((string) $r->date, 0, 10) === $date)) { $same++; continue; }
                if ($rowsForUlr->contains(fn ($r) => trim((string) $r->uid_no) !== '')) { $linkedKept++; continue; }
                UlrLink::query()->whereKey($rowsForUlr->first()->id)->update(['date' => $date, 'ndate' => UlrLink::dmy($date)]);
                $moved++;
            }
            foreach (array_chunk($insert, 500) as $chunk) {
                UlrLink::query()->insert($chunk);
            }
        });

        return response()->json([
            'message' => 'Imported ' . count($list) . " ULR numbers: {$added} added, {$moved} moved to their Excel date, {$same} already correct"
                . ($linkedKept ? ", {$linkedKept} already linked to a UID on another date (kept)" : '')
                . ($invalid ? ", {$invalid} rows skipped (no valid date)" : '') . '.',
            'total' => count($list), 'added' => $added, 'moved' => $moved, 'unchanged' => $same, 'linked_kept' => $linkedKept, 'invalid' => $invalid,
        ]);
    }

    /** 31/01/2026, 31-01-2026, 2026-01-31 or an Excel date number → 2026-01-31 */
    private function excelDate(string $value): ?string
    {
        $v = trim($value);
        if (preg_match('/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/', $v, $m) && checkdate((int) $m[2], (int) $m[1], (int) $m[3])) {
            return sprintf('%04d-%02d-%02d', $m[3], $m[2], $m[1]);
        }
        if (preg_match('/^(\d{4})-(\d{2})-(\d{2})/', $v, $m) && checkdate((int) $m[2], (int) $m[3], (int) $m[1])) {
            return "$m[1]-$m[2]-$m[3]";
        }
        if (is_numeric($v) && (float) $v > 20000 && (float) $v < 80000) {
            return gmdate('Y-m-d', (int) round(((float) $v - 25569) * 86400));
        }

        return null;
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'uid_no' => 'required|string',
            'date' => 'required|string',
            'ulr_no' => 'nullable|string',
            'new_ulr_no' => 'nullable|string',
            'name_of_department' => 'nullable|string',
            'name_of_agency' => 'required|string',
            'name_of_project' => 'nullable|string',
            'sample_details' => 'nullable|string',
            'qty' => 'nullable|string',
            'parameters' => 'nullable|string',
            'testing_period' => 'nullable|string',
            'sample_received_date' => 'nullable|string',
            'report_dispatch_date' => 'nullable|string',
            'bill_details' => 'nullable|string',
            'signature_remark' => 'nullable|string',
        ]);

        $selectedUlr = trim((string) $request->input('ulr_no'));
        $isNew = $selectedUlr === 'new';
        // "+ New Create" lets the user type any ULR, letters included (e.g. 107343A).
        $ulrNo = $isNew ? trim((string) $request->input('new_ulr_no')) : $selectedUlr;
        if ($ulrNo === '') {
            return response()->json(['message' => 'Please select or enter a ULR No.'], 422);
        }
        $validated['uid_no'] = trim($validated['uid_no']);
        unset($validated['new_ulr_no']);
        $validated['ulr_no'] = $ulrNo;

        return DB::transaction(function () use ($validated, $ulrNo, $isNew) {
            // The Excel ULR series repeats every year, so a number is unique within its year.
            $date = $validated['date'];
            $rows = UlrLink::where('ulr_no', $ulrNo)
                ->whereYear('date', substr($date, 0, 4))
                ->lockForUpdate()
                ->get()
                // Prefer the row of the selected date.
                ->sortByDesc(fn ($r) => substr((string) $r->date, 0, 10) === $date)
                ->values();

            // A ULR number belongs to exactly one UID in that year: once assigned it can't be reused.
            $taken = $rows->first(fn ($r) => trim((string) $r->uid_no) !== '');
            if ($taken) {
                return response()->json([
                    'message' => "ULR {$ulrNo} is already assigned to UID {$taken->uid_no}.",
                ], 422);
            }

            // Free number from the date-wise pool (Excel list) → fill it in; otherwise create it.
            $pool = $rows->first();
            if ($pool) {
                $pool->update(array_merge($validated, ['date' => $pool->date ?: $validated['date']]));
            } else {
                UlrLink::create($validated);
            }

            // One UID may hold several ULRs: only fill reports of this UID that don't have one yet.
            Report::where('uid_no', $validated['uid_no'])
                ->where(fn ($q) => $q->whereNull('ulr_no')->orWhere('ulr_no', ''))
                ->update(['ulr_no' => $ulrNo]);

            return response()->json([
                'message' => $isNew && !$pool ? 'ULR created and linked successfully' : 'ULR linked successfully',
                'ulr_no' => $ulrNo,
            ], $isNew && !$pool ? 201 : 200);
        });
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $existing = UlrLink::findOrFail($id);

        UlrCopy::create([
            'uid_no' => $existing->uid_no,
            'ulr_no' => $existing->ulr_no,
            'name_of_department' => $existing->name_of_department,
            'name_of_agency' => $existing->name_of_agency,
            'name_of_project' => $existing->name_of_project,
            'sample_details' => $existing->sample_details,
        ]);

        $validated = $request->validate([
            'uid_no' => 'required|string',
            'date' => 'required|string',
            'name_of_department' => 'nullable|string',
            'name_of_agency' => 'required|string',
            'name_of_project' => 'nullable|string',
            'sample_details' => 'nullable|string',
            'qty' => 'nullable|string',
            'parameters' => 'nullable|string',
            'testing_period' => 'nullable|string',
            'sample_received_date' => 'nullable|string',
            'report_dispatch_date' => 'nullable|string',
            'bill_details' => 'nullable|string',
            'signature_remark' => 'nullable|string',
        ]);

        $existing->update($validated);
        return response()->json(['message' => 'ULR updated']);
    }

    /**
     * Same as the old software's Ulrlink/remove: the row is not deleted, the ULR number is
     * unassigned (UID and details cleared) so it can be linked again.
     */
    public function destroy(int $id): JsonResponse
    {
        UlrLink::findOrFail($id)->update([
            'uid_no' => '',
            'name_of_department' => '',
            'name_of_agency' => '',
            'name_of_project' => '',
            'sample_details' => '',
        ]);
        return response()->json(['message' => 'Successfully removed']);
    }

    public function getClientDetails(Request $request): JsonResponse
    {
        $uidNo = trim((string) $request->input('uid_no'));
        $reg = Registration::where('uid_no', $uidNo)->first();
        if ($reg) {
            $reg->setAttribute('test_categories', $this->testCategoryNames($reg));
        }
        return response()->json(['data' => $reg]);
    }

    /** Only the test category names of a registration, e.g. "Bricks, Cement". */
    private function testCategoryNames(Registration $reg): string
    {
        $names = [];
        $items = json_decode((string) ($reg->sample_items ?? ''), true);
        if (is_array($items)) {
            foreach ($items as $row) {
                $cat = trim((string) ($row['category'] ?? ''));
                if ($cat !== '' && strcasecmp($cat, 'Other') !== 0) $names[] = $cat;
            }
        }

        // Older registrations only have the "Category - test, test" text columns.
        if (!$names) {
            $lines = [];
            foreach (['sample_details', 'sample_details_1', 'sample_details_2', 'sample_details_3'] as $col) {
                $lines[] = (string) ($reg->{$col} ?? '');
            }
            $lines = array_merge($lines, explode("\n", (string) ($reg->sample_details_4 ?? '')));
            foreach ($lines as $line) {
                $cat = trim(explode(' - ', $line, 2)[0]);
                if ($cat !== '') $names[] = $cat;
            }
        }

        return implode(', ', array_values(array_unique($names)));
    }

    /**
     * Manage ULR Register, paged on the server (the old DataTable loaded every row of ulr_link).
     * Mirrors the old fetchAllOrdersData / fetchOrdersFilterData: all rows, optional date range,
     * plus the DataTable's search box, column sorting and "Show N entries".
     */
    public function register(Request $request): JsonResponse
    {
        $columns = ['date', 'ulr_no', 'uid_no', 'name_of_department', 'name_of_agency', 'name_of_project', 'sample_details'];

        $total = UlrLink::count();
        $query = UlrLink::query();

        $startDate = $request->query('start_date');
        $endDate = $request->query('end_date');
        if ($startDate && $endDate) {
            $query->whereBetween('date', [$startDate, $endDate]);
        }

        $search = trim((string) $request->query('search', ''));
        if ($search !== '') {
            $query->where(function ($q) use ($columns, $search) {
                foreach ($columns as $col) $q->orWhere($col, 'like', '%' . $search . '%');
            });
        }

        $filtered = (clone $query)->count();

        $sortCol = $request->query('sort');
        if (in_array($sortCol, $columns, true)) {
            $query->orderBy($sortCol, $request->query('dir') === 'desc' ? 'desc' : 'asc')->orderByDesc('id');
        } else {
            $this->latestFirst($query);
        }

        $perPage = max(1, min(100, (int) $request->query('per_page', 10)));
        $page = max(1, (int) $request->query('page', 1));
        $rows = $query->forPage($page, $perPage)->get(array_merge(['id'], $columns));

        $this->restoreHindiWork($rows);

        return response()->json([
            'data' => $rows,
            'total' => $total,
            'filtered' => $filtered,
        ]);
    }
}
