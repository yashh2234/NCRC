<?php

namespace App\Services;

use RuntimeException;
use Throwable;
use Webklex\PHPIMAP\Client;

/**
 * Reads one mail piece by piece: its structure, the text and the small inline pictures. Attachments are
 * only listed, and read in small chunks when asked for, so a 48 MB mail opens without loading 48 MB.
 * (The IMAP library always downloads the whole mail into memory, several times over.)
 */
class MailReader
{
    private const CHUNK = 524288;

    private const MAX_TEXT = 5 * 1024 * 1024;

    private const MAX_INLINE_IMAGE = 5 * 1024 * 1024;

    private const MAX_INLINE_TOTAL = 10 * 1024 * 1024;

    /** @var resource */
    private $stream;

    private int $tag = 0;

    /** The client is kept: it closes the connection as soon as nothing refers to it any more */
    public function __construct(private Client $client, string $folder)
    {
        $client->openFolder($folder, true);
        // Same connection as the library, which has no way to ask for a single part of a mail
        $this->stream = (fn () => $this->stream)->call($client->getConnection());
    }

    // ---------------------------------------------------------------- actions

    /** @param string $flag without the backslash: Seen, Flagged, Answered, Deleted */
    public function flag(int $uid, string $flag, bool $on): void
    {
        $this->command("UID STORE {$uid} ".($on ? '+' : '-')."FLAGS.SILENT (\\{$flag})");
    }

    public function move(int $uid, string $folder): void
    {
        $to = '"'.addcslashes($folder, '"\\').'"';
        try {
            $this->command("UID MOVE {$uid} {$to}");
        } catch (RuntimeException) {
            $this->command("UID COPY {$uid} {$to}");
            $this->delete($uid);
        }
    }

    public function delete(int $uid): void
    {
        $this->flag($uid, 'Deleted', true);
        try {
            $this->command("UID EXPUNGE {$uid}");
        } catch (RuntimeException) {
            $this->command('EXPUNGE');
        }
    }

    // ---------------------------------------------------------------- reading

    /**
     * @return array{html: ?string, text: string, attachments: list<array{part: string, name: string, size: int, type: string}>}
     */
    public function content(int $uid): array
    {
        $parts = [];
        $tree = $this->node($this->structure($uid), '', $parts);
        [$html, $text] = $this->render($uid, $tree);

        $used = [];
        if ($html !== null) {
            $total = 0;
            foreach ($parts as $p) {
                if ($p['cid'] === '' || ! str_starts_with($p['type'], 'image/')) {
                    continue;
                }
                // The address in src can be written as is or percent-encoded
                $refs = array_filter(array_unique(['cid:'.$p['cid'], 'cid:'.rawurlencode($p['cid']), 'cid:'.str_replace('%40', '@', rawurlencode($p['cid']))]),
                    fn ($ref) => str_contains($html, $ref));
                if (! $refs) {
                    continue;
                }
                $total += $p['size'];
                if ($p['size'] > self::MAX_INLINE_IMAGE || $total > self::MAX_INLINE_TOTAL) {
                    continue;
                }
                $data = '';
                $this->stream($uid, $p['part'], function (string $bytes) use (&$data): void {
                    $data .= $bytes;
                }, $p['encoding']);
                $html = str_replace($refs, 'data:'.$p['type'].';base64,'.base64_encode($data), $html);
                $used[$p['part']] = true;
            }
        }

        $attachments = [];
        foreach ($parts as $p) {
            if ($p['attachment'] && ! isset($used[$p['part']])) {
                $attachments[] = ['part' => $p['part'], 'name' => $p['name'], 'size' => $p['bytes'], 'type' => $p['type']];
            }
        }

        return ['html' => $html, 'text' => $text, 'attachments' => $attachments];
    }

    /** @return array{part: string, name: string, size: int, type: string, encoding: string}|null */
    public function attachment(int $uid, string $part): ?array
    {
        $parts = [];
        $this->node($this->structure($uid), '', $parts);
        foreach ($parts as $p) {
            if ($p['part'] === $part) {
                return $p;
            }
        }

        return null;
    }

