<?php

namespace App\Services;

use App\Models\AiProvider;
use RuntimeException;

/**
 * Writes the text of a Namotech client proposal from a short brief with the free AI services (OpenRouter, then Groq),
 * and asks for what the brief leaves out. Returns sections in the light markup the proposal print understands;
 * layout, letterhead and numbering are added by the app.
 */
class ProposalWriter
{
    private const ORDER = ['openrouter', 'groq'];

    /** Characters of company knowledge; Groq's free limit per minute is small */
    private const KNOWLEDGE_CHARS = ['openrouter' => 22000, 'groq' => 5000];

    public const MAX_QUESTIONS = 8;

    private const QUESTIONS = <<<'TXT'
You help NAMOTECH CONSULTANCY SERVICES LLP, Jaipur (civil engineering consultancy, ISO/IEC 17025 accredited laboratory, surveys, safety audits) to write technical / commercial proposals.
Read the BRIEF and the COMPANY KNOWLEDGE. Decide which facts a good proposal needs that neither of them gives, and reply with ONE JSON object only, no other text:

{"questions": [{"question": "...", "why": "...", "suggestions": ["...", "..."], "company": false}]}

Rules:
- At most 8 questions, the most important first; only what would change the text, the scope or the price. An empty list when the brief is enough.
- Think of: client and addressee, site and city, size and floors, purpose or the problem seen, exact scope and stages, quantities, deliverables, who arranges what (access, drawings, power, scaffolding), time, number of site visits, fee basis, GST, payment stages, validity, exclusions.
- Never ask for what the brief or the company knowledge already says, for the reference number, date, signatory or letterhead, or for a total that can be calculated.
- "question": short and plain, one fact each. "why": at most 12 words. "suggestions": 2 to 4 short realistic answers to choose from, without invented names.
- "company" is true only when the answer is a lasting fact about Namotech itself that is true for every proposal (e.g. standard payment terms, an empanelment number). Facts about this client or project are false.
TXT;

    private const PROMPT = <<<'TXT'
You write technical / commercial proposals for NAMOTECH CONSULTANCY SERVICES LLP, Jaipur (an ISO/IEC 17025 accredited firm: laboratory testing, structural & geotechnical consultancy, architecture and MEP design, PMC, NDT, surveys, safety audits and assessments).
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

Follow the structure and tone of Namotech's standard proposals. Usual sections for testing and assessment jobs, in this order (leave out any that do not fit the brief, add others the brief needs):
Background; Objective of the Assignment; Proposed Scope of Work; (one section per main test / activity, e.g. Non-Destructive Testing (NDT)); special assessments the brief mentions; Repair Recommendations & Methodology (only for repair / distress jobs); Brief Work Plan; Deliverables; Professional Fee; Exclusions / Additional Scope; Technical Limitations; Site Monitoring; Client Support / Requirements; Conclusion.
For design and PMC jobs use: Background; Objective of the Assignment; Project Understanding; Proposed Scope of Work (one sub-section per discipline the brief names, e.g. Architecture, Structure, MEP, PMC, each with its stages and activities); Applicable Codes & Standards; Methodology & Work Plan; Deliverables (stage-wise table); Relevant Experience of Namotech (only if the company knowledge has fitting projects); Professional Fee; Payment Schedule (only if given); Exclusions / Additional Scope; Client Support / Requirements; Conclusion.

Writing rules:
- "heading" is the section name in Title Case WITHOUT a number (the app numbers sections 1, 2, 3 ... and sub-sections 3.1, 3.2 ...).
- "body" uses only this markup:
  - a blank line between paragraphs
  - "## Sub heading" for a numbered sub-section (no number in the text)
  - "**text**" for bold; use bold for key facts (site name, quantities, the main problem, exclusions)
  - "- item" for bullet points, "1. item" for numbered steps
  - a line that is only "**Label**" for an un-numbered bold label (e.g. "**Stage 1 – Preliminary Site Reconnaissance**")
  - tables as "| Sr. No. | Activity | Quantity |" rows, first row is the header, no separator row needed
- Write every section fully, as it would be sent to the client; a scope section names each activity and what it produces.
- Formal Indian-English consulting style: "shall be carried out", "wherever accessible", "subject to site conditions". Precise and professional; no marketing language.
- Facts about the client, site, problem, quantities, rates and dates come only from the BRIEF. Do not invent site observations, test results, standards that do not apply, or prices. Where an IS / NBC / IRC code is the normal standard for the work the brief names, you may cite it.
- Where a needed fact is not given, write **[to be confirmed]** in its place; do not guess it.
- COMPANY KNOWLEDGE is about Namotech itself: use it for what the company does, its accreditation and real projects, only where it fits this job. Never state a credential that is not in it. EARLIER PROPOSAL texts show wording and depth only: never take their client, site, quantities, dates or prices.
- The section with "fee": true is the Professional Fee section; its body is only the short sentence before the table (e.g. "The proposed professional fee for the above scope is:"). Put each fee line in "fee_rows": description including quantity and rate when given (e.g. "Rebound Hammer + UPV Testing – 25 locations @ ₹2,500/-" or "Architecture, Structure, MEP and PMC – 8,000 sq ft @ ₹50/- per sq ft") and "amount" as a plain number in rupees (quantity × rate). If the brief gives no price for a line, use amount 0. Do not add a total row; the app adds the total and the amount in words.
- "fee_note" is the tax note (default "GST be charged extra."); add payment terms there only if the brief or a FACT gives them, copied exactly — never add a balance, milestone or condition that is not stated.
- "supporting_info": annexures the brief mentions, one per line as "**Annexure A:** Existing Site Condition Photographs"; otherwise "".
- Do not write the signature block, letterhead, table of contents, reference number or date: the app adds them.
- If the brief is a finished proposal text, keep its wording and only fit it into this structure.
TXT;

