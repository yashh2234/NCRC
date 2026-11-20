<?php

namespace App\Services;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

/**
 * Reads a tender PDF with Google Gemini and returns a structured summary.
 * The model name comes from GEMINI_MODEL so a retired model is a one-line .env change.
 */
class TenderDocumentAnalyzer
{
    private const API = 'https://generativelanguage.googleapis.com';

    /** PDFs up to this size are sent inside the request; bigger ones go through the Files API. */
    private const INLINE_LIMIT = 14 * 1024 * 1024;

    private const PROMPT = <<<'TXT'
You are helping an Indian construction materials testing laboratory (NCRC) decide whether to bid on a government / PSU tender.
Read the whole attached tender document (all pages, including tables, corrigenda and annexures) and reply with ONE JSON object only, no other text, in exactly this shape:

{
  "overview": "2-4 plain sentences: what the work is, for whom, where, and anything decisive",
  "tender_id": "", "title": "", "department": "", "location": "", "portal": "",
  "tender_value": "", "emd": "", "emd_exemption": "", "tender_fee": "",
  "contract_period": "", "bid_validity": "",
  "dates": [{"label": "", "date": "YYYY-MM-DD", "time": "HH:MM or empty"}],
  "scope_of_work": [""],
  "eligibility": [""],
  "documents_required": [""],
  "technical_requirements": [""],
  "payment_terms": [""],
  "penalties": [""],
  "contact": "",
  "points_to_watch": [""],
  "conflicts": [""]
}

Work in two passes: first read every page and note every requirement with its page number; then fill the JSON from those notes.

Rules:
- Use only what the document says. If something is not in the document, use "" (or [] for lists). Never guess.
- Be EXHAUSTIVE. Lists must contain every item the document gives - do not shorten, merge, sample or pick "the main ones". A tender often lists the same documents in several places (e.g. separate lists for approved and unapproved bidders): combine them into one complete list without duplicates, and say who an item applies to when it differs ("unenlisted bidders only").
- End every list item with the page reference in brackets, e.g. "(p. 11)", using the PDF page number (the first page of the file is p. 1), not page numbers printed inside the document.
- Amounts in rupees as written, e.g. "Rs. 12,50,000" or "Rs. 2.5 Lakh".
- dates: every key date (publish, pre-bid meeting, query deadline, bid submission end, technical/financial bid opening, document sale end, physical submission deadline). Use YYYY-MM-DD; if the year is missing, put the date as written.
- eligibility: each criterion separately and specifically (turnover with amount and years, similar work experience with values, registrations/enlistment class, certifications such as NABL, manpower with qualifications and years, software, equipment, nationality/foreign affiliation, who must certify experience and turnover).
- documents_required: every document, certificate, affidavit, undertaking, DD/EMD instrument and form the bidder must upload or send physically.
- technical_requirements: every test, standard and code by its number (IS / ASTM / BS / ISO clauses), accreditation and deliverable (number of copies, vetting authority).
- penalties: every penalty, liquidated damages, compensation rate with its cap, deduction, forfeiture, ban/blacklisting and performance security.
- points_to_watch: everything a bidder could lose the bid or money over - short deadlines (e.g. physical documents within N days, appeal within N days), bans, EMD exemptions, MSE provisions, site visit, vetting/approval by outside bodies, jurisdiction and arbitration, unusual or onerous conditions.
- conflicts: every place where the document contradicts itself, comparing the SAME topic across pages - completion period, penalty/compensation rate, amounts, dates, portal/website, jurisdiction, accepting officer, name of work, or text that obviously belongs to a different tender. State both versions with their pages, e.g. "Completion period: 180 days (p. 9) vs 04 months (p. 16, p. 21) vs 06 months (p. 14)". Use [] only if there is truly no contradiction.
- Keep each list item to one clear sentence. Write in English.
TXT;

    /** Error code used for "Gemini is busy / overloaded", which triggers the fallback model. */
    private const BUSY = 503;

    /** Model that actually produced the last summary (the main model, or the fallback). */
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

