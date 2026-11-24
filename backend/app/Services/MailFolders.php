<?php

namespace App\Services;

use RuntimeException;
use Webklex\PHPIMAP\Client;
use Webklex\PHPIMAP\Folder;

/** Folder helpers: which folder is Sent, Drafts, Trash … on any mail server. */
class MailFolders
{
    public static function open(Client $client, string $path): Folder
    {
        return $client->getFolderByPath($path, false, true) ?? throw new RuntimeException('Folder not found');
    }

    /** First folder whose name looks like the given role (sent / trash / ...). */
    public static function find(Client $client, string $role): ?string
    {
        foreach ($client->getFolders(false) as $folder) {
            if (self::role($folder->path) === $role) {
                return $folder->path;
            }
        }

        return null;
    }

    public static function create(Client $client, string $name): string
    {
        // cPanel/Dovecot keeps folders under "INBOX." — follow whatever the server already uses.
        /** @var Folder|null $sample */
        $sample = collect($client->getFolders(false))->first(fn (Folder $f) => $f->path !== 'INBOX');
        $path = $sample && str_starts_with($sample->path, 'INBOX'.$sample->delimiter)
            ? 'INBOX'.$sample->delimiter.$name
            : $name;
        $client->createFolder($path, false);

        return $path;
    }

    public static function role(string $path): string
    {
        $name = strtolower($path);

        return match (true) {
            $name === 'inbox' => 'inbox',
            (bool) preg_match('/\bsent\b|sent items|sent mail/', $name) => 'sent',
            (bool) preg_match('/draft/', $name) => 'drafts',
            (bool) preg_match('/junk|spam/', $name) => 'junk',
            (bool) preg_match('/trash|deleted|bin\b/', $name) => 'trash',
            (bool) preg_match('/archive/', $name) => 'archive',
            default => 'other',
        };
    }

    public static function order(string $role): int
    {
        return ['inbox' => 0, 'sent' => 1, 'drafts' => 2, 'archive' => 3, 'junk' => 4, 'trash' => 5][$role] ?? 6;
    }
}
