import { useMemo } from 'react'

interface TemplateField {
  key: string
  label: string
  type?: 'date' | 'number' | 'text'
}

interface ExcelLabReportEditorProps {
  reportType: string
  material: string
  details: any[]
  labData: Record<string, string>
  updateDetail: (index: number, field: string, value: string) => void
  updateLabData: (field: string, value: string) => void
  templateKey?: string
}

export const EXCEL_TEMPLATE_OPTIONS = [
  ['acc_block', 'ACC Block'], ['bitumen_sample_dbm_bc', 'Bitumen Sample DBM / BC'], ['bm_ii_mix', 'BM-II Mix'],
  ['cc_core', 'CC Core'], ['cc_cube', 'CC Cube'], ['cement_opc_43', 'Cement OPC-43'], ['chequered_tile_22mm', 'Chequered Tile 22 mm'],
  ['clay_bricks', 'Clay Bricks'], ['dbm_bc_density', 'DBM BC Bitumen Core Density'], ['fcdc_ferro_cover', 'FCDC Ferro Cover'],
  ['grit_10mm', 'Grit 10mm'], ['grit_20mm', 'Grit 20mm'], ['gsb_iii_mix', 'GSB-III Mix'], ['interlocking_60mm', 'Interlocking 60mm'],
  ['kerb_stone', 'Kerb Stone'], ['m30_mix', 'M-30 Mix'], ['main_hole_cover_hd20', 'Main Hole Cover HD 20'],
  ['sand', 'Sand'], ['soil_omc_mdd_cbr', 'Soil OMC MDD & CBR'], ['verified_floor_tile', 'Verified Floor Tile'],
  ['water', 'Water'], ['wmm_mix', 'WMM Mix OMC MDD'],
] as const

const templates: Record<string, { title: string; standard: string; fields: TemplateField[] }> = {
  cc_cube: { title: 'CC Cube', standard: 'TEST RESULTS (AS PER IS: 516-1959 REAF 2018)', fields: [
    { key: 'location', label: 'Location' }, { key: 'size_of_cube', label: 'Size of cubes mm2' },
    { key: 'date_of_casting', label: 'Date of casting', type: 'date' }, { key: 'date_of_testing', label: 'Date of testing', type: 'date' },
    { key: 'age_of_specimen', label: 'Age of specimen' }, { key: 'load_1', label: 'Load (KN)' },
    { key: 'comp_strength_1', label: 'Comp. strength (N/mm2)' }, { key: 'avg_comp_strength', label: 'Avg. comp. strength (N/mm2)' },
    { key: 'is_code_comp_strength', label: 'As per IS code comp. strength' },
  ] },
  cc_core: { title: 'Concrete Core', standard: 'TEST RESULTS (AS PER IS: 516-1959 PART-IV)', fields: [
    { key: 'ht_core_before_facing', label: 'Core height before facing' }, { key: 'dimension_core_facing_dia', label: 'Core diameter' },
    { key: 'dimension_core_facing_height', label: 'Core height after facing' }, { key: 'core_sectional_area', label: 'Cross sectional area' },
    { key: 'correction_factor', label: 'Correction factor' }, { key: 'age_of_specimen', label: 'Age of specimen' },
    { key: 'crushing_load', label: 'Crushing load (KN)' }, { key: 'measured_comp_strength', label: 'Measured comp. strength' },
    { key: 'corrected_comp_strength', label: 'Corrected comp. strength' }, { key: 'equivalent_cube_strength', label: 'Equivalent cube strength' },
  ] },
  bitumen_core: { title: 'Bitumen Core', standard: 'TEST RESULTS', fields: [
    { key: 'name_of_test', label: 'Name of test' }, { key: 'thickness', label: 'Thickness' },
    { key: 'date_of_sampling', label: 'Date of sampling', type: 'date' }, { key: 'mathod_of_test', label: 'Method of test' },
    { key: 'density', label: 'Density' }, { key: 'result', label: 'Result' },
  ] },
  bitumen_loose: { title: 'Bitumen Sample DBM / BC', standard: 'TEST RESULTS', fields: [
    { key: 'name_of_test', label: 'Name of test' }, { key: 'date_of_sampling', label: 'Date of sampling', type: 'date' },
    { key: 'mathod_of_test', label: 'Method of test' }, { key: 'result', label: 'Bitumen content' },
  ] },
  bricks: { title: 'Clay Bricks', standard: 'TEST RESULTS', fields: [
    { key: 'dimension_length', label: 'Length' }, { key: 'dimension_width', label: 'Width' }, { key: 'dimension_height', label: 'Height' },
    { key: 'water_absorption', label: 'Water absorption' }, { key: 'efflorescence', label: 'Efflorescence' },
    { key: 'compressive_strength', label: 'Compressive strength' }, { key: 'avg_compressive_strength', label: 'Average compressive strength' },
    { key: 'limit', label: 'Limit' },
  ] },
  ferro_cover: { title: 'FCDC Ferro Cover', standard: 'TEST RESULTS', fields: [
    { key: 'dimension', label: 'Dimension' }, { key: 'load', label: 'Load' }, { key: 'strength', label: 'Strength' }, { key: 'result', label: 'Result' },
  ] },
  interlocking: { title: 'Interlocking 60mm', standard: 'TEST RESULTS', fields: [
    { key: 'length', label: 'Length' }, { key: 'width', label: 'Width' }, { key: 'thickness', label: 'Thickness' },
    { key: 'water_absorption', label: 'Water absorption' }, { key: 'compressive_strength', label: 'Compressive strength' },
  ] },
  mainhole_cover: { title: 'Main Hole Cover HD 20', standard: 'TEST RESULTS', fields: [
    { key: 'dimension', label: 'Dimension' }, { key: 'weight', label: 'Weight' }, { key: 'load', label: 'Load' },
    { key: 'compressive_strength', label: 'Compressive strength' }, { key: 'result', label: 'Result' },
  ] },
  sand: { title: 'Sand', standard: 'TEST RESULTS', fields: [
    { key: 'is_sieve_size', label: 'Sieve size' }, { key: 'weight_retained_in_gm', label: 'Weight retained (gm)' },
    { key: 'weight_retained_in_perc', label: 'Weight retained (%)' }, { key: 'cum_weight_retained_in_perc', label: 'Cumulative retained (%)' },
    { key: 'passing', label: 'Passing (%)' }, { key: 'is_grading_as_per_is', label: 'Grading as per IS' }, { key: 'remarks', label: 'Remarks' },
  ] },
  water: { title: 'Water', standard: 'TEST RESULTS', fields: [
    { key: 'name_of_test', label: 'Name of test' }, { key: 'method_of_test', label: 'Method of test' },
    { key: 'result', label: 'Result' }, { key: 'unit', label: 'Unit' }, { key: 'limit', label: 'Limit' },
  ] },
}

