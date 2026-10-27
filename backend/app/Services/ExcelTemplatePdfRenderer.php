<?php

namespace App\Services;

use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use RuntimeException;

class ExcelTemplatePdfRenderer
{
    private const TEMPLATES = [
        'cc_cube' => 'CC Cube.html',
        'cc_core' => 'CC Core.html',
        'cc_beam' => 'CC Cube.html',
        'bitumen_core' => 'DBM BC Bitumen Core Density Report.html',
        'bitumen_loose' => 'Bitumen Sample DBM  BC.html',
        'bricks' => 'Clay Bricks.html',
        'ferro_cover' => 'FCDC ferro cover.html',
        'interlocking' => 'Interlocking 60mm.html',
        'mainhole_cover' => 'Main Hole Cover HD 20.html',
        'mes' => 'ACC Block.html',
        'sand' => 'Sand.html',
        'water' => 'Water.html',
    ];

    public function render(Model $report, Collection $details, ?Model $company): string
    {
        $template = $this->resolveTemplate((string) $report->report_type, (string) $report->material_details, (string) (($report->lab_data ?? [])['_template'] ?? ''));
        $html = file_get_contents($template);
        if ($html === false) {
            throw new RuntimeException('Unable to read the Excel report template.');
        }

        $values = [
            'customer_details' => $report->customer_details,
            'agency_name' => $report->agency_name,
            'reference_no' => $report->reference_no,
            'material_details' => $report->material_details,
            'source_location' => $report->source_location,
            'work_order_no' => $report->work_order_no,
            'sample_date' => $report->sample_date,
            'sample_tested_date' => $report->sample_tested_date,
            'ulr_no' => $report->ulr_no,
            'create_date' => $report->create_date,
        ];

        foreach ($values as $key => $value) {
            $html = str_replace('[[' . $key . ']]', e($this->formatValue($value)), $html);
        }

        $companyName = $company?->getAttribute('name') ?: config('app.name');
        $detailRows = '';
        foreach ($details as $detail) {
            foreach ($detail->getAttributes() as $key => $value) {
                if ($key === 'iReportId' || $key === 'uid_no' || $value === null || $value === '') {
                    continue;
                }
                $detailRows .= '<tr><td>' . e($key) . '</td><td>' . e($this->formatValue($value)) . '</td></tr>';
            }
        }
        foreach ((array) $report->lab_data as $key => $value) {
            if ($key === '_template' || $value === null || $value === '') {
                continue;
            }
            $detailRows .= '<tr><td>' . e((string) $key) . '</td><td>' . e($this->formatValue($value)) . '</td></tr>';
        }

        $supplement = '<div class="recorded-results"><h3>Recorded test data</h3><table><thead><tr><th>Parameter</th><th>Value</th></tr></thead><tbody>'
            . ($detailRows ?: '<tr><td colspan="2">No test data recorded</td></tr>')
            . '</tbody></table><p>For ' . e($companyName) . '</p></div>';

        $styles = '<style>.recorded-results{margin-top:18px;font-family:Arial,sans-serif;font-size:10px}.recorded-results h3{margin:0 0 6px;font-size:12px}.recorded-results table{width:100%;border-collapse:collapse}.recorded-results th,.recorded-results td{border:1px solid #999;padding:4px;text-align:left}.recorded-results th{background:#eef3f2}.recorded-results p{margin-top:10px;font-weight:bold}</style>';

        return str_replace('</body>', $styles . $supplement . '</body>', $html);
    }

    private function resolveTemplate(string $type, string $material, string $selectedKey = ''): string
    {
        $selectedTemplates = [
            'acc_block' => 'ACC Block.html',
            'bitumen_sample_dbm_bc' => 'Bitumen Sample DBM  BC.html',
            'bm_ii_mix' => 'BM-II Mix.html',
            'cc_core' => 'CC Core.html',
            'cc_cube' => 'CC Cube.html',
            'cement_opc_43' => 'Cement OPC-43.html',
            'chequered_tile_22mm' => 'Chequired tile 22 mm.html',
            'clay_bricks' => 'Clay Bricks.html',
            'dbm_bc_density' => 'DBM BC Bitumen Core Density Report.html',
            'fcdc_ferro_cover' => 'FCDC ferro cover.html',
            'grit_10mm' => 'Grit (10mm).html',
            'grit_20mm' => 'Grit (20mm).html',
            'gsb_iii_mix' => 'GSB-III Mix MDD OMC.html',
            'interlocking_60mm' => 'Interlocking 60mm.html',
            'kerb_stone' => 'Kerb Stone.html',
            'm30_mix' => 'M-30 Mix.html',
            'main_hole_cover_hd20' => 'Main Hole Cover HD 20.html',
            'sand' => 'Sand.html',
            'soil_omc_mdd_cbr' => 'Soil OMC MDD & CBR.html',
            'verified_floor_tile' => 'Vertified Floor Tile.html',
            'water' => 'Water.html',
            'wmm_mix' => 'WMM Mix OMC MDD.html',
        ];
        $file = $selectedTemplates[$selectedKey] ?? self::TEMPLATES[$type] ?? null;
        $material = strtolower($material);
        if (str_contains($material, 'cement')) {
            $file = 'Cement OPC-43.html';
        } elseif (str_contains($material, 'soil')) {
            $file = 'Soil OMC MDD & CBR.html';
        } elseif (str_contains($material, 'wmm')) {
            $file = 'WMM Mix OMC MDD.html';
        } elseif (str_contains($material, 'gsb')) {
            $file = 'GSB-III Mix MDD OMC.html';
        } elseif (str_contains($material, 'bm-ii') || str_contains($material, 'bituminous macadam')) {
            $file = 'BM-II Mix.html';
        } elseif (str_contains($material, 'grit') || str_contains($material, '10mm') || str_contains($material, '20mm')) {
            $file = str_contains($material, '20mm') ? 'Grit (20mm).html' : 'Grit (10mm).html';
        } elseif (str_contains($material, 'kerb')) {
            $file = 'Kerb Stone.html';
        } elseif (str_contains($material, 'tile')) {
            $file = str_contains($material, '22') ? 'Chequired tile 22 mm.html' : 'Vertified Floor Tile.html';
        }

        $path = resource_path('views/pdf/templates/' . ($file ?: 'CC Cube.html'));
        if (! is_file($path)) {
            throw new RuntimeException('No Excel report template is configured for this report type.');
        }

        return $path;
    }

    private function formatValue(mixed $value): string
    {
        if ($value instanceof \DateTimeInterface) {
            return $value->format('d M Y');
        }

        if (is_array($value) || is_object($value)) {
            return json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '';
        }

        return trim((string) ($value ?? '')) ?: '--';
    }
}