    /** Hands the decoded part over in chunks. */
    public function stream(int $uid, string $part, callable $write, string $encoding): void
    {
        $base64 = $encoding === 'base64';
        $quoted = $encoding === 'quoted-printable';
        $rest = '';
        for ($offset = 0; ; $offset += self::CHUNK) {
            $raw = $this->fetchBytes($uid, $part, $offset, self::CHUNK);
            $length = strlen($raw);
            if ($base64) {
                $rest .= preg_replace('/[^A-Za-z0-9+\/]/', '', $raw);
                $usable = strlen($rest) - strlen($rest) % 4;
                if ($usable) {
                    $write((string) base64_decode(substr($rest, 0, $usable)));
                    $rest = substr($rest, $usable);
                }
            } elseif ($quoted) {
                // Decode whole lines only, a soft line break can fall on the chunk border
                $rest .= $raw;
                $end = strrpos($rest, "\n");
                if ($end !== false) {
                    $write(quoted_printable_decode(substr($rest, 0, $end + 1)));
                    $rest = substr($rest, $end + 1);
                }
            } elseif ($length) {
                $write($raw);
            }
            if ($length < self::CHUNK) {
                break;
            }
        }
        if ($rest !== '') {
            $write($base64 ? (string) base64_decode($rest) : quoted_printable_decode($rest));
        }
    }

    /** Header lines of one mail, unfolded; [] when it has none of them. @return array<string, string> */
    public function headers(int $uid, array $names): array
    {
        $raw = $this->fetchBytes($uid, 'HEADER.FIELDS ('.implode(' ', $names).')');
        $out = [];
        foreach (explode("\n", (string) preg_replace('/\r?\n[ \t]+/', ' ', $raw)) as $line) {
            if (preg_match('/^([\w-]+):\s*(.*?)\s*$/', $line, $m)) {
                $out[strtolower($m[1])] = $m[2];
            }
        }

        return $out;
    }

    /** UID of the mail with this Message-ID in the open folder */
    public function findByMessageId(string $messageId): ?int
    {
        $answer = $this->command('UID SEARCH HEADER Message-ID "'.addcslashes($messageId, '"\\').'"');

        return preg_match('/^\* SEARCH((?: \d+)+)/mi', $answer, $m) ? (int) max(array_map('intval', explode(' ', trim($m[1])))) : null;
    }

    /** Puts a mail file into a folder piece by piece. @return ?int its UID, when the server tells it */
    public function append(string $folder, string $file, string $flags): ?int
    {
        $tag = 'NCRC'.(++$this->tag);
        $this->write("{$tag} APPEND \"".addcslashes($folder, '"\\')."\" ({$flags}) {".filesize($file)."}\r\n");
        $line = fgets($this->stream);
        if ($line === false || ! str_starts_with($line, '+')) {
            throw new RuntimeException('Mail server: '.trim((string) $line));
        }
        $handle = fopen($file, 'rb');
        try {
            while (! feof($handle) && ($bytes = fread($handle, 65536)) !== false) {
                $this->write($bytes);
            }
        } finally {
            fclose($handle);
        }
        $this->write("\r\n");
        while (($line = fgets($this->stream)) !== false) {
            if (str_starts_with($line, $tag.' ')) {
                if (! str_starts_with(substr($line, strlen($tag) + 1), 'OK')) {
                    throw new RuntimeException('Mail server: '.trim(substr($line, strlen($tag) + 1)));
                }

                return preg_match('/\[APPENDUID \d+ (\d+)\]/i', $line, $m) ? (int) $m[1] : null;
            }
        }

        throw new RuntimeException('The mail server did not answer in time.');
    }

    private function write(string $bytes): void
    {
        while ($bytes !== '') {
            $written = fwrite($this->stream, $bytes);
            if ($written === false || $written === 0) {
                throw new RuntimeException('The connection to the mail server was lost.');
            }
            $bytes = substr($bytes, $written);
        }
    }

    // ---------------------------------------------------------------- mail structure

    private function structure(int $uid): array
    {
        $answer = $this->command("UID FETCH {$uid} (UID BODYSTRUCTURE)");
        $at = stripos($answer, 'BODYSTRUCTURE ');
        if ($at === false) {
            throw new RuntimeException('The mail was not found. It may have been moved or deleted.');
        }
        $pos = $at + strlen('BODYSTRUCTURE ');

        return (array) self::parseList($answer, $pos);
    }

