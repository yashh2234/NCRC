<?php

namespace App\Services;

use RuntimeException;
use ZipArchive;

/**
 * Minimal .xlsx reader (no extra package): rows of the first worksheet as
 * [column letter => value]. Shared strings, inline strings and numbers; formulas give their cached value.
 */
class XlsxReader
{
    /** @return array<int, array<string, string>> keyed by Excel row number */
    public static function firstSheetRows(string $path): array
    {
        $zip = new ZipArchive();
        if ($zip->open($path) !== true) {
            throw new RuntimeException('This is not an .xlsx Excel file.');
        }
        try {
            $shared = [];
            $sst = $zip->getFromName('xl/sharedStrings.xml');
            if ($sst !== false) {
                $xml = simplexml_load_string($sst);
                foreach ($xml->si as $si) {
                    // Plain <t> or rich text runs <r><t>
                    $shared[] = isset($si->t) ? (string) $si->t : implode('', array_map('strval', $si->xpath('.//*[local-name()="t"]') ?: []));
                }
            }

            $sheet = $zip->getFromName(self::firstSheetPath($zip));
            if ($sheet === false) {
                throw new RuntimeException('The Excel file has no worksheet.');
            }
            $xml = simplexml_load_string($sheet);
            $rows = [];
            foreach ($xml->sheetData->row as $row) {
                $cells = [];
                foreach ($row->c as $c) {
                    $ref = (string) $c['r'];
                    $col = preg_replace('/\d+/', '', $ref);
                    $type = (string) $c['t'];
                    $value = match ($type) {
                        's' => $shared[(int) $c->v] ?? '',
                        'inlineStr' => (string) ($c->is->t ?? ''),
                        default => (string) ($c->v ?? ''),
                    };
                    if ($value !== '') {
                        $cells[$col] = $value;
                    }
                }
                if ($cells) {
                    $rows[(int) $row['r']] = $cells;
                }
            }

            return $rows;
        } finally {
            $zip->close();
        }
    }

    private static function firstSheetPath(ZipArchive $zip): string
    {
        $workbook = $zip->getFromName('xl/workbook.xml');
        $rels = $zip->getFromName('xl/_rels/workbook.xml.rels');
        if ($workbook !== false && $rels !== false) {
            $wb = simplexml_load_string($workbook);
            $wb->registerXPathNamespace('m', 'http://schemas.openxmlformats.org/spreadsheetml/2006/main');
            $first = $wb->xpath('//m:sheets/m:sheet')[0] ?? null;
            if ($first) {
                $rid = (string) $first->attributes('http://schemas.openxmlformats.org/officeDocument/2006/relationships')['id'];
                foreach (simplexml_load_string($rels)->Relationship as $rel) {
                    if ((string) $rel['Id'] === $rid) {
                        $target = ltrim((string) $rel['Target'], '/');
                        return str_starts_with($target, 'xl/') ? $target : 'xl/' . $target;
                    }
                }
            }
        }

        return 'xl/worksheets/sheet1.xml';
    }
}