const materialTemplates: Array<[string, string, string, string[]]> = [
  ['acc', 'ACC Block', 'TEST RESULTS', ['parameter', 'method_of_test', 'unit', 'result', 'limit']],
  ['aac', 'ACC Block', 'TEST RESULTS', ['parameter', 'method_of_test', 'unit', 'result', 'limit']],
  ['dbm', 'DBM BC Bitumen Core Density Report', 'TEST RESULTS', ['name_of_test', 'method_of_test', 'result', 'unit', 'limit']],
  ['m-30', 'M-30 Mix', 'MIX DESIGN', ['parameter', 'result', 'requirement']],
  ['cement', 'Cement OPC-43', 'TEST RESULTS', ['name_of_test', 'method_of_test', 'result', 'unit', 'limit']],
  ['soil', 'Soil OMC MDD & CBR', 'TEST RESULTS', ['property', 'result', 'unit', 'limit']],
  ['wmm', 'WMM Mix OMC MDD', 'TEST RESULTS', ['sieve_size', 'result', 'requirement']],
  ['gsb', 'GSB-III Mix MDD OMC', 'TEST RESULTS', ['sieve_size', 'result', 'requirement']],
  ['bm-ii', 'BM-II Mix', 'MIX DESIGN', ['parameter', 'result', 'requirement']],
  ['bituminous macadam', 'BM-II Mix', 'MIX DESIGN', ['parameter', 'result', 'requirement']],
  ['grit', 'Grit', 'TEST RESULTS', ['property', 'result', 'requirement']],
  ['10mm', 'Grit (10mm)', 'TEST RESULTS', ['property', 'result', 'requirement']],
  ['20mm', 'Grit (20mm)', 'TEST RESULTS', ['property', 'result', 'requirement']],
  ['kerb', 'Kerb Stone', 'TEST RESULTS', ['property', 'result', 'requirement']],
  ['22mm', 'Chequired tile 22 mm', 'TEST RESULTS', ['property', 'result', 'requirement']],
  ['tile', 'Vertified Floor Tile', 'TEST RESULTS', ['property', 'result', 'requirement']],
]