    /** One IMAP value: a (list), "string", {n} literal, or atom; NIL = null */
    public static function parseList(string $s, int &$pos): array|string|null
    {
        while (isset($s[$pos]) && ctype_space($s[$pos])) {
            $pos++;
        }
        $ch = $s[$pos] ?? '';
        if ($ch === '(') {
            $pos++;
            $list = [];
            while (isset($s[$pos])) {
                while (isset($s[$pos]) && ctype_space($s[$pos])) {
                    $pos++;
                }
                if (($s[$pos] ?? ')') === ')') {
                    $pos++;
                    break;
                }
                $list[] = self::parseList($s, $pos);
            }

            return $list;
        }
        if ($ch === '"') {
            $out = '';
            for ($pos++; isset($s[$pos]) && $s[$pos] !== '"'; $pos++) {
                if ($s[$pos] === '\\') {
                    $pos++;
                }
                $out .= $s[$pos] ?? '';
            }
            $pos++;

            return $out;
        }
        if ($ch === '{' && preg_match('/\G\{(\d+)\+?\}\r?\n/', $s, $m, 0, $pos)) {
            $out = substr($s, $pos + strlen($m[0]), (int) $m[1]);
            $pos += strlen($m[0]) + (int) $m[1];

            return $out;
        }
        $length = max(1, strcspn($s, " ()\r\n", $pos));
        $atom = substr($s, $pos, $length);
        $pos += $length;

        return strtoupper($atom) === 'NIL' ? null : $atom;
    }

    /** Turns the raw structure into a tree; every single part is also collected in $parts. */
    private function node(array $raw, string $number, array &$parts): array
    {
        if (is_array($raw[0] ?? null)) {
            $children = [];
            $i = 0;
            while (is_array($raw[$i] ?? null)) {
                $children[] = $this->node($raw[$i], ($number === '' ? '' : $number.'.').($i + 1), $parts);
                $i++;
            }

            return ['multipart' => strtolower((string) ($raw[$i] ?? 'mixed')), 'children' => $children];
        }

        $type = strtolower((string) ($raw[0] ?? 'text'));
        $subtype = strtolower((string) ($raw[1] ?? 'plain'));
        $isMail = $type === 'message' && $subtype === 'rfc822';
        $params = $this->params($raw[2] ?? null);
        $dispositionAt = $type === 'text' ? 9 : ($isMail ? 11 : 8);
        $disposition = is_array($raw[$dispositionAt] ?? null) ? $raw[$dispositionAt] : [];
        $isAttachment = strtolower((string) ($disposition[0] ?? '')) === 'attachment';
        $name = $this->params($disposition[1] ?? null)['filename'] ?? $params['name'] ?? '';
        if ($name === '' && $isMail) {
            $subject = MailInboxWatcher::decodeHeader((string) ($raw[7][1] ?? ''));
            $name = ($subject ?: 'message').'.eml';
        }
        $encoding = strtolower((string) ($raw[5] ?? '7bit'));
        $size = (int) ($raw[6] ?? 0);
        $isBody = $type === 'text' && in_array($subtype, ['plain', 'html'], true) && ! $isAttachment && ($name === '' || $subtype === 'html');

        $part = [
            'part' => $number === '' ? '1' : $number,
            'type' => "{$type}/{$subtype}",
            'charset' => $params['charset'] ?? '',
            'encoding' => $encoding,
            'size' => $size,
            // Size as the reader saves it: base64 carries 57 bytes in a 78 character line
            'bytes' => $encoding === 'base64' ? (int) round($size * 57 / 78) : $size,
            'cid' => trim((string) ($raw[3] ?? ''), '<> '),
            'attachment' => ! $isBody,
            'name' => $name !== '' ? $name : 'attachment-'.(count($parts) + 1).self::extension("{$type}/{$subtype}"),
        ];
        $parts[] = $part;

        return $part;
    }

    private static function extension(string $type): string
    {
        return ['image/jpeg' => '.jpg', 'image/png' => '.png', 'image/gif' => '.gif', 'application/pdf' => '.pdf',
            'text/plain' => '.txt', 'text/calendar' => '.ics', 'message/delivery-status' => '.txt', 'text/rfc822-headers' => '.txt'][$type] ?? '';
    }

    /** Name/value list, with names split or encoded the RFC 2231 way (filename*0*=…) put together. */
    private function params(mixed $list): array
    {
        $plain = [];
        $split = [];
        $list = is_array($list) ? $list : [];
        for ($i = 0; $i + 1 < count($list); $i += 2) {
            $key = strtolower((string) $list[$i]);
            $value = (string) $list[$i + 1];
            if (preg_match('/^([^*]+)\*(?:(\d+)(\*?))?$/', $key, $m)) {
                $split[$m[1]][(int) ($m[2] ?? 0)] = [$value, ! isset($m[2]) || $m[2] === '' || ($m[3] ?? '') === '*'];
            } else {
                $plain[$key] = MailInboxWatcher::decodeHeader($value);
            }
        }
        foreach ($split as $key => $pieces) {
            ksort($pieces);
            $charset = 'UTF-8';
            $out = '';
            foreach ($pieces as $n => [$value, $encoded]) {
                if ($encoded && $n === array_key_first($pieces) && preg_match("/^([^']*)'[^']*'(.*)$/s", $value, $m)) {
                    $charset = $m[1] ?: 'UTF-8';
                    $value = $m[2];
                }
                $out .= $encoded ? rawurldecode($value) : $value;
            }
            $plain[$key] = self::toUtf8($out, $charset);
        }

        return $plain;
    }

