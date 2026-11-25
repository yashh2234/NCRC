<?php

namespace App\Services;

/**
 * Turns the summary of a tender PDF into the columns of the tender table. A free AI (Groq, OpenRouter, Gemini)
 * sorts the dates and tidies the texts; amounts, dates and phone numbers it gives must be in the summary,
 * otherwise (and when no AI answers) they are taken over directly.
 */
class TenderFieldFiller
{
    private const PROMPT = <<<'TXT'
Below is the summary (JSON) of an Indian government / PSU tender. Fill the columns of a tender register from it and reply with ONE JSON object only, no other text:

{"tenderId":"","title":"","department":"","portal":"","location":"","value":"","emd":"","fee":"","openDate":"","preBidDate":"","queryDate":"","closingDate":"","closingTime":"","openingDate":"","contactName":"","contactDesignation":"","contactPhone":"","requirements":""}

Rules:
- Use only what the summary says; leave "" when it is not there. Never guess. Leave out page references such as "(p. 11)".
- title: the name of the work. department: the client / organisation that invites the tender. location: city / site, short.
- portal: name of the website the bid is submitted on (e.g. GeM, CPPP, MES e-procurement).
- value, emd, fee: one amount as written, e.g. "Rs. 12,50,000" (if there are several, the one for the whole work).
- Dates as YYYY-MM-DD, copied from "dates": openDate = published / document available from; preBidDate = pre-bid meeting; queryDate = last date for queries / clarifications; closingDate = last date to submit the bid online (not the physical documents); openingDate = technical bid opening (not the financial one).
- closingTime: time of the bid submission closing as HH:MM (24 hours).
- contactName / contactDesignation / contactPhone: the person on the client's side. contactName only when a person's name is given; an office such as "Garrison Engineer (AF) Suratgarh" is a designation.
- requirements: the main documents needed, at most 20 words, separated by commas.

SUMMARY:
TXT;

    /** Same width as the database columns */
    private const LIMITS = [
        'tenderId' => 250, 'title' => 2000, 'department' => 250, 'portal' => 250, 'location' => 250,
        'value' => 100, 'emd' => 100, 'fee' => 100,
        'contactName' => 250, 'contactDesignation' => 250, 'contactPhone' => 100, 'requirements' => 500,
    ];

    /** Values that must consist of numbers of this part of the summary */
    private const SOURCES = ['tenderId' => 'tender_id', 'value' => 'tender_value', 'emd' => 'emd', 'fee' => 'tender_fee', 'contactPhone' => 'contact'];

    private const DATES = ['openDate', 'preBidDate', 'queryDate', 'closingDate', 'openingDate'];

    public function __construct(private AiRouter $ai) {}

    /** @return array<string, string> */
    public function fill(array $summary): array
    {
        $fields = $this->direct($summary);
        $answer = $this->ai->json(self::PROMPT."\n".json_encode($this->short($summary), JSON_UNESCAPED_UNICODE), ['groq', 'openrouter', 'gemini']);

        return $answer === null ? $fields : $this->merge($fields, $answer['data'], $summary);
    }

    /** Only what the columns need: the free services take short questions only. */
    private function short(array $summary): array
    {
        $short = [];
        foreach (['overview', 'tender_id', 'title', 'department', 'location', 'portal', 'tender_value', 'emd', 'tender_fee', 'contact'] as $key) {
            $short[$key] = mb_strimwidth((string) ($summary[$key] ?? ''), 0, 1200, '…');
        }
        $short['dates'] = array_slice($summary['dates'] ?? [], 0, 25);
        $short['documents_required'] = array_map(fn ($d) => mb_strimwidth((string) $d, 0, 120, '…'), array_slice($summary['documents_required'] ?? [], 0, 20));

        return $short;
    }

    /** Without any AI */
    public function direct(array $summary): array
    {
        $text = fn (string $key) => $this->clean((string) ($summary[$key] ?? ''));
        $contact = $text('contact');
        preg_match('/(?:\+?91[\s-]?)?(?:\d{10}|0\d{2,4}[\s-]?\d{6,8})\b/', $contact, $phone);
        // "name; designation; phone; e-mail"
        $person = preg_replace('/(?:e-?mail\s*:?\s*)?[^\s;,]+@[^\s;,]+|(?:phone|mobile|mob|tel)\.?\s*(?:no\.?)?\s*:?\s*(?=;|$)/i', '', $phone ? str_replace($phone[0], '', $contact) : $contact);
        $parts = array_values(array_filter(array_map(fn ($part) => trim($part, " \t,;:-"), explode(';', (string) $person)), fn ($part) => $part !== ''));
        $named = count($parts) > 1 || preg_match('/^(?:shri|smt|sh|mr|mrs|ms|dr|er)\b/i', $parts[0] ?? '');

        $fields = [
            'tenderId' => $text('tender_id'), 'title' => $text('title'), 'department' => $text('department'),
            'portal' => $text('portal'), 'location' => $text('location'),
            'value' => $text('tender_value'), 'emd' => $text('emd'), 'fee' => $text('tender_fee'),
            'contactName' => $named ? (string) array_shift($parts) : '',
            'contactDesignation' => implode(', ', $parts),
            'contactPhone' => $phone[0] ?? '',
            'requirements' => '',
        ];
        foreach (self::LIMITS as $key => $limit) {
            $fields[$key] = mb_substr($fields[$key], 0, $limit);
        }

        $entries = $this->dates($summary);
        foreach (self::DATES as $key) {
            $fields[$key] = collect($entries)->first(fn ($e) => $this->kind($e['label']) === $key)['date'] ?? '';
        }
        $fields['closingTime'] = $this->closingTime($entries, $fields['closingDate'], '');

        return $fields;
    }