    /** @return array<string, mixed> normalised summary */
    public function analyze(string $pdfPath): array
    {
        if (blank($this->apiKey)) {
            throw new RuntimeException('Tender analysis is not set up yet: the AI API key is missing on the server. Please ask the admin to add it.');
        }

        $size = filesize($pdfPath) ?: 0;
        $document = $size <= self::INLINE_LIMIT
            ? ['inlineData' => ['mimeType' => 'application/pdf', 'data' => base64_encode((string) file_get_contents($pdfPath))]]
            : ['fileData' => ['mimeType' => 'application/pdf', 'fileUri' => $this->uploadFile($pdfPath, $size)]];

        $body = [
            'contents' => [[
                'role' => 'user',
                'parts' => [$document, ['text' => self::PROMPT]],
            ]],
            'generationConfig' => [
                'responseMimeType' => 'application/json',
                'temperature' => 0,
                'maxOutputTokens' => 16384,
            ],
        ];

        // Free-tier Flash models are often overloaded; fall back to the lighter model rather than fail.
        $response = null;
        $models = array_values(array_unique(array_filter([$this->model, $this->fallbackModel])));
        foreach ($models as $i => $model) {
            try {
                // Give up on a busy main model quickly so the fallback can start; the last model gets the full wait.
                $last = $i === count($models) - 1;
                $response = $this->send('post', "/v1beta/models/{$model}:generateContent", $body, $last ? 150 : 90, $last ? [3, 8, 15] : [4]);
                $this->usedModel = $model;
                break;
            } catch (RuntimeException $e) {
                if ($e->getCode() !== self::BUSY || $i === count($models) - 1) {
                    throw $e;
                }
            }
        }

        $data = $response->json();
        if (! empty($data['promptFeedback']['blockReason'])) {
            throw new RuntimeException('The AI model refused to read this document ('.$data['promptFeedback']['blockReason'].').');
        }

        $text = collect($data['candidates'][0]['content']['parts'] ?? [])->pluck('text')->filter()->implode('');
        $finish = $data['candidates'][0]['finishReason'] ?? null;
        if ($text === '') {
            throw new RuntimeException('The AI model returned no summary'.($finish ? " ({$finish})" : '').'. Try again, or try a smaller PDF.');
        }

        $json = json_decode($this->stripFences($text), true);
        if (! is_array($json)) {
            throw new RuntimeException('The AI model returned an unreadable summary'.($finish === 'MAX_TOKENS' ? ' (the document was too long to summarise in one go)' : '').'. Please try again.');
        }

        return $this->normalise($json);
    }

    /** Files API resumable upload for large PDFs; returns the file URI once Gemini has processed it. */
    private function uploadFile(string $path, int $size): string
    {
        try {
            $start = $this->request()
                ->withHeaders([
                    'X-Goog-Upload-Protocol' => 'resumable',
                    'X-Goog-Upload-Command' => 'start',
                    'X-Goog-Upload-Header-Content-Length' => (string) $size,
                    'X-Goog-Upload-Header-Content-Type' => 'application/pdf',
                ])
                ->post(self::API.'/upload/v1beta/files', ['file' => ['display_name' => basename($path)]]);
            $this->assertOk($start);

            $uploadUrl = $start->header('x-goog-upload-url');
            if (! $uploadUrl) {
                throw new RuntimeException('The AI model did not accept the file upload.');
            }

            $done = $this->request(300)
                ->withHeaders(['X-Goog-Upload-Offset' => '0', 'X-Goog-Upload-Command' => 'upload, finalize'])
                ->withBody((string) file_get_contents($path), 'application/pdf')
                ->post($uploadUrl);
            $this->assertOk($done);
        } catch (ConnectionException $e) {
            throw new RuntimeException('Could not upload the PDF to the AI model (timed out or no connection). Please try again.', 0, $e);
        }

        $file = $done->json('file') ?? [];
        $uri = $file['uri'] ?? null;
        $name = $file['name'] ?? null;
        if (! $uri) {
            throw new RuntimeException('The AI model did not return the uploaded file.');
        }

        // Large files are processed before they can be used.
        for ($i = 0; $name && ($file['state'] ?? 'ACTIVE') === 'PROCESSING' && $i < 30; $i++) {
            sleep(2);
            $file = $this->send('get', "/v1beta/{$name}", null, 30)->json() ?? [];
        }
        if (($file['state'] ?? 'ACTIVE') === 'FAILED') {
            throw new RuntimeException('The AI model could not process this PDF.');
        }

        return $uri;
    }

