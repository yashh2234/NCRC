<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Proposal;
use App\Services\ProposalWriter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

class ProposalController extends Controller
{
    public function index(): JsonResponse
    {
        $proposals = Proposal::query()->latest('id')->get()->map(fn (Proposal $p) => $p->toApi(false));

        return response()->json(['data' => $proposals]);
    }

    public function show(Proposal $proposal): JsonResponse
    {
        return response()->json(['data' => $proposal->toApi()]);
    }

    public function store(Request $request): JsonResponse
    {
        $proposal = Proposal::create($this->validated($request) + [
            'created_by' => $request->user()?->id,
            'updated_by' => $request->user()?->id,
        ]);

        return response()->json(['data' => $proposal->toApi()], 201);
    }

    public function update(Request $request, Proposal $proposal): JsonResponse
    {
        $proposal->update($this->validated($request) + ['updated_by' => $request->user()?->id]);

        return response()->json(['data' => $proposal->toApi()]);
    }

    public function destroy(Proposal $proposal): JsonResponse
    {
        $proposal->delete();

        return response()->json(['message' => 'Proposal deleted']);
    }

    /** What the AI needs to know besides the brief; an empty list when the brief is enough. */
    public function questions(Request $request, ProposalWriter $writer): JsonResponse
    {
        $brief = $this->brief($request);
        @set_time_limit(180);

        try {
            return response()->json(['data' => $writer->questions($brief)]);
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    /** Writes a proposal draft from a brief with the AI model. Nothing is saved here. */
    public function generate(Request $request, ProposalWriter $writer): JsonResponse
    {
        $brief = $this->brief($request);
        $open = $request->validate(['open' => ['nullable', 'array', 'max:'.ProposalWriter::MAX_QUESTIONS], 'open.*' => ['string', 'max:300']])['open'] ?? [];

        @set_time_limit(320);

        try {
            $draft = $writer->write($brief, $open);
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json(['data' => $draft]);
    }

    private function brief(Request $request): string
    {
        return $request->validate(['brief' => ['required', 'string', 'min:10', 'max:60000']], ['brief.min' => 'Write in a few words what the proposal is for.'])['brief'];
    }

    private function validated(Request $request): array
    {
        $values = $request->validate([
            'ref_no' => ['nullable', 'string', 'max:100'],
            'proposal_date' => ['nullable', 'date'],
            'title' => ['required', 'string', 'max:500'],
            'project_name' => ['nullable', 'string', 'max:500'],
            'submitted_to' => ['nullable', 'string', 'max:2000'],
            'sections' => ['nullable', 'array', 'max:60'],
            'sections.*.heading' => ['nullable', 'string', 'max:300'],
            'sections.*.body' => ['nullable', 'string', 'max:60000'],
            'sections.*.fee' => ['nullable', 'boolean'],
            'fee_rows' => ['nullable', 'array', 'max:100'],
            'fee_rows.*.description' => ['nullable', 'string', 'max:1000'],
            'fee_rows.*.amount' => ['nullable', 'numeric', 'min:0'],
            'fee_note' => ['nullable', 'string', 'max:500'],
            'supporting_info' => ['nullable', 'string', 'max:5000'],
            'signatory_name' => ['nullable', 'string', 'max:150'],
            'signatory_designation' => ['nullable', 'string', 'max:150'],
            'brief' => ['nullable', 'string', 'max:60000'],
        ], [
            'title.required' => 'Enter the proposal title.',
        ]);

        $values['sections'] = array_values(array_map(fn ($s) => [
            'heading' => trim((string) ($s['heading'] ?? '')),
            'body' => rtrim((string) ($s['body'] ?? '')),
            'fee' => (bool) ($s['fee'] ?? false),
        ], $values['sections'] ?? []));

        $values['fee_rows'] = array_values(array_map(fn ($r) => [
            'description' => trim((string) ($r['description'] ?? '')),
            'amount' => round((float) ($r['amount'] ?? 0), 2),
        ], $values['fee_rows'] ?? []));

        foreach (['ref_no', 'project_name', 'submitted_to', 'fee_note', 'supporting_info', 'signatory_name', 'signatory_designation', 'brief'] as $key) {
            $values[$key] = $values[$key] ?? null;
        }
        $values['proposal_date'] = $values['proposal_date'] ?? null;

        return $values;
    }
}