    public function merge(array $fields, array $answer, array $summary): array
    {
        foreach (self::LIMITS as $key => $limit) {
            $value = is_scalar($answer[$key] ?? null) ? mb_substr($this->clean((string) $answer[$key]), 0, $limit) : '';
            $source = self::SOURCES[$key] ?? null;
            if ($value !== '' && ($source === null || $this->numbersFrom($value, (string) ($summary[$source] ?? '')))) {
                $fields[$key] = $value;
            }
        }
        // Divided into name and designation by the AI: do not keep the undivided text as the designation
        $given = fn (string $key) => is_scalar($answer[$key] ?? null) && trim((string) $answer[$key]) !== '';
        if ($given('contactName') && ! $given('contactDesignation')) {
            $fields['contactDesignation'] = '';
        }

        $entries = $this->dates($summary);
        $known = array_column($entries, 'date');
        foreach (self::DATES as $key) {
            $value = is_string($answer[$key] ?? null) ? trim($answer[$key]) : '';
            if (in_array($value, $known, true)) {
                $fields[$key] = $value;
            }
        }
        $fields['closingTime'] = $this->closingTime($entries, $fields['closingDate'], is_string($answer['closingTime'] ?? null) ? $answer['closingTime'] : '');

        return $fields;
    }

    /** Every number in the value must be in the text it was taken from. */
    private function numbersFrom(string $value, string $source): bool
    {
        $join = fn (string $s) => (string) preg_replace('/(?<=\d)[,\s-]+(?=\d)/', '', $s);
        preg_match_all('/\d+(?:\.\d+)?/', $join($value), $m);
        $source = $join($source);

        return collect($m[0])->every(fn (string $n) => str_contains($source, $n));
    }

    /** @return array<int, array{label: string, date: string, time: string}> the complete dates of the summary */
    private function dates(array $summary): array
    {
        $entries = [];
        foreach ($summary['dates'] ?? [] as $d) {
            $date = (string) ($d['date'] ?? '');
            if (preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $date, $m) && checkdate((int) $m[2], (int) $m[3], (int) $m[1])) {
                $entries[] = ['label' => (string) ($d['label'] ?? ''), 'date' => $date, 'time' => $this->time((string) ($d['time'] ?? ''))];
            }
        }

        return $entries;
    }

    /** Which column a date of the summary belongs to */
    private function kind(string $label): ?string
    {
        $l = strtolower($label);
        $is = fn (string $pattern) => preg_match($pattern, $l) === 1;

        return match (true) {
            $is('/quer|clarif/') => 'queryDate',
            $is('/pre[\s-]?bid/') => 'preBidDate',
            $is('/physical|hard cop|offline|original|financial|price|validity|site visit|(sale|download).{0,12}end|end.{0,12}(sale|download)/') => null,
            $is('/publish|publication|issue|(submission|sale|download).{0,12}start|start.{0,20}(submission|sale|download)|available from/') => 'openDate',
            $is('/(technical|bid|tender).{0,20}opening|opening.{0,20}(technical|bid|tender)/') => 'openingDate',
            $is('/clos|submission|last date|due date|upload|bid end/') => 'closingDate',
            default => null,
        };
    }

    /** A time that the summary gives for the closing date */
    private function closingTime(array $entries, string $date, string $wanted): string
    {
        $same = collect($entries)->filter(fn ($e) => $date !== '' && $e['date'] === $date && $e['time'] !== '');
        $wanted = $this->time($wanted);
        if ($wanted !== '' && $same->contains(fn ($e) => $e['time'] === $wanted)) {
            return $wanted;
        }

        return (string) ($same->first(fn ($e) => $this->kind($e['label']) === 'closingDate')['time'] ?? '');
    }

    /** "18:00", "6.00 PM", "1800 hrs" → "18:00" */
    public function time(string $text): string
    {
        $found = preg_match('/\b(\d{1,2})[:.](\d{2})(?::\d{2})?\s*([ap])?/i', $text, $m)
            || preg_match('/\b(\d{2})(\d{2})\b/', $text, $m)
            || preg_match('/\b(\d{1,2})()\s*([ap])\.?m/i', $text, $m);
        if (! $found) {
            return '';
        }
        $hour = (int) $m[1];
        $half = strtolower($m[3] ?? '');
        if ($half === 'p' && $hour < 12) {
            $hour += 12;
        } elseif ($half === 'a' && $hour === 12) {
            $hour = 0;
        }

        return $hour < 24 && (int) $m[2] < 60 ? sprintf('%02d:%02d', $hour, (int) $m[2]) : '';
    }

    /** Without the page references of the summary */
    private function clean(string $text): string
    {
        $text = preg_replace('/\s*\((?:pp?\.|pages?)\s*[^)]*\)/i', '', $text);

        return trim((string) preg_replace('/\s+/u', ' ', (string) $text));
    }
}