    /** @return array{0: ?string, 1: string} html (null when the mail has none) and plain text */
    private function render(int $uid, array $node): array
    {
        if (! isset($node['multipart'])) {
            if ($node['attachment']) {
                return [null, ''];
            }
            $body = $this->text($uid, $node);

            return $node['type'] === 'text/html' ? [$body, ''] : [null, $body];
        }

        $results = array_map(fn ($child) => $this->render($uid, $child), $node['children']);
        if ($node['multipart'] === 'alternative') {
            // The last version is the richest one
            $html = null;
            $text = '';
            foreach ($results as [$h, $t]) {
                $html = $h ?? $html;
                $text = $t !== '' ? $t : $text;
            }

            return [$html, $text];
        }

        $texts = array_filter(array_column($results, 1), fn ($t) => $t !== '');
        if (! array_filter(array_column($results, 0), fn ($h) => $h !== null)) {
            return [null, implode("\n\n", $texts)];
        }
        $html = '';
        foreach ($results as [$h, $t]) {
            $html .= $h ?? ($t !== '' ? '<div>'.nl2br(e($t), false).'</div>' : '');
        }

        return [$html, implode("\n\n", $texts)];
    }

    private function text(int $uid, array $part): string
    {
        $raw = $this->fetchBytes($uid, $part['part'], 0, self::MAX_TEXT);
        $raw = match ($part['encoding']) {
            'base64' => (string) base64_decode((string) preg_replace('/[^A-Za-z0-9+\/=]/', '', $raw)),
            'quoted-printable' => quoted_printable_decode($raw),
            default => $raw,
        };

        return self::toUtf8($raw, $part['charset']);
    }

    public static function toUtf8(string $value, string $charset): string
    {
        $charset = strtoupper(trim($charset)) ?: 'UTF-8';
        if (in_array($charset, ['UTF-8', 'UTF8', 'US-ASCII', 'ASCII'], true)) {
            if (mb_check_encoding($value, 'UTF-8')) {
                return $value;
            }
            $charset = 'WINDOWS-1252';
        }
        try {
            $out = mb_convert_encoding($value, 'UTF-8', $charset);
        } catch (Throwable) {
            $out = @iconv($charset, 'UTF-8//IGNORE', $value);
        }

        return is_string($out) && $out !== '' ? $out : mb_scrub($value, 'UTF-8');
    }

    // ---------------------------------------------------------------- IMAP

    /** Raw bytes of a part, read without marking the mail as read. */
    private function fetchBytes(int $uid, string $section, ?int $offset = null, int $length = 0): string
    {
        $answer = $this->command("UID FETCH {$uid} (BODY.PEEK[{$section}]".($offset === null ? '' : "<{$offset}.{$length}>").')');
        if (! preg_match('/BODY\[[^\]]*\](?:<\d+>)? /i', $answer, $m, PREG_OFFSET_CAPTURE)) {
            throw new RuntimeException('The mail was not found. It may have been moved or deleted.');
        }
        $pos = $m[0][1] + strlen($m[0][0]);
        $value = self::parseList($answer, $pos);

        return is_string($value) ? $value : '';
    }

    /** Sends one command and returns everything the server answered. */
    private function command(string $command): string
    {
        $tag = 'NCRC'.(++$this->tag);
        $this->write("{$tag} {$command}\r\n");
        $answer = '';
        while (($line = fgets($this->stream)) !== false) {
            if (str_starts_with($line, $tag.' ')) {
                if (! str_starts_with(substr($line, strlen($tag) + 1), 'OK')) {
                    throw new RuntimeException('Mail server: '.trim(substr($line, strlen($tag) + 1)));
                }

                return $answer;
            }
            $answer .= $line;
            if (preg_match('/\{(\d+)\}\r?\n$/', $line, $m)) {
                $left = (int) $m[1];
                while ($left > 0) {
                    $bytes = fread($this->stream, min($left, 65536));
                    if ($bytes === false || ($bytes === '' && (feof($this->stream) || stream_get_meta_data($this->stream)['timed_out']))) {
                        throw new RuntimeException('The connection to the mail server was lost.');
                    }
                    $answer .= $bytes;
                    $left -= strlen($bytes);
                }
            }
        }

        throw new RuntimeException('The mail server did not answer in time.');
    }
}
