<?php

namespace App\Services;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

/**
 * Writes the text of a Namotech client proposal from a short brief, using Google Gemini
 * (same key / model settings as the tender summaries). Returns sections in the light
 * markup the proposal print understands; layout, letterhead and numbering are added by the app.
 */
class ProposalWriter
{
    private const API = 'https://generativelanguage.googleapis.com';

    private const BUSY = 503;

    private const PROMPT = <<<'TXT'
You write technical / commercial proposals for NAMOTECH CONSULTANCY SERVICES LLP, Jaipur (an ISO/IEC 17025 accredited firm: laboratory testing, structural & geotechnical consultancy, NDT, surveys, safety audits and assessments).
From the BRIEF below, write the full text of one proposal and reply with ONE JSON object only, no other text, in exactly this shape:

{
  "title": "PROPOSAL FOR ... (upper case, the cover-page heading)",
  "project_name": "PROJECT / SITE NAME, CITY (upper case)",
  "submitted_to": "Line 1 = addressee designation (e.g. The Secretary)\nLine 2 = organisation\nLine 3 = city, state",
  "sections": [ {"heading": "Background", "body": "...", "fee": false} ],
  "fee_rows": [ {"description": "...", "amount": 15000} ],
  "fee_note": "GST be charged extra.",
  "supporting_info": ""
}

Follow the structure and tone of Namotech's standard proposals. Usual sections, in this order (leave out any that do not fit the brief, add others the brief needs):
Background; Objective of the Assignment; Proposed Scope of Work; (one section per main test / activity, e.g. Non-Destructive Testing (NDT)); special assessments the brief mentions; Repair Recommendations & Methodology (only for repair / distress jobs); Brief Work Plan; Deliverables; Professional Fee; Exclusions / Additional Scope; Technical Limitations; Site Monitoring; Client Support / Requirements; Conclusion.

Writing rules:
- "heading" is the section name in Title Case WITHOUT a number (the app numbers sections 1, 2, 3 ... and sub-sections 3.1, 3.2 ...).
- "body" uses only this markup:
  - a blank line between paragraphs
  - "## Sub heading" for a numbered sub-section (no number in the text)
  - "**text**" for bold; use bold for key facts (site name, quantities, the main problem, exclusions)
  - "- item" for bullet points, "1. item" for numbered steps
  - a line that is only "**Label**" for an un-numbered bold label (e.g. "**Stage 1 – Preliminary Site Reconnaissance**")
  - tables as "| Sr. No. | Activity | Quantity |" rows, first row is the header, no separator row needed
- Formal Indian-English consulting style: "shall be carried out", "wherever accessible", "subject to site conditions". Precise and professional; no marketing language.
- Use only the facts in the brief (client, site, observed problems, tests, quantities, rates, dates). Do not invent site observations, test results, standards that do not apply, or prices. Where an IS code is the normal standard for a test the brief names, you may cite it.
- The section with "fee": true is the Professional Fee section; its body is only the short sentence before the table (e.g. "The proposed professional fee for the above scope is:"). Put each fee line in "fee_rows": description including quantity and rate when given (e.g. "Rebound Hammer + UPV Testing – 25 locations @ ₹2,500/-") and "amount" as a plain number in rupees (quantity × rate). If the brief gives no price for a line, use amount 0. Do not add a total row; the app adds the total and the amount in words.
- "fee_note" is the tax note (default "GST be charged extra."); add payment terms there only if the brief gives them, copied exactly — never add a balance, milestone or condition the brief does not state.
- "supporting_info": annexures the brief mentions, one per line as "**Annexure A:** Existing Site Condition Photographs"; otherwise "".
- Do not write the signature block, letterhead, table of contents, reference number or date: the app adds them.
- If the brief is a finished proposal text, keep its wording and only fit it into this structure.

BRIEF:
TXT;

    private ?string $usedModel = null;

    public function __construct(private ?string $apiKey = null, private ?string $model = null, private ?string $fallbackModel = null)
    {
        $this->apiKey ??= config('services.gemini.key');
        $this->model ??= config('services.gemini.model', 'gemini-flash-lite-latest');
        $this->fallbackModel ??= config('services.gemini.fallback_model', 'gemini-flash-latest');
    }

    public function model(): string
    {
        return (string) ($this->usedModel ?? $this->model);
    }

