<?php

namespace App\Services;

use App\Models\MailAccount;
use Symfony\Component\Mime\Address;
use Symfony\Component\Mime\Email;

/** Builds an outgoing mail (or a draft) from what was written in the compose window. */
class MailComposer
{
    /** Pictures inside the text (signature logo, pasted or quoted pictures) that are put into the mail itself */
    private const IMAGE_TYPES = ['png' => 'png', 'jpeg' => 'jpg', 'jpg' => 'jpg', 'gif' => 'gif', 'webp' => 'webp'];

    public static function build(MailAccount $account, string $subject, string $html): Email
    {
        $domain = self::domain($account);
        $email = (new Email())
            ->from(new Address($account->email, $account->from_name ?: ''))
            ->subject($subject)
            ->date(new \DateTimeImmutable());

        // Give the mail the same identity Thunderbird does: a Date, a Message-ID on our own domain
        // and (when sending) an EHLO name that is our domain instead of "[127.0.0.1]", which Gmail scores badly.
        $email->getHeaders()->addIdHeader('Message-ID', bin2hex(random_bytes(16)).'@'.$domain);

        $email->text(self::toText($html));
        $html = self::embedImages($email, $html);
        // One style for the whole mail. No white-space:pre-wrap: with it every line break shows twice.
        $email->html('<!DOCTYPE html><html><head><meta charset="utf-8"></head>'
            .'<body style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#1a1a1a">'.$html.'</body></html>');

        return $email;
    }

    public static function domain(MailAccount $account): string
    {
        return substr(strrchr($account->email, '@') ?: '@localhost', 1);
    }

    /** Plain text typed in an older open tab of the app */
    public static function fromPlainText(string $text): string
    {
        return '<div>'.str_replace("\n", '<br>', e(str_replace(["\r\n", "\r"], "\n", $text))).'</div>';
    }

    /** src="data:image/…" becomes a picture carried by the mail (Gmail and Outlook drop data: pictures) */
    private static function embedImages(Email $email, string $html): string
    {
        $out = '';
        $from = 0;
        $done = [];
        while (($at = stripos($html, 'src="data:image/', $from)) !== false) {
            $start = $at + 5;
            $end = strpos($html, '"', $start);
            if ($end === false) {
                break;
            }
            $out .= substr($html, $from, $start - $from);
            $uri = substr($html, $start, $end - $start);
            $comma = strpos($uri, ',');
            $type = strtolower(substr($uri, 11, max(0, strcspn($uri, ';,') - 11)));
            $data = $comma !== false && stripos(substr($uri, 0, $comma), ';base64') !== false && isset(self::IMAGE_TYPES[$type])
                ? base64_decode(substr($uri, $comma + 1), true) : false;
            if ($data !== false && $data !== '') {
                $name = 'image-'.substr(md5($data), 0, 12).'.'.self::IMAGE_TYPES[$type];
                if (! isset($done[$name])) {
                    $email->embed($data, $name, 'image/'.($type === 'jpg' ? 'jpeg' : $type));
                    $done[$name] = true;
                }
                $out .= 'cid:'.$name;
            } else {
                $out .= $uri;
            }
            $from = $end;
        }

        return $out.substr($html, $from);
    }

    /** Plain-text version for readers that do not show formatting */
    public static function toText(string $html): string
    {
        $html = (string) preg_replace('/src="data:[^"]*+"/i', '', $html);
        $dom = new \DOMDocument();
        $previous = libxml_use_internal_errors(true);
        $dom->loadHTML('<?xml encoding="utf-8"?><body>'.$html.'</body>', LIBXML_NONET);
        libxml_clear_errors();
        libxml_use_internal_errors($previous);

        $text = $dom->documentElement ? self::nodeText($dom->documentElement) : strip_tags($html);
        $text = str_replace("\u{a0}", ' ', $text);
        $text = (string) preg_replace('/[ \t]+\n/', "\n", $text);

        return trim((string) preg_replace('/\n{3,}/', "\n\n", $text))."\n";
    }

    private static function nodeText(\DOMNode $node): string
    {
        if ($node instanceof \DOMText) {
            return (string) preg_replace('/[ \t\r\n]+/', ' ', $node->nodeValue ?? '');
        }
        $name = strtolower($node->nodeName);
        if (in_array($name, ['script', 'style', 'head', 'title', '#comment'], true)) {
            return '';
        }
        if ($name === 'br') {
            return "\n";
        }
        $text = '';
        $number = 0;
        foreach ($node->childNodes as $child) {
            $part = self::nodeText($child);
            if (strtolower($child->nodeName) === 'li') {
                $number++;
                $part = ($name === 'ol' ? "{$number}. " : '- ').trim($part)."\n";
            }
            if ($text === '' || str_ends_with($text, "\n")) {
                $part = ltrim($part, ' ');
            }
            // A block always starts on its own line
            if ($text !== '' && ! str_ends_with($text, "\n") && self::isBlock($child)) {
                $text .= "\n";
            }
            $text .= $part;
        }

        return match (true) {
            $name === 'a' && $node instanceof \DOMElement => self::linkText($node, $text),
            $name === 'blockquote' => "\n".preg_replace('/^/m', '> ', trim($text))."\n",
            $name === 'p' => "\n".trim($text)."\n\n",
            in_array($name, ['td', 'th'], true) => trim($text) === '' ? '' : trim($text).' ',
            $name === 'hr' => "\n----------\n",
            self::isBlock($node) => trim($text) === '' && ! str_contains($text, "\n") ? '' : rtrim($text, ' ').(str_ends_with($text, "\n") ? '' : "\n"),
            default => $text,
        };
    }

    private static function linkText(\DOMElement $link, string $text): string
    {
        $href = $link->getAttribute('href');
        $plain = trim($text);
        // Web links keep their address; mail and phone links already show it
        if (! preg_match('#^https?://#i', $href) || $plain === '' || str_contains($href, $plain) || str_contains($plain, $href)) {
            return $text;
        }

        return $plain." <{$href}>";
    }

    private static function isBlock(\DOMNode $node): bool
    {
        return in_array(strtolower($node->nodeName), ['div', 'p', 'table', 'tr', 'ul', 'ol', 'li', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'pre', 'section'], true);
    }
}
