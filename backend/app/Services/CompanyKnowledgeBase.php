<?php

namespace App\Services;

use App\Models\CompanyKnowledge;
use App\Models\Proposal;
use Illuminate\Http\Client\Pool;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use RuntimeException;

/** What the proposal AI is told about the company: website pages, approved facts and earlier proposals that fit the brief. */
class CompanyKnowledgeBase
{
    private const SITE = 'https://namotech.in';

    /** Pages that say nothing about what the company does */
    private const SKIP = '#^/(blogs?|privacy|terms|thank|api)\b#';

    private const MAX_PAGES = 250;

    private const PAGE_CHARS = 9000;

    /** Always part of what the AI is told, with the most characters of each */
    private const CORE = ['/about' => 1800, '/services' => 1800, '/contact' => 500];

    private const STOP_WORDS = ['write', 'proposal', 'draft', 'details', 'using', 'reference', 'with', 'from', 'this', 'that', 'work', 'scope', 'total', 'required', 'requirement', 'namotech', 'services', 'service', 'project', 'projects', 'please', 'under', 'which', 'shall', 'will', 'have', 'their', 'your', 'client', 'per', 'and', 'the', 'for', 'all', 'are', 'not', 'any', 'our'];

    /** Reads the company website again. @return int pages saved */
    public function refresh(): int
    {
        $sitemap = Http::timeout(20)->get(self::SITE.'/sitemap.xml');
        if (! $sitemap->successful()) {
            throw new RuntimeException('The website could not be read ('.$sitemap->status().').');
        }
        preg_match_all('#<loc>\s*([^<\s]+)\s*</loc>#', $sitemap->body(), $found);
        $urls = collect($found[1])->map(fn (string $u) => rtrim(html_entity_decode($u), '/'))
            ->filter(fn (string $u) => $u === self::SITE || str_starts_with($u, self::SITE.'/'))
            ->reject(fn (string $u) => preg_match(self::SKIP, $this->path($u)) || strlen($u) > 190)
            ->unique()->take(self::MAX_PAGES)->values();

        $saved = [];
        foreach ($urls->chunk(6) as $chunk) {
            $responses = Http::pool(fn (Pool $pool) => $chunk->map(fn (string $u) => $pool->as($u)->timeout(20)->get($u))->all());
            foreach ($responses as $url => $response) {
                if (! $response instanceof Response || ! $response->successful()) {
                    continue;
                }
                [$title, $text] = $this->read($response->body());
                if (mb_strlen($text) < 200) {
                    continue;
                }
                $row = CompanyKnowledge::query()->firstOrNew(['url' => $url], ['kind' => 'website', 'status' => 'approved']);
                // A page the admin switched off stays off
                $row->fill(['title' => mb_substr($title ?: $this->path($url), 0, 200), 'content' => mb_substr($text, 0, self::PAGE_CHARS), 'updated_at' => now()])->save();
                $saved[] = $url;
            }
        }
        if ($saved === []) {
            throw new RuntimeException('No page of the website could be read. Please try again later.');
        }
        // Pages taken off the website; those that only failed to load now are kept
        CompanyKnowledge::query()->where('kind', 'website')->whereNotIn('url', $urls->all())->delete();

        return count($saved);
    }

    /** The text for the AI, at most about $chars long */
    public function context(string $brief, int $chars): string
    {
        $this->readWebsiteOnce();
        $words = $this->words($brief);
        $parts = [];
        $room = $chars;
        $add = function (string $text) use (&$parts, &$room): void {
            $text = trim($text);
            if ($text !== '' && mb_strlen($text) <= $room) {
                $parts[] = $text;
                $room -= mb_strlen($text);
            }
        };

        $facts = CompanyKnowledge::query()->where('kind', 'fact')->where('status', 'approved')->get();
        foreach ($this->ranked($facts, $words, fn (CompanyKnowledge $k) => [$k->title, $k->content]) as $fact) {
            $add('FACT – '.$fact->title.': '.$fact->content);
        }

        $pages = CompanyKnowledge::query()->where('kind', 'website')->where('status', 'approved')->get();
        foreach (self::CORE as $path => $limit) {
            $page = $pages->first(fn (CompanyKnowledge $k) => $this->path((string) $k->url) === $path);
            if ($page) {
                $add($this->pageText($page, (int) min($limit, $chars / 6)));
            }
        }
        $others = $pages->reject(fn (CompanyKnowledge $k) => isset(self::CORE[$this->path((string) $k->url)]));
        foreach ($this->ranked($others, $words, fn (CompanyKnowledge $k) => [$k->title, $k->content], true)->take(5) as $page) {
            $add($this->pageText($page, (int) ($chars / 9)));
        }

        $proposals = Proposal::query()->latest('id')->limit(200)->get();
        $similar = $this->ranked($proposals, $words, fn (Proposal $p) => [
            "{$p->title} {$p->project_name}", $p->brief.' '.collect($p->sections)->pluck('heading')->implode(' '),
        ], true)->take(2);
        foreach ($similar as $proposal) {
            $limit = (int) min($room, $chars / 4);
            if ($limit > 600) {
                $add($this->proposalText($proposal, $limit));
            }
        }

        return implode("\n\n", $parts);
    }