    /** @return array<string, mixed> draft proposal (title, project_name, submitted_to, sections, fee_rows, fee_note, supporting_info) */
    public function write(string $brief): array
    {
        if (blank($this->apiKey)) {
            throw new RuntimeException('AI writing is not set up yet: the AI API key is missing on the server. Please ask the admin to add it.');
        }

        $body = [
            'contents' => [[
                'role' => 'user',
                'parts' => [['text' => self::PROMPT."\n".trim($brief)]],
            ]],
            'generationConfig' => [
                'responseMimeType' => 'application/json',
                'temperature' => 0.4,
                'maxOutputTokens' => 16384,
            ],
        ];

        $response = null;
        $models = array_values(array_unique(array_filter([$this->model, $this->fallbackModel])));
        foreach ($models as $i => $model) {
            $last = $i === count($models) - 1;
            try {
                $response = $this->send("/v1beta/models/{$model}:generateContent", $body, $last ? 150 : 90, $last ? [3, 8, 15] : [4]);
                $this->usedModel = $model;
                break;
            } catch (RuntimeException $e) {
                if ($e->getCode() !== self::BUSY || $last) {
                    throw $e;
                }
            }
        }

        $data = $response->json();
        if (! empty($data['promptFeedback']['blockReason'])) {
            throw new RuntimeException('The AI model refused this brief ('.$data['promptFeedback']['blockReason'].').');
        }

        $text = collect($data['candidates'][0]['content']['parts'] ?? [])->pluck('text')->filter()->implode('');
        $finish = $data['candidates'][0]['finishReason'] ?? null;
        $json = json_decode($this->stripFences($text), true);
        if (! is_array($json)) {
            throw new RuntimeException('The AI model returned no usable proposal'.($finish === 'MAX_TOKENS' ? ' (it ran out of space; shorten the brief)' : '').'. Please try again.');
        }

        return $this->normalise($json);
    }

    private function send(string $path, array $body, int $timeout, array $waits): Response
    {
        for ($attempt = 0; ; $attempt++) {
            try {
                $response = Http::withHeaders(['x-goog-api-key' => (string) $this->apiKey])
                    ->timeout($timeout)->acceptJson()->post(self::API.$path, $body);
            } catch (ConnectionException $e) {
                throw new RuntimeException('The AI model did not answer in time (it may be overloaded). Please try again in a few minutes.', self::BUSY, $e);
            }

            if (in_array($response->status(), [500, 503], true) && $attempt < count($waits)) {
                sleep($waits[$attempt]);
                continue;
            }

            if ($response->successful()) {
                return $response;
            }

            $message = (string) ($response->json('error.message') ?? $response->body());
            $busy = in_array($response->status(), [429, 500, 503, 504], true);
            Log::warning('Proposal AI request failed', ['status' => $response->status(), 'message' => mb_strimwidth($message, 0, 500, '…')]);
            throw new RuntimeException(code: $busy ? self::BUSY : 0, message: match (true) {
                $response->status() === 429 => 'AI usage limit reached for now. Wait a minute and try again.',
                in_array($response->status(), [500, 503], true) => 'The AI model is busy right now (high demand). Please try again in a few minutes.',
                $response->status() === 404 => 'The AI model is not available right now. Please ask the admin to update the AI model setting on the server.',
                in_array($response->status(), [400, 401, 403], true) && str_contains(strtolower($message), 'api key') => 'The AI API key on the server is not valid. Please ask the admin to check it.',
                default => 'AI error '.$response->status().'. Please try again.',
            });
        }
    }

    private function stripFences(string $text): string
    {
        $text = trim($text);
        if (str_starts_with($text, '```')) {
            $text = (string) preg_replace('/^```(?:json)?\s*|\s*```$/', '', $text);
        }

        return trim($text);
    }

    private function normalise(array $raw): array
    {
        $str = fn ($v) => is_scalar($v) ? trim((string) $v) : '';

        $sections = [];
        foreach (is_array($raw['sections'] ?? null) ? $raw['sections'] : [] as $s) {
            if (! is_array($s)) {
                continue;
            }
            $heading = preg_replace('/^\s*\d+(\.\d+)*[.)]?\s+/', '', $str($s['heading'] ?? ''));
            $body = is_array($s['body'] ?? null) ? implode("\n", array_map($str, $s['body'])) : $str($s['body'] ?? '');
            if ($heading === '' && $body === '') {
                continue;
            }
            $sections[] = ['heading' => $heading, 'body' => $body, 'fee' => (bool) ($s['fee'] ?? false)];
        }

        $rows = [];
        foreach (is_array($raw['fee_rows'] ?? null) ? $raw['fee_rows'] : [] as $r) {
            if (! is_array($r)) {
                continue;
            }
            $amount = is_numeric($r['amount'] ?? null) ? (float) $r['amount'] : (float) preg_replace('/[^\d.]/', '', $str($r['amount'] ?? ''));
            $rows[] = ['description' => $str($r['description'] ?? ''), 'amount' => $amount];
        }

        return [
            'title' => $str($raw['title'] ?? ''),
            'project_name' => $str($raw['project_name'] ?? ''),
            'submitted_to' => $str($raw['submitted_to'] ?? ''),
            'sections' => $sections,
            'fee_rows' => $rows,
            'fee_note' => $str($raw['fee_note'] ?? '') ?: 'GST be charged extra.',
            'supporting_info' => $str($raw['supporting_info'] ?? ''),
            'model' => $this->model(),
        ];
    }
}