export function resolveExcelTemplateKey(reportType: string, material: string): string {
  const lower = material.toLowerCase()
  if (reportType === 'cc_cube') return 'cc_cube'
  if (reportType === 'cc_core') return 'cc_core'
  if (reportType === 'bitumen_core' && lower.includes('dbm')) return 'dbm_bc_density'
  if (reportType === 'bitumen_core') return 'bitumen_sample_dbm_bc'
  if (reportType === 'bitumen_loose') return 'bitumen_sample_dbm_bc'
  if (reportType === 'bricks') return 'clay_bricks'
  if (reportType === 'ferro_cover') return 'fcdc_ferro_cover'
  if (reportType === 'interlocking') return 'interlocking_60mm'
  if (reportType === 'mainhole_cover') return 'main_hole_cover_hd20'
  if (reportType === 'sand') return 'sand'
  if (reportType === 'water') return 'water'
  if (lower.includes('cement')) return 'cement_opc_43'
  if (lower.includes('soil')) return 'soil_omc_mdd_cbr'
  if (lower.includes('wmm')) return 'wmm_mix'
  if (lower.includes('gsb')) return 'gsb_iii_mix'
  if (lower.includes('bm-ii') || lower.includes('bituminous macadam')) return 'bm_ii_mix'
  if (lower.includes('m-30')) return 'm30_mix'
  if (lower.includes('kerb')) return 'kerb_stone'
  if (lower.includes('22mm')) return 'chequered_tile_22mm'
  if (lower.includes('tile')) return 'verified_floor_tile'
  if (lower.includes('20mm')) return 'grit_20mm'
  if (lower.includes('10mm') || lower.includes('grit')) return 'grit_10mm'
  if (lower.includes('acc') || lower.includes('aac')) return 'acc_block'
  return 'cc_cube'
}

function getTemplate(type: string, material: string, selectedKey: string): { title: string; standard: string; fields: TemplateField[] } {
  const selectedOption = EXCEL_TEMPLATE_OPTIONS.find(([key]) => key === selectedKey)
  if (selectedOption) {
    const title = selectedOption[1]
    if (title === 'CC Cube') return templates.cc_cube
    if (title === 'CC Core') return templates.cc_core
    if (title === 'Bitumen Sample DBM / BC') return templates.bitumen_loose
    if (title === 'Clay Bricks') return templates.bricks
    if (title === 'Interlocking 60mm') return templates.interlocking
    if (title === 'Main Hole Cover HD 20') return templates.mainhole_cover
    if (title === 'Sand') return templates.sand
    if (title === 'Water') return templates.water
    return { title, standard: 'TEST RESULTS', fields: ['parameter', 'method_of_test', 'result', 'unit', 'limit'].map((key): TemplateField => ({ key, label: key.replaceAll('_', ' ') })) }
  }
  const lower = material.toLowerCase()
  const selected = materialTemplates.find(([match]) => lower.includes(match))
  if (selected) {
    return { title: selected[1], standard: selected[2], fields: selected[3].map((key): TemplateField => ({ key, label: key.replaceAll('_', ' ') })) }
  }
  return templates[type] ?? { title: type.replaceAll('_', ' '), standard: 'TEST RESULTS', fields: [
    { key: 'parameter', label: 'Parameter' }, { key: 'result', label: 'Result' }, { key: 'unit', label: 'Unit' }, { key: 'remarks', label: 'Remarks' },
  ] }
}

export function ExcelLabReportEditor({ reportType, material, details, labData, updateDetail, updateLabData, templateKey }: ExcelLabReportEditorProps) {
  const template = useMemo(() => getTemplate(reportType, material, templateKey ?? ''), [reportType, material, templateKey])
  const rows = details.length > 0 ? details : [{}]

  return (
    <section style={{ marginTop: 28, border: '1px solid #dfe6ea', background: '#fff' }}>
      <div style={{ background: '#000', color: '#fff', textAlign: 'center', padding: 10, fontWeight: 700, textTransform: 'uppercase' }}>
        {template.title} — {template.standard}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 900, borderCollapse: 'collapse', fontSize: '0.82rem' }}>
          <thead>
            <tr>
              <th style={headerStyle}>S. No.</th>
              {template.fields.map((field) => <th key={field.key} style={headerStyle}>{field.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                <td style={cellStyle}>{index + 1}</td>
                {template.fields.map((field) => {
                  const stored = row[field.key] ?? labData[field.key] ?? ''
                  const isRowField = Object.prototype.hasOwnProperty.call(row, field.key)
                  return (
                    <td key={field.key} style={cellStyle}>
                      <input
                        className="input"
                        type={field.type ?? 'text'}
                        value={stored}
                        onChange={(event) => isRowField ? updateDetail(index, field.key, event.target.value) : updateLabData(field.key, event.target.value)}
                        style={{ minWidth: 110 }}
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

const headerStyle = { background: '#000', color: '#fff', border: '1px solid #333', padding: 8, textTransform: 'uppercase' as const }
const cellStyle = { border: '1px solid #dfe6ea', padding: 8, verticalAlign: 'top' as const }
