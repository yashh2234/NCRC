<?php

namespace App\Services;

use Symfony\Component\Mime\Address;

/** "a@x.com, Name <b@y.com>; c@z.com" ↔ addresses */
class MailAddresses
{
    /** @return list<Address> the valid addresses, each once */
    public static function parse(?string $input): array
    {
        $out = [];
        foreach (self::split($input) as $part) {
            $part = trim($part);
            if ($part === '') {
                continue;
            }
            if (preg_match('/^(.*)<([^>]+)>$/', $part, $m)) {
                $name = trim($m[1], " \"'");
                $mail = trim($m[2]);
            } else {
                $name = '';
                $mail = $part;
            }
            if (filter_var($mail, FILTER_VALIDATE_EMAIL)) {
                $out[strtolower($mail)] ??= new Address($mail, $name);
            }
        }

        return array_values($out);
    }

    /** Parts of an address list that are not valid addresses, so nobody is silently left out. */
    public static function invalid(?string $input): array
    {
        $parts = array_filter(array_map('trim', self::split($input)), fn ($p) => $p !== '');

        return array_values(array_filter($parts, fn ($p) => ! self::parse($p)));
    }

    /** The addresses of $list that are in none of the others @param list<Address> $list @return list<Address> */
    public static function without(array $list, array ...$others): array
    {
        $taken = array_map(fn (Address $a) => strtolower($a->getAddress()), array_merge(...$others));

        return array_values(array_filter($list, fn (Address $a) => ! in_array(strtolower($a->getAddress()), $taken, true)));
    }

    /** @param list<Address> $list */
    public static function header(array $list): string
    {
        return implode(', ', array_map(fn (Address $a) => $a->getName() === '' ? $a->getAddress() : $a->toString(), $list));
    }

    /** Splits at , and ; but not inside "quoted, names". */
    private static function split(?string $input): array
    {
        return preg_split('/[,;]+(?=(?:[^"]*"[^"]*")*[^"]*$)/', (string) $input) ?: [];
    }
}