    /** Before the weekly refresh has run for the first time; a site that does not answer is asked again an hour later */
    private function readWebsiteOnce(): void
    {
        if (CompanyKnowledge::query()->where('kind', 'website')->exists() || ! Cache::add('company_knowledge_first_read', 1, now()->addHour())) {
            return;
        }
        try {
            $this->refresh();
        } catch (\Throwable $e) {
            report($e);
        }
    }

    private function pageText(CompanyKnowledge $page, int $limit): string
    {
        return 'WEBSITE – '.$page->title.': '.mb_strimwidth($page->content, 0, max(100, $limit), '…');
    }

    private function proposalText(Proposal $p, int $limit): string
    {
        $text = "EARLIER PROPOSAL – {$p->title} ({$p->project_name})";
        foreach (is_array($p->sections) ? $p->sections : [] as $s) {
            $text .= "\n# ".($s['heading'] ?? '')."\n".mb_strimwidth((string) ($s['body'] ?? ''), 0, 700, '…');
        }

        return mb_strimwidth($text.($p->fee_note ? "\nFee note: {$p->fee_note}" : ''), 0, $limit, '…');
    }

    /**
     * Best fitting first.
     *
     * @param  callable(mixed): array{0: string, 1: string}  $text  title and body of one item
     */
    private function ranked(Collection $items, array $words, callable $text, bool $onlyFitting = false): Collection
    {
        $texts = $items->map(fn ($item) => array_map(fn ($t) => ' '.mb_strtolower((string) $t).' ', $text($item)))->all();
        $count = max(1, count($texts));
        $weights = [];
        foreach ($words as $word) {
            $in = count(array_filter($texts, fn (array $t) => str_contains($t[0].$t[1], $word)));
            $weights[$word] = $in ? log(1 + $count / $in) : 0;
        }

        $scored = [];
        foreach ($items as $key => $item) {
            [$title, $body] = $texts[$key];
            $score = 0;
            foreach ($weights as $word => $weight) {
                $score += $weight * ((str_contains($title, (string) $word) ? 4 : 0) + min(3, substr_count($body, (string) $word)));
            }
            if (! $onlyFitting || $score > 0) {
                $scored[] = [$score, $item];
            }
        }

        return collect($scored)->sortByDesc(fn (array $r) => $r[0])->map(fn (array $r) => $r[1])->values();
    }

    /** @return string[] */
    private function words(string $text): array
    {
        preg_match_all('/[\p{L}\d-]{3,}/u', mb_strtolower($text), $m);

        return array_values(array_slice(array_diff(array_unique($m[0]), self::STOP_WORDS), 0, 80));
    }

    /** @return array{0: string, 1: string} title and text of an HTML page */
    private function read(string $html): array
    {
        $html = mb_scrub($html);
        $title = preg_match('#<title[^>]*>(.*?)</title>#is', $html, $m) ? Str::squish(html_entity_decode(strip_tags($m[1]), ENT_QUOTES | ENT_HTML5)) : '';
        $body = preg_replace('#<(script|style|svg|head|header|footer|nav|form|noscript|iframe)\b[^>]*>.*?</\1>#is', ' ', $html) ?? '';
        $text = Str::squish(html_entity_decode(preg_replace('/<[^>]+>/', ' ', $body) ?? '', ENT_QUOTES | ENT_HTML5));

        return [(string) preg_replace('/\s*[|–]\s*Namotech.*$/u', '', $title), $text];
    }

    private function path(string $url): string
    {
        return substr($url, strlen(self::SITE)) ?: '/';
    }
}