    private function request(int $timeout = 60)
    {
        return Http::withHeaders(['x-goog-api-key' => (string) $this->apiKey])->timeout($timeout)->acceptJson();
    }

    /** @param int[] $waits seconds to wait before each retry when Gemini answers busy */
    private function send(string $method, string $path, ?array $body, int $timeout, array $waits = [3, 8, 15]): Response
    {
        // The free tier often answers 503 "high demand" for a few seconds; wait and retry before giving up.
        for ($attempt = 0; ; $attempt++) {
            try {
                $response = $method === 'get'
                    ? $this->request($timeout)->get(self::API.$path)
                    : $this->request($timeout)->post(self::API.$path, $body ?? []);
            } catch (ConnectionException $e) {
                throw new RuntimeException('The AI model did not answer in time (it may be overloaded). Please try again in a few minutes.', self::BUSY, $e);
            }

            if (in_array($response->status(), [500, 503], true) && $attempt < count($waits)) {
                sleep($waits[$attempt]);
                continue;
            }

            $this->assertOk($response);

            return $response;
        }
    }

    private function assertOk(Response $response): void
    {
        if ($response->successful()) {
            return;
        }

        $message = (string) ($response->json('error.message') ?? $response->body());
        $busy = in_array($response->status(), [429, 500, 503, 504], true);
        // Full details go to the server log; users only see a plain message.
        Log::warning('Tender AI request failed', ['status' => $response->status(), 'model' => $this->model, 'message' => mb_strimwidth($message, 0, 500, '…')]);
        throw new RuntimeException(code: $busy ? self::BUSY : 0, message: match (true) {
            $response->status() === 429 => 'AI usage limit reached for now. Wait a minute and try again.',
            in_array($response->status(), [500, 503], true) => 'The AI model is busy right now (high demand). Please try again in a few minutes.',
            $response->status() === 404 => 'The AI model is not available right now. Please ask the admin to update the AI model setting on the server.',
            in_array($response->status(), [400, 401, 403], true) && str_contains(strtolower($message), 'api key') => 'The AI API key on the server is not valid. Please ask the admin to check it.',
            default => 'AI error '.$response->status().'. Please try again.',
        });
    }

    private function stripFences(string $text): string
    {
        $text = trim($text);
        if (str_starts_with($text, '```')) {
            $text = preg_replace('/^```(?:json)?\s*|\s*```$/', '', $text);
        }

        return trim((string) $text);
    }

    /** Keeps only the expected fields, as clean strings / lists of strings. */
    private function normalise(array $raw): array
    {
        $str = fn ($v) => is_scalar($v) ? trim((string) $v) : '';
        $list = fn ($v) => array_values(array_filter(array_map(
            fn ($i) => is_scalar($i) ? trim((string) $i) : (is_array($i) ? trim(implode(' — ', array_filter(array_map(fn ($x) => is_scalar($x) ? (string) $x : '', $i)))) : ''),
            is_array($v) ? $v : ($v ? [$v] : []),
        ), fn ($s) => $s !== ''));

        $out = [];
        foreach (['overview', 'tender_id', 'title', 'department', 'location', 'portal', 'tender_value', 'emd', 'emd_exemption', 'tender_fee', 'contract_period', 'bid_validity', 'contact'] as $key) {
            $out[$key] = $str($raw[$key] ?? '');
        }
        foreach (['scope_of_work', 'eligibility', 'documents_required', 'technical_requirements', 'payment_terms', 'penalties', 'points_to_watch', 'conflicts'] as $key) {
            $out[$key] = $list($raw[$key] ?? []);
        }
        $out['dates'] = array_values(array_filter(array_map(fn ($d) => is_array($d) ? [
            'label' => $str($d['label'] ?? ''),
            'date' => $str($d['date'] ?? ''),
            'time' => $str($d['time'] ?? ''),
        ] : null, is_array($raw['dates'] ?? null) ? $raw['dates'] : []), fn ($d) => $d && ($d['label'] !== '' || $d['date'] !== '')));

        return $out;
    }
}