    private string $usedModel = '';

    public function __construct(private AiRouter $ai, private CompanyKnowledgeBase $knowledge) {}

    /** @return array<int, array{question: string, why: string, suggestions: string[], company: bool}> */
    public function questions(string $brief): array
    {
        $json = $this->ask(self::QUESTIONS, $brief, [
            'timeout' => 60, 'deadline' => 120, 'max_tokens' => 4000, 'temperature' => 0.2, 'groq_max_tokens' => 2000,
            'accept' => fn (array $json) => is_array($json['questions'] ?? null),
        ]);

        $str = fn ($v, int $max) => is_scalar($v) ? mb_substr(trim((string) $v), 0, $max) : '';
        $list = [];
        foreach ($json['questions'] as $q) {
            $question = is_array($q) ? $str($q['question'] ?? '', 300) : '';
            if ($question === '') {
                continue;
            }
            $suggestions = array_map(fn ($s) => $str($s, 150), is_array($q['suggestions'] ?? null) ? $q['suggestions'] : []);
            $list[] = [
                'question' => $question,
                'why' => $str($q['why'] ?? '', 200),
                'suggestions' => array_slice(array_values(array_filter($suggestions, fn (string $s) => $s !== '')), 0, 4),
                'company' => ($q['company'] ?? false) === true,
            ];
        }

        return array_slice($list, 0, self::MAX_QUESTIONS);
    }

    /**
     * @param  string[]  $open  questions the user left unanswered
     * @return array<string, mixed> draft proposal (title, project_name, submitted_to, sections, fee_rows, fee_note, supporting_info)
     */
    public function write(string $brief, array $open = []): array
    {
        $prompt = self::PROMPT;
        if ($open) {
            $prompt .= "\n- Not known yet, write **[to be confirmed]** where these matter: ".implode(' | ', $open);
        }

        return $this->normalise($this->ask($prompt, $brief, [
            'timeout' => 150, 'deadline' => 260, 'max_tokens' => 16000, 'temperature' => 0.4, 'groq_max_tokens' => 5000,
            'accept' => fn (array $json) => is_array($json['sections'] ?? null) && $json['sections'] !== [],
        ]));
    }

    private function ask(string $prompt, string $brief, array $options): array
    {
        $answer = $this->ai->json(
            fn (AiProvider $provider) => $prompt
                ."\n\nCOMPANY KNOWLEDGE:\n".($this->knowledge->context($brief, self::KNOWLEDGE_CHARS[$provider->provider] ?? 5000) ?: '(none)')
                ."\n\nBRIEF:\n".trim($brief),
            self::ORDER,
            $options + ['only' => self::ORDER, 'large' => true],
        );
        if ($answer === null) {
            throw new RuntimeException($this->whyNot());
        }
        $this->usedModel = $answer['model'];

        return $answer['data'];
    }

    /** What stopped each service, so the user knows whether to wait or to tell the admin */
    private function whyNot(): string
    {
        $problems = [];
        foreach (AiProvider::ordered()->whereIn('provider', self::ORDER)->sortBy(fn (AiProvider $p) => array_search($p->provider, self::ORDER, true)) as $p) {
            $problems[] = $p->label().': '.match (true) {
                $p->key() === '' => 'no key is saved.',
                ! $p->enabled => 'switched off.',
                default => $p->last_error ?: 'no answer.',
            };
        }

        return 'The AI could not answer. '.implode(' ', $problems).' Keys are set in Administration → Free AI keys; a used-up free limit frees itself after a while.';
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
            'model' => $this->usedModel,
        ];
    }
}
