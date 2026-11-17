<?php

namespace App\Services;

use App\Models\Document;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * Registration attachments live in two places: the scan_copy* / report_copy columns of
 * client_registration (shown in the registration's Files tab) and the documents table
 * (shown in the UID Document Repository). These helpers keep both in step.
 */
class RegistrationAttachments
{
    public const FIELDS = [
        'scan_copy', 'scan_copy_1', 'scan_copy_2', 'scan_copy_3', 'scan_copy_4',
        'scan_copy_5', 'scan_copy_6', 'scan_copy_7', 'scan_copy_8', 'scan_copy_9', 'report_copy',
    ];

    /** Blank out every registration column that points at this file. */
    public static function clearColumns(string $path): void
    {
        if ($path === '') {
            return;
        }
        foreach (self::FIELDS as $field) {
            DB::table('client_registration')->where($field, $path)->update([$field => '']);
        }
    }

    /** Remove a file everywhere: registration columns, document records, and the file on disk. */
    public static function removePath(string $path): void
    {
        if ($path === '') {
            return;
        }

        self::clearColumns($path);

        $paths = [$path];
        foreach (Document::with('versions')->where('file_path', $path)->get() as $document) {
            foreach ($document->versions as $version) {
                $paths[] = (string) $version->file_path;
            }
            $document->versions()->delete();
            $document->delete();
        }

        foreach (array_unique($paths) as $file) {
            self::deleteFile($file);
        }
    }

    /** Deletes a local file. Remote URLs (files still hosted on the old software) are left alone. */
    public static function deleteFile(string $path): void
    {
        if ($path === '' || preg_match('#^https?://#i', $path)) {
            return;
        }
        $relative = ltrim($path, '/');
        if (str_starts_with($relative, 'assets/')) {
            $full = public_path($relative);
            if (is_file($full)) {
                unlink($full);
            }
            return;
        }
        Storage::disk('public')->delete($relative);
    }
}
