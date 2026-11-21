/**
 * Lab report formats taken from the lab's Excel report sheets (Downloads, 20 Nov 2026).
 *
 * Each format describes its TEST RESULTS tables as a grid of cells:
 *   - text: fixed wording from the Excel (test names, methods, limits)
 *   - in:   a value the lab types (stored in reports.lab_data under that key)
 *   - calc: a value the Excel calculated with a formula (calculated here, never typed)
 * The report screen (LabFormatGrid) and the print (reportPrint.ts) both draw from this,
 * so what you type is exactly what prints.
 */

import { GRADING_COLORS, type ChartSpec } from './labCharts'

export type Values = Record<string, string>

export type Cell =
  | { text: string; rs?: number; cs?: number; left?: boolean; bold?: boolean }
  | { in: string; rs?: number; cs?: number; left?: boolean; wide?: boolean; prefix?: string }
  | { calc: string; rs?: number; cs?: number }

export type Row = Cell[]

export interface Block {
  title?: string
  /** Section heading printed left-aligned above the table, e.g. "(A) Property of Aggregate" */
  heading?: string
  head?: Row[]
  rows?: Row[]
  /** A line printed under the table, e.g. the water conclusion */
  footKey?: string
  /** Text lines (fixed, or worded from the values) printed before / after the table */
  before?: Line[]
  after?: Line[]
  /** Chart printed under the table (grading curve, compaction curve) */
  chart?: (v: Values, calc: Values) => ChartSpec | null
  /** Starts a new printed page (mix designs follow the Excel page layout) */
  pageBreak?: boolean
}

/** Paragraph text; a function words it from the typed and calculated values */
export type Line = string | ((v: Values, calc: Values) => string)

/** Standard report fields, in print order */
export type StdField =
  | 'customer_details' | 'agency_name' | 'reference_no' | 'material_details' | 'source_location'
  | 'work_order_no' | 'sample_date' | 'sample_tested_date' | 'sampled_by' | 'environment' | 'dispatch_date'

export interface HeaderExtra { key: string; label: string; after: StdField }

export interface CountControl { key: string; label: string; min: number; max: number }

/** A header row of a format with its own header (mix designs). Keys h_* are typed on the report screen. */
export interface HeaderItem { key: StdField | string; label: string; multiline?: boolean; fallback?: StdField }

export interface LabFormat {
  key: string
  /** Added to the ULR No. on the print, e.g. "/GSB-III" */
  ulrSuffix?: string
  /** Wording of Note 1 when it differs (mix designs) */
  note1?: string
  /** Printed under TEST REPORT, e.g. "Mix Design of GSB-III" */
  subtitle?: (v: Values) => string
  /** Whole header in Excel order (mix designs); otherwise the standard 10 rows */
  header?: HeaderItem[]
  /** Labels of the two Environment lines (default Temperature / Humidity) */
  envLabels?: [string, string]
  /** Header labels that differ from DEFAULT_LABELS */
  labels?: Partial<Record<StdField, string>>
  /** Extra header rows of this format (cube: age, machine, curing); typed on the report screen */
  extras?: HeaderExtra[]
  /** Row counts the lab can change (cube sets, cores, bricks…) */
  counts?: CountControl[]
  /** Values used until the lab types something */
  defaults: (v: Values) => Values
  blocks: (v: Values) => Block[]
  /** Excel formulas */
  compute?: (v: Values) => Values
  /** Older reports: results saved in the legacy per-type tables */
  fromDetails?: (details: Array<Record<string, unknown>>) => Values
}

export const DEFAULT_LABELS: Record<StdField, string> = {
  customer_details: 'Name of Client/Dept.',
  agency_name: 'Name of Agency',
  reference_no: 'Reference No.',
  material_details: 'Material Identification Details',
  source_location: 'Source/Location',
  work_order_no: 'Work order No.',
  sample_date: 'Date of Sample Receipt',
  sample_tested_date: 'Date of Sample Tested',
  sampled_by: 'Sampled by /Condition of Sample',
  environment: 'Environment Condition',
  dispatch_date: 'Date of Issue',
}

/** Temperature / humidity print as the Environment Condition rows on every format */
export const ENV_DEFAULTS: Values = { h_temperature: '27°C', h_humidity: '65%' }

// ---------------------------------------------------------------- helpers

const t = (text: string, o: Partial<{ rs: number; cs: number; left: boolean; bold: boolean }> = {}): Cell => ({ text, ...o })
const i = (key: string, o: Partial<{ rs: number; cs: number; left: boolean; wide: boolean; prefix: string }> = {}): Cell => ({ in: key, ...o })
/** Full-width group line, e.g. "(A) CC : Compressive Strength" */
const group = (key: string, cs: number, n = 1): Cell => i(key, { cs, left: true, wide: true, prefix: `(${letter(n)}) ` })
const c = (key: string, o: Partial<{ rs: number; cs: number }> = {}): Cell => ({ calc: key, ...o })
const range = (n: number) => Array.from({ length: n }, (_, k) => k + 1)
const letter = (n: number) => String.fromCharCode(64 + n)

export function num(v: string | undefined | null): number | null {
  const s = String(v ?? '').trim()
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}
const fx = (x: number | null, dp = 2) => (x === null || !Number.isFinite(x) ? '' : x.toFixed(dp))
const count = (v: Values, key: string, fallback: number) => Math.max(1, Math.round(num(v[key]) ?? fallback))
const str = (x: unknown) => (x === null || x === undefined ? '' : String(x).trim())
const avg = (xs: Array<number | null>) => {
  const ok = xs.filter((x): x is number => x !== null)
  return ok.length ? ok.reduce((a, b) => a + b, 0) / ok.length : null
}
/** Legacy rows saved '0' in unused slots */
const nz = (x: unknown) => (str(x) === '0' ? '' : str(x))

/** Gradation: weight retained → % retained, cumulative %, passing % */
function gradation(v: Values, prefix: string, sieves: number, totalKey: string): Values {
  const out: Values = {}
  const total = num(v[totalKey])
  let cum = 0
  for (const s of range(sieves)) {
    const w = num(v[`${prefix}${s}_w`])
    if (w === null || !total) continue
    const pct = (w / total) * 100
    cum += pct
    out[`${prefix}${s}_pct`] = fx(pct)
    out[`${prefix}${s}_cum`] = fx(cum)
    out[`${prefix}${s}_pass`] = fx(100 - cum)
  }
  return out
}

function gradationBlock(title: string, v: Values, prefix: string, sieves: Array<[string, string]>, totalKey: string, table: string): Block {
  return {
    title,
    head: [[t('IS sieve size (mm)'), t(`Weight retained in ${v[totalKey] || '—'} (gm)`), t('Weight retained in (%)'), t('Cum. weight retained in (%)'), t('Passing (%)'), t(`IS Grading As per IS 383-2016 ${table}`), t('Remarks')]],
    rows: sieves.map(([size, limit], k) => [
      t(size), i(`${prefix}${k + 1}_w`), c(`${prefix}${k + 1}_pct`), c(`${prefix}${k + 1}_cum`), c(`${prefix}${k + 1}_pass`), t(limit),
      ...(k === 0 ? [i(`${prefix}_remarks`, { rs: sieves.length })] : []),
    ]),
  }
}

/** Fixed list of tests: [S.No | name | method | result | unit | limit] style rows */
type TestRow = { no?: string; name: string; method?: string; key?: string; unit?: string; limit?: string; methodSpan?: number }

// ---------------------------------------------------------------- formats

const cube: LabFormat = {
  key: 'cc_cube',
  labels: { customer_details: 'Name & Address of Customer' },
  extras: [
    { key: 'h_age', label: 'Age of Specimen', after: 'sample_tested_date' },
    { key: 'h_machine', label: 'Details Of Machine Used', after: 'sampled_by' },
    { key: 'h_curing', label: 'Curing Conditions', after: 'sampled_by' },
  ],
  counts: [{ key: 'n_sets', label: 'Cube sets', min: 1, max: 5 }],
  defaults: () => {
    const d: Values = {
      n_sets: '1', h_age: '28 Days', h_machine: 'Compresive Testing Machine (Auto)  2000kn  Calibration Dt. 25/04/2026', h_curing: 'OK',
    }
    for (const s of range(5)) {
      d[`s${s}_group`] = 'CC : Compressive Strength'
      d[`s${s}_iscode`] = '20 (for CC 1:1.5:3)'
      for (const j of range(3)) Object.assign(d, { [`s${s}_${j}_mark`]: `S-${j}`, [`s${s}_${j}_l`]: '150', [`s${s}_${j}_b`]: '150' })
    }
    return d
  },
  compute: (v) => {
    const out: Values = {}
    for (const s of range(count(v, 'n_sets', 1))) {
      const strengths = range(3).map((j) => {
        const l = num(v[`s${s}_${j}_l`]), b = num(v[`s${s}_${j}_b`]), load = num(v[`s${s}_${j}_load`])
        const area = l !== null && b !== null ? l * b : null
        out[`s${s}_${j}_area`] = fx(area)
        const strength = area && load !== null ? (load / area) * 1000 : null
        out[`s${s}_${j}_str`] = fx(strength)
        return strength
      })
      out[`s${s}_avg`] = fx(avg(strengths))
    }
    return out
  },
  blocks: (v) => [{
    title: 'TEST RESULTS (As per IS : 516 Part 1/Sec 1) 2021',
    head: [[t('S. N'), t('Sample Identification Mark'), t('Size of cubes (mm)', { cs: 2 }), t('Area of cubes mm2'), t('Date of Casting'), t('Date of testing'), t('Weight of Cube in gm'), t('Load (KN)'), t('Comp. Strength (N/mm2)'), t('Avg. comp. strength (N/mm2)'), t('As per IS Code comp. strength (N/mm2)')]],
    rows: range(count(v, 'n_sets', 1)).flatMap((s) => [
      [group(`s${s}_group`, 12, s)],
      ...range(3).map((j): Row => [
        t(String(j)), i(`s${s}_${j}_mark`), i(`s${s}_${j}_l`), i(`s${s}_${j}_b`), c(`s${s}_${j}_area`),
        ...(j === 1 ? [i(`s${s}_cast`, { rs: 3 }), i(`s${s}_test`, { rs: 3 })] : []),
        i(`s${s}_${j}_wt`), i(`s${s}_${j}_load`), c(`s${s}_${j}_str`),
        ...(j === 1 ? [c(`s${s}_avg`, { rs: 3 }), i(`s${s}_iscode`, { rs: 3 })] : []),
      ]),
    ]),
  }],
  fromDetails: (rows) => {
    const v: Values = { n_sets: String(Math.max(1, rows.length)) }
    rows.forEach((r, k) => {
      const s = k + 1
      const side = Math.sqrt(num(str(r.size_of_cube)) ?? 0)
      if (side) for (const j of range(3)) Object.assign(v, { [`s${s}_${j}_l`]: fx(side, 1).replace(/\.0$/, ''), [`s${s}_${j}_b`]: fx(side, 1).replace(/\.0$/, '') })
      v[`s${s}_cast`] = str(r.date_of_casting)
      v[`s${s}_test`] = str(r.date_of_testing)
      for (const j of range(3)) v[`s${s}_${j}_load`] = nz(r[`load_${j}`])
      if (nz(r.is_code_comp_strength)) v[`s${s}_iscode`] = str(r.is_code_comp_strength)
      if (k === 0 && str(r.age_of_specimen)) v.h_age = str(r.age_of_specimen)
    })
    return v
  },
}

const core: LabFormat = {
  key: 'cc_core',
  labels: { customer_details: 'Name of Dept.', material_details: 'Material Identification', source_location: 'Name of Work', sampled_by: 'Sampled by /Condition' },
  counts: [{ key: 'n_cores', label: 'Cores', min: 1, max: 10 }],
  defaults: () => ({ n_cores: '3', age: 'After 28 Days' }),
  compute: (v) => {
    const out: Values = {}
    for (const r of range(count(v, 'n_cores', 3))) {
      const d = num(v[`r${r}_dia`]), h = num(v[`r${r}_h`]), load = num(v[`r${r}_load`])
      const area = d !== null ? (3.1429 / 4) * d * d : null
      const cf = d && h !== null ? (h / d) * 0.11 + 0.78 : null
      const measured = area && load !== null ? (load * 1000) / area : null
      const corrected = measured !== null && cf !== null ? measured * cf : null
      Object.assign(out, {
        [`r${r}_area`]: fx(area), [`r${r}_cf`]: fx(cf, 3), [`r${r}_meas`]: fx(measured),
        [`r${r}_corr`]: fx(corrected), [`r${r}_eq`]: fx(corrected !== null ? corrected * 1.25 : null),
      })
    }
    return out
  },
  blocks: (v) => {
    const n = count(v, 'n_cores', 3)
    return [{
      title: 'TEST RESULTS (As per IS : 516-1959 Part - IV RA 2018 )',
      head: [
        [t('S. No.', { rs: 2 }), t('Ht. of Core before Facing (mm)', { rs: 2 }), t('Dimension of Core after Facing', { cs: 2 }), t('Cross Sectional area'), t('Correction Factor', { rs: 2 }), t('Age of Specimen', { rs: 2 }), t('Crushing Load in KN', { rs: 2 }), t('Measured Comp. strength'), t('Corrected Comp. Strength'), t('Equivalent Cube Strength')],
        [t('Dia (mm)'), t('Height (mm)'), t('mm2'), t('N/mm2'), t('N/mm2'), t('N/mm2')],
      ],
      rows: range(n).map((r) => [
        t(String(r)), i(`r${r}_ht`), i(`r${r}_dia`), i(`r${r}_h`), c(`r${r}_area`), c(`r${r}_cf`),
        ...(r === 1 ? [i('age', { rs: n })] : []),
        i(`r${r}_load`), c(`r${r}_meas`), c(`r${r}_corr`), c(`r${r}_eq`),
      ]),
    }]
  },
  fromDetails: (rows) => {
    const v: Values = { n_cores: String(Math.max(1, rows.length)) }
    rows.forEach((r, k) => {
      const n = k + 1
      Object.assign(v, { [`r${n}_ht`]: str(r.ht_core_before_facing), [`r${n}_dia`]: str(r.dimension_core_facing_dia), [`r${n}_h`]: str(r.dimension_core_facing_height), [`r${n}_load`]: str(r.crushing_load) })
      if (k === 0 && str(r.age_of_specimen)) v.age = str(r.age_of_specimen)
    })
    return v
  },
}

const bricks: LabFormat = {
  key: 'clay_bricks',
  labels: { material_details: 'Material Identification', sampled_by: 'Sampled by /Condition' },
  counts: [{ key: 'n_bricks', label: 'Bricks tested', min: 1, max: 10 }],
  defaults: () => ({ ...Object.fromEntries(range(10).map((b) => [`b${b}_id`, String(b)])), n_bricks: '5', eff: 'Slight', lim_l: '4600±80', lim_w: '2200±40', lim_h: '1400±40', lim_wa: '20 Max.', lim_eff: 'Moderate Max.', lim_cs: 'Min 7.5 Mpa' }),
  compute: (v) => {
    const out: Values = {}
    const strengths = range(count(v, 'n_bricks', 5)).map((b) => {
      const l = num(v[`b${b}_l`]), w = num(v[`b${b}_w`]), load = num(v[`b${b}_load`])
      const s = l && w && load !== null ? (load / l / w) * 1000 : null
      out[`b${b}_str`] = fx(s)
      return s
    })
    out.cs_avg = fx(avg(strengths))
    return out
  },
  blocks: (v) => {
    const n = count(v, 'n_bricks', 5)
    return [
      {
        title: 'Test Results (As per-IS 3495 ( Parts 1 to 4 ) : 1992 RA 2016)',
        head: [[t('S.no.'), t('Name of Test'), t('Method of Test'), t('Result'), t('Unit'), t('Limit')]],
        rows: [
          [t('1', { rs: 4 }), t('Dimension & Tolerance', { left: true }), t('IS 1077:1992 RA 2016', { rs: 4 }), t(''), t(''), t('')],
          [t('(i) Length', { left: true }), i('dim_l'), t('mm'), i('lim_l')],
          [t('(ii) Width', { left: true }), i('dim_w'), t('mm'), i('lim_w')],
          [t('(iii) Height', { left: true }), i('dim_h'), t('mm'), i('lim_h')],
          [t('2'), t('Water Absorption', { left: true }), t('IS 3495 part-2 : 1992 RA 2016'), i('wa'), t('%'), i('lim_wa')],
          [t('3'), t('Efflorescence', { left: true }), t('IS 3495 part-3 : 1992 RA 2016'), i('eff'), t('-'), i('lim_eff')],
          [t('4'), t('Compressive strength', { left: true }), t('IS 3495 part-1 : 1992 RA 2016'), c('cs_avg'), t('N/mm2'), i('lim_cs')],
        ],
      },
      {
        head: [[t('ID Mark'), t('Length (mm)'), t('Width (mm)'), t('Load (kN)'), t('Compressive strength (N/mm2)'), t('Avg. Compressive strength in N/mm2')]],
        rows: range(n).map((b) => [i(`b${b}_id`), i(`b${b}_l`), i(`b${b}_w`), i(`b${b}_load`), c(`b${b}_str`), ...(b === 1 ? [c('cs_avg', { rs: n })] : [])]),
      },
    ]
  },
  fromDetails: (rows) => {
    const f = rows[0] ?? {}
    const v: Values = { n_bricks: String(Math.max(1, rows.length)), dim_l: str(f.dimension_length), dim_w: str(f.dimension_width), dim_h: str(f.dimension_height), wa: str(f.water_absorption), eff: str(f.efflorescence) }
    rows.forEach((r, k) => Object.assign(v, { [`b${k + 1}_l`]: str(r.length), [`b${k + 1}_w`]: str(r.width), [`b${k + 1}_load`]: str(r.load) }))
    return v
  },
}

/** Specimens crushed on one area: interlocking tiles (×1.06) and kerb stone */
function crushFormat(key: string, o: {
  title: string; groupText: string; location: string; area: string; iscode: string; n: number; factor: number
  head: string[]; withCollection: boolean; labels?: LabFormat['labels']
}): LabFormat {
  return {
    key,
    labels: o.labels,
    counts: [{ key: 'n_spec', label: 'Specimens', min: 1, max: 12 }],
    defaults: () => ({ n_spec: String(o.n), group: o.groupText, loc: o.location, area: o.area, iscode: o.iscode }),
    compute: (v) => {
      const out: Values = {}
      const area = num(v.area)
      const s = range(count(v, 'n_spec', o.n)).map((k) => {
        const load = num(v[`p${k}_load`])
        const x = area && load !== null ? (load / area) * 1000 * o.factor : null
        out[`p${k}_str`] = fx(x)
        return x
      })
      out.avg = fx(avg(s))
      return out
    },
    blocks: (v) => {
      const n = count(v, 'n_spec', o.n)
      return [{
        title: o.title,
        head: [o.head.map((h) => t(h))],
        rows: [
          [group('group', o.head.length)],
          ...range(n).map((k): Row => [
            t(String(k)),
            ...(k === 1 ? [i('loc', { rs: n }), i('area', { rs: n }), ...(o.withCollection ? [i('collect', { rs: n })] : []), i('test', { rs: n })] : []),
            i(`p${k}_load`), c(`p${k}_str`),
            ...(k === 1 ? [c('avg', { rs: n }), i('iscode', { rs: n })] : []),
          ]),
        ],
      }]
    },
  }
}

const interlocking: LabFormat = {
  ...crushFormat('interlocking_60mm', {
    title: 'TEST RESULTS : Compressive Strength of Inter locking Tiles as per IS:15658-2006',
    groupText: 'Compressive Strength of Inter locking Tiles 60 mm Thickness.', location: 'Inter Locking Tile(60mm)', area: '', iscode: '30 (For M-30)', n: 8, factor: 1.06,
    head: ['S.No', 'Shape & Location', 'Size/Area of tiles mm2', 'Date of Testing', 'Crushing Load (KN)', 'Corrected Comp. Strength (N/mm2)', 'Ave. Corrected Comp. Strength (N/mm2)', 'As per IS Code 28 days comp. strength (N/mm2)'],
    withCollection: false, labels: { customer_details: 'Name of Department', source_location: 'Name of Work' },
  }),
  fromDetails: (rows) => {
    const r = rows[0]
    if (!r) return {}
    const v: Values = { loc: str(r.location), area: str(r.size), test: str(r.date_of_testing) }
    if (str(r.is_code_comp_strength)) v.iscode = str(r.is_code_comp_strength)
    let n = 0
    for (const k of range(8)) if (nz(r[`crushing_load_${k}`])) { n = k; v[`p${k}_load`] = str(r[`crushing_load_${k}`]) }
    if (n) v.n_spec = String(n)
    return v
  },
}

const kerb = crushFormat('kerb_stone', {
  title: 'TEST RESULTS', groupText: 'C.C : Compressive Strength', location: 'Kerb Stone', area: '22500', iscode: '20 (for CC M-20)', n: 6, factor: 1,
  head: ['S. N', 'Location', 'Size of cubes mm2', 'Date of Collection', 'Date of testing', 'Load (KN)', 'Comp. Strength (N/mm2)', 'Avg. comp. strength (N/mm2)', 'As per IS Code 28 days comp. strength (N/mm2)'],
  withCollection: true,
})

const SAND_SIEVES: Array<[string, string]> = [['10', '100'], ['4.75', '90-100'], ['2.36', '85-100'], ['1.18', '75-100'], ['0.6', '60-79'], ['0.3', '12-40'], ['0.15', '0-10']]
const sand: LabFormat = {
  key: 'sand',
  labels: { reference_no: 'Reference letter No.', material_details: 'Material Identification with details', source_location: 'Name of Work', environment: 'Environmental conditions' },
  defaults: () => ({ g_total: '1000', g_remarks: 'Confirm in Grade-III' }),
  compute: (v) => gradation(v, 'g', SAND_SIEVES.length, 'g_total'),
  blocks: (v) => [gradationBlock('TEST RESULTS — Gradation of Fine Aggregate for RCC ( As per IS 2386 (Part-1): 1963 RA 2021)', v, 'g', SAND_SIEVES, 'g_total', 'Table-9')],
  fromDetails: (rows) => {
    const v: Values = {}
    rows.forEach((r, k) => { v[`g${k + 1}_w`] = str(r.weight_retained_in_gm) })
    if (rows[0] && str(rows[0].remarks)) v.g_remarks = str(rows[0].remarks)
    return v
  },
}

function gritFormat(key: string, size: string, sieves: Array<[string, string]>, gradTitle: string): LabFormat {
  return {
    key,
    labels: { reference_no: 'Reference letter No.', material_details: 'Material Identification with details', source_location: 'Name of Work', work_order_no: 'Work Order' },
    defaults: () => ({ g_total: '10000', g_remarks: 'with in limit' }),
    compute: (v) => gradation(v, 'g', sieves.length, 'g_total'),
    blocks: (v) => [
      {
        title: 'TEST RESULTS',
        head: [[t('S.No.'), t('Name Of Test'), t('Test Method'), t('Result'), t('Unit')]],
        rows: [[t('1'), t(`Impact value (${size} nominal Size)`, { left: true }), t('IS 2386 part 4:1963'), i('impact'), t('%')]],
      },
      gradationBlock(gradTitle, v, 'g', sieves, 'g_total', 'Table-7'),
    ],
  }
}
const grit10 = gritFormat('grit_10mm', '10mm', [['12.5', '100'], ['10', '85-100'], ['4.75', '0-20'], ['2.36', '0-5']], 'Gradation of 10 Nominal Size Coarse Graded Aggregate ( As per IS 2386 (Part-1): 1963 RA 2021)')
const grit20 = gritFormat('grit_20mm', '20mm', [['40', '100'], ['20', '90-100'], ['10', '25-55'], ['4.75', '0-10']], 'Gradation of 20 mm Graded Coarse Aggregate ( As per IS 2386 (Part-1):1963, RA 2021)')

/** A fixed list of tests with a result column */
function testListFormat(key: string, o: {
  title: string; labels?: LabFormat['labels']; head: string[]; order: Array<'no' | 'name' | 'method' | 'result' | 'unit' | 'limit'>
  tests: TestRow[]; defaults?: Values; pre?: (v: Values) => Block[]; footKey?: string
  fromDetails?: LabFormat['fromDetails']
}): LabFormat {
  return {
    key,
    labels: o.labels,
    defaults: () => ({ ...(o.defaults ?? {}) }),
    blocks: (v) => [
      ...(o.pre?.(v) ?? []),
      {
        title: o.title,
        footKey: o.footKey,
        head: [o.head.map((h) => t(h))],
        rows: o.tests.map((r): Row => o.order.flatMap((col): Cell[] => {
          switch (col) {
            case 'no': return r.no === undefined ? [] : [t(r.no)]
            case 'name': return [t(r.name, { left: true, bold: !r.key && !r.method })]
            case 'method': return r.method === undefined ? [] : [t(r.method, r.methodSpan ? { rs: r.methodSpan } : {})]
            case 'result': return [r.key ? i(r.key) : t('')]
            case 'unit': return [t(r.unit ?? '')]
            case 'limit': return [t(r.limit ?? '')]
          }
        })),
      },
    ],
    fromDetails: o.fromDetails,
  }
}

const WATER_TESTS: Array<[string, string, string, string, string]> = [
  ['pH', 'IS 3025 (P-11): 1983', '-', '6 min.', 'ph'],
  ['Chloride', 'IS 3025 (P-32): 1988', 'mg/l', '2000 (Max.)', 'chloride'],
  ['Sulphate', 'IS 3025 (P-24): 1986', 'mg/l', '400 (Max.)', 'sulphate'],
  ['Organic Matter', 'IS 3025 (P-18): 1984', 'mg/l', '200 (Max.)', 'organic'],
  ['Inorganic Matter', 'IS 3025 (P-18): 1984', 'mg/l', '3000 (Max.)', 'inorganic'],
  ['Total Suspended Solid', 'IS 3025 (P-17): 1984', 'mg/l', '2000 (Max.)', 'suspended'],
  ['Acidity', 'IS 3025 (P-22): 1986', 'ml', '5 (Max.)', 'acidity'],
  ['Alkalinity', 'IS 3025 (P-23): 1986', 'ml', '25 (Max.)', 'alkalinity'],
]
const water = testListFormat('water', {
  title: 'TEST RESULTS',
  labels: { material_details: 'Material Identification', source_location: 'Source / Location', sampled_by: 'Sampled by /Condition' },
  head: ['S.No.', 'Name of Test', 'Method of Test', 'Test Results', 'Unit', 'Specification IS 456 : 2000'],
  order: ['no', 'name', 'method', 'result', 'unit', 'limit'],
  tests: WATER_TESTS.map(([name, method, unit, limit], k) => ({ no: String(k + 1), name, method, unit, limit, key: `w${k + 1}` })),
  defaults: { conclusion: 'The above sample confirm as per IS Specification 456-2000{Clause:5.4}' },
  footKey: 'conclusion',
  fromDetails: (rows) => {
    const v: Values = {}
    for (const r of rows) {
      const name = str(r.name_of_test).toLowerCase()
      const k = WATER_TESTS.findIndex(([, , , , match]) => {
        if (match === 'ph') return /^p\.?h(\s|$)/.test(name)
        if (match === 'organic') return name.includes('organic') && !name.includes('inorganic')
        return name.includes(match)
      })
      if (k >= 0) v[`w${k + 1}`] = str(r.result)
    }
    return v
  },
})

const cement = testListFormat('cement_opc_43', {
  title: 'TEST RESULTS ( As per IS 8112:2013)',
  labels: { material_details: 'Material Identification', source_location: 'Name of Work' },
  head: ['S.No.', 'Name Of Test', 'Method of test', 'Result', 'Unit', 'Limit As per Specification'],
  order: ['no', 'name', 'method', 'result', 'unit', 'limit'],
  tests: [
    { no: '1', name: 'Consistency', method: 'IS:4031(Part-4):1988', key: 'consistency', unit: '%', limit: '-' },
    { no: '2', name: 'Setting Time', method: 'IS:4031(Part-5):1988', methodSpan: 3 },
    { no: '', name: '(i) Initial', key: 'set_initial', unit: 'Min.', limit: 'Min. 30 Min' },
    { no: '', name: '(ii) Final', key: 'set_final', unit: 'Min.', limit: 'Max. 600 Min' },
    { no: '3', name: 'Fineness Test', method: '' },
    { no: '', name: '(i) Blain Air Permeability', method: 'IS:4031(Part-2):1999', key: 'fineness', unit: 'm2/Kg', limit: 'Min. 300 m2/Kg' },
    { no: '4', name: 'Soundness Test', method: '' },
    { no: '', name: '(i) Le-Chatelier Method', method: 'IS:4031(Part-3):1988', key: 'soundness', unit: 'mm', limit: 'Max. 10mm' },
    { no: '5', name: 'Comp. Strength (3 Days)', method: 'IS:4031(Part-6):1988', methodSpan: 3, key: 'cs3', unit: 'N/mm²', limit: 'Min. 23 N/mm²' },
    { no: '', name: 'Comp. Strength (7 Days)', key: 'cs7', unit: 'N/mm²', limit: 'Min. 33 N/mm²' },
    { no: '', name: 'Comp. Strength (28 Days)', key: 'cs28', unit: 'N/mm²', limit: 'Min. 43 N/mm²' },
  ],
})

const acc = testListFormat('acc_block', {
  title: 'TEST RESULTS As per IS : 6441 (1972)',
  labels: { customer_details: 'Name & Address of Customer' },
  head: ['S. No.', 'Parameter', 'Method of Test', 'Unit', 'Result', 'Limits as Per IS 2185-Part 3 (1984)'],
  order: ['no', 'name', 'method', 'unit', 'result', 'limit'],
  tests: [
    { no: '1', name: 'Compressive Strength', method: 'IS 6441-Part 5 (1972)', unit: 'N/mm2', key: 'cs', limit: 'Min. 4.0' },
    { no: '2', name: 'Dry Density', method: 'IS 6441-Part 1 (1972)', unit: 'Kg/m3', key: 'density', limit: '551-650' },
    { no: '3', name: 'Drying Shrinkage', method: 'IS 6441-Part 2 (1972)', unit: '%', key: 'shrinkage', limit: 'Max. 0.05' },
  ],
  defaults: { sample: 'Sample 1 : Size (600X230X230)' },
  pre: () => [{ rows: [[i('sample', { left: true, wide: true })]] }],
})

/** Floor tiles: dimension readings per specimen, permitted variation, remarks */
function tileFormat(key: string, specimens: number, tests: Array<[string, string, boolean?]>): LabFormat {
  const roman = ['I', 'II', 'III', 'IV']
  return {
    key,
    labels: { material_details: 'Material Identification', sampled_by: 'Sampled by /Condition' },
    defaults: () => Object.fromEntries(tests.map((_, k) => [`t${k + 1}_rem`, 'Passed'])),
    blocks: () => [{
      title: 'Test Results',
      head: [
        [t('Sr. No', { rs: 2 }), t('Parameter', { rs: 2 }), t('Dimension', { cs: specimens }), t('Permitted Variation', { rs: 2 }), t('Remarks', { rs: 2 })],
        roman.slice(0, specimens).map((r) => t(r)),
      ],
      rows: tests.map(([name, limit, single], k): Row => [
        t(String(k + 1)), t(name, { left: true }),
        ...(single ? [i(`t${k + 1}_1`, { cs: specimens })] : range(specimens).map((s) => i(`t${k + 1}_${s}`))),
        t(limit), i(`t${k + 1}_rem`),
      ]),
    }],
  }
}
// ---------------------------------------------------------------- mix designs (multi-page Excel reports)

const MIX_DEFAULTS: Values = { h_temperature: 'As per IS Standard', h_humidity: 'As per IS Standard', h_condition: 'O.K.', h_source: 'Sample supplied by the Client.' }
const MIX_ENV: [string, string] = ['a. Room Temp', 'b. Relative Humidity']
const MIX_NOTE1 = 'Results listed refer only to the tested samples and applicable parameters. Endorsement of Product is neither inferred nor implied.'

/** Property table rows: [S.No | Parameter | Result | Limit]; a limit can span the sub-rows below it */
type Prop = { no?: string; label: string; key?: string; limit?: string; span?: number; noLimit?: boolean }
const P = (no: string, label: string, key?: string, limit?: string, span?: number): Prop => ({ no, label, key, limit, span })
const sub = (label: string, key: string, limit?: string): Prop => ({ label, key, limit, noLimit: limit === undefined })
function propRows(props: Prop[]): Row[] {
  return props.map((p) => [
    t(p.no ?? ''), t(p.label, { left: true, bold: !p.key && !!p.no }), p.key ? i(p.key) : t(''),
    ...(p.noLimit ? [] : [t(p.limit ?? '', p.span ? { rs: p.span } : {})]),
  ])
}
/** Sub-rows (a) 40 mm … for one property, e.g. specific gravity of each aggregate */
const perAggregate = (no: string, label: string, keyPrefix: string, aggs: Array<[string, string]>, limit?: string): Prop[] => [
  { no, label, limit: limit ?? '', span: limit ? aggs.length + 1 : undefined },
  ...aggs.map(([a, name], k): Prop => ({ label: `(${String.fromCharCode(97 + k)}) ${name}`, key: `${keyPrefix}_${a}`, noLimit: !!limit })),
]

/** Blend of aggregates: % passing of each × its proportion, summed = combined grading */
function blendCompute(v: Values, sieves: number, aggs: string[]): Values {
  const out: Values = {}
  let total = 0
  for (const a of aggs) total += num(v[`pr_${a}`]) ?? 0
  out.pr_total = fx(total)
  for (const k of range(sieves)) {
    let sum = 0, any = false
    for (const a of aggs) {
      const pass = num(v[`ig${k}_${a}`]), p = num(v[`pr_${a}`])
      const x = pass !== null && p !== null ? (pass * p) / 100 : null
      out[`cg${k}_${a}`] = fx(x)
      if (x !== null) { sum += x; any = true }
    }
    out[`cg${k}`] = any ? fx(sum) : ''
  }
  return out
}
/** % passing of the blend against the specification limits, like the Excel "Combined % Passing" chart */
function gradingChart(title: string, sieves: Array<[string, string, string]>, values: (k: number) => string | undefined, names = ['Lower', 'Upper', 'Combined Grading']): Block['chart'] {
  return () => ({
    title, yLabel: '% Passing', yMin: 0, yMax: 120, categories: sieves.map(([s]) => s),
    series: [
      { name: names[0], color: GRADING_COLORS.lower, points: sieves.map(([, lo]) => num(lo)) },
      { name: names[1], color: GRADING_COLORS.upper, points: sieves.map(([, , hi]) => num(hi)) },
      { name: names[2], color: GRADING_COLORS.combined, points: sieves.map((_, k) => num(values(k + 1))) },
    ],
  })
}

/** Mark blocks (by index) as starting a new printed page */
const withBreaks = (blocks: Block[], at: number[]): Block[] => blocks.map((b, k) => (at.includes(k) ? { ...b, pageBreak: true } : b))

function gradingBlocks(o: { aggs: Array<[string, string]>; sieves: Array<[string, string, string]>; individual: string; combined: string; limitHead: string }): Block[] {
  return [
    {
      heading: o.individual,
      head: [[t('S. No.'), t('Sieve size in mm'), ...o.aggs.map(([, n]) => t(`${n} % Passing`))]],
      rows: o.sieves.map(([size], k) => [t(String(k + 1)), t(size), ...o.aggs.map(([a]) => i(`ig${k + 1}_${a}`))]),
    },
    {
      heading: o.combined,
      head: [
        [t('S.No', { rs: 2 }), t('Sieve Size mm', { rs: 2 }), ...o.aggs.map(([, n]) => t(n)), t('Combined Grading', { rs: 2 }), t(o.limitHead, { cs: 2 })],
        [...o.aggs.map(() => t('Proportion (%)')), t('Lower'), t('Upper')],
      ],
      chart: (v, k) => gradingChart('Combined % Passing', o.sieves, (n) => k[`cg${n}`])?.(v, k) ?? null,
      rows: [
        [t(''), t('Proportion', { left: true }), ...o.aggs.map(([a]) => i(`pr_${a}`)), c('pr_total'), t(''), t('')],
        ...o.sieves.map(([size, lo, hi], k): Row => [t(String(k + 1)), t(size), ...o.aggs.map(([a]) => c(`cg${k + 1}_${a}`)), c(`cg${k + 1}`), t(lo), t(hi)]),
      ],
    },
  ]
}

/** Proctor points: OMC / MDD = moisture and density of the highest dry density */
function compactionCompute(v: Values): Values {
  const n = count(v, 'n_points', 4)
  let best: { mc: string; dd: number } | null = null
  for (const p of range(n)) {
    const dd = num(v[`dd${p}`])
    if (dd !== null && (!best || dd > best.dd)) best = { mc: v[`mc${p}`] ?? '', dd }
  }
  return { omc: best?.mc ?? '', mdd: best ? String(best.dd) : '' }
}
const compactionBlock = (v: Values, heading: string): Block => ({
  heading,
  chart: (x) => ({
    title: 'Moisture Content – Dry Density', yLabel: 'Maximum Dry Density (gm/cc)', xLabel: 'Optimum Moisture Content (%)',
    xValues: range(count(x, 'n_points', 4)).map((p) => num(x[`mc${p}`])),
    series: [{ name: 'Dry Density', color: GRADING_COLORS.lower, points: range(count(x, 'n_points', 4)).map((p) => num(x[`dd${p}`])) }],
  }),
  head: [[t('S. No.'), t('Particulars'), t('Unit'), ...range(count(v, 'n_points', 4)).map((p) => t(`Point ${p}`))]],
  rows: [
    [t('1'), t('Moisture Content', { left: true }), t('(%)'), ...range(count(v, 'n_points', 4)).map((p) => i(`mc${p}`))],
    [t('2'), t('Dry Density', { left: true }), t('(g/cc)'), ...range(count(v, 'n_points', 4)).map((p) => i(`dd${p}`))],
  ],
})

const mixHeader = (rows: Array<[string, string, boolean?]>): HeaderItem[] =>
  rows.map(([key, label, multiline]) => ({ key, label, multiline, ...(key === 'h_materials' ? { fallback: 'material_details' as StdField } : {}) }))

const GSB_AGGS: Array<[string, string]> = [['40', 'Aggregate (40 mm)'], ['20', 'Aggregate (20 mm)'], ['10', 'Aggregate (10 mm)'], ['sand', 'Sand']]
const GSB_SIEVES: Array<[string, string, string]> = [['53', '100', '100'], ['26.5', '55', '75'], ['4.75', '10', '30'], ['0.075', '0', '5']]
const gsb: LabFormat = {
  key: 'gsb_iii_mix',
  ulrSuffix: '/GSB-III',
  note1: MIX_NOTE1,
  subtitle: () => 'Mix Design of GSB-III',
  envLabels: MIX_ENV,
  header: mixHeader([
    ['customer_details', 'Name of Department'], ['agency_name', 'Name of Client'], ['reference_no', 'Letter Reference'],
    ['source_location', 'Name of Work'], ['h_source', 'Source'], ['h_materials', 'Material Identification', true],
    ['work_order_no', 'Work Order No.'], ['sample_date', 'Date of Sample Receipt'], ['sample_tested_date', 'Date of Sample Tested'],
    ['dispatch_date', 'Date of Issue'], ['h_method', 'Method of test'], ['h_condition', 'Condition of sample when Received'], ['environment', 'Environment condition'],
  ]),
  counts: [{ key: 'n_points', label: 'Compaction points', min: 3, max: 6 }],
  defaults: () => ({
    ...MIX_DEFAULTS, n_points: '4', h_method: 'As per MoRTH specification', pi: 'NPI',
    h_materials: 'Aggregate: 40mm (50 kg.)\nAggregate: 20mm (50 kg.)\nAggregate: 10mm (50 kg.)\nStone Dust Sand: 50 kg',
    pr_40: '35', pr_20: '25', pr_10: '22', pr_sand: '18',
  }),
  compute: (v) => ({ ...blendCompute(v, GSB_SIEVES.length, GSB_AGGS.map(([a]) => a)), ...compactionCompute(v) }),
  blocks: (v) => [
    {
      pageBreak: true,
      heading: '(A) Property of Aggregate',
      head: [[t('S. No.'), t('Parameter'), t('Result'), t('As per MoRTH Specification Table- 400-2')]],
      rows: propRows([
        P('1', 'Impact value (%)', 'impact', 'Max. 40 %'), P('2', 'Liquid Limit', 'll', 'Max. 25'), P('3', 'Plastic Index', 'pi', 'Max. 6'),
        ...perAggregate('4', 'Specific gravity', 'sg', [['40', '40 mm'], ['20', '20 mm'], ['10', '10 mm'], ['sand', 'Sand']]),
        ...perAggregate('5', 'Water Absorption', 'wa', [['40', '40 mm'], ['20', '20 mm'], ['10', '10 mm'], ['sand', 'Sand']], 'Max. 2 %'),
      ]),
    },
    ...withBreaks(gradingBlocks({ aggs: GSB_AGGS, sieves: GSB_SIEVES, individual: '(B) Grading of individual aggregates', combined: '(C) Combine grading (Percentage Passing)', limitHead: 'As per MoRTH specification Cumulative % by Weight of total aggregate passing Table 400-1' }), [1]),
    { ...compactionBlock(v, 'Moisture Content & Dry Density (Proctor)'), pageBreak: true },
    {
      heading: '(D) Moisture Content & Density of GSB-III',
      head: [[t('S. No.'), t('Particulars'), t('Result')]],
      rows: [
        [t('1'), t('Optimum Moisture Content % (OMC)', { left: true }), c('omc')],
        [t('2'), t('Maximum Dry Density (g/cc) (MDD)', { left: true }), c('mdd')],
        [t('3'), t('CBR Value at 98 % Dry Density', { left: true }), i('cbr')],
      ],
    },
  ],
}

const WMM_AGGS: Array<[string, string]> = [['40', 'Aggregate (40 mm)'], ['20', 'Aggregate (20 mm)'], ['10', 'Aggregate (10 mm)'], ['6', 'Aggregate (6 mm)'], ['dust', 'Stone Dust']]
const WMM_SIEVES: Array<[string, string, string]> = [['53', '100', '100'], ['45', '95', '100'], ['22.4', '60', '80'], ['11.2', '40', '60'], ['4.75', '25', '40'], ['2.36', '15', '30'], ['0.6', '8', '22'], ['0.075', '0', '5']]
const wmm: LabFormat = {
  key: 'wmm_mix',
  ulrSuffix: '/WMM',
  note1: MIX_NOTE1,
  subtitle: () => 'Mix Design of WMM',
  envLabels: MIX_ENV,
  header: mixHeader([
    ['customer_details', 'Name of Dept.'], ['agency_name', 'Name of Agency'], ['reference_no', 'Reference No.'], ['source_location', 'Name of work'],
    ['h_materials', 'Material Identification', true], ['work_order_no', 'Work Order No.'], ['h_source', 'Source of Material'],
    ['sample_date', 'Date of Sample Receipt'], ['sample_tested_date', 'Date of Sample Tested'], ['dispatch_date', 'Date of Issue'],
    ['h_method', 'Method of test'], ['h_condition', 'Condition of sample when Received'], ['environment', 'Environment condition'],
  ]),
  counts: [{ key: 'n_points', label: 'Compaction points', min: 3, max: 6 }],
  defaults: () => ({
    ...MIX_DEFAULTS, n_points: '4', h_method: 'As per MoRTH specification', pl: '--', pi: 'NPI', att_code: '-', att_pl: 'NPI', att_pi: 'NPI',
    h_materials: 'Aggregate: 40mm (50 kg.)\nAggregate: 20mm (50 kg.)\nAggregate: 10mm (50 kg.)\nCrushed Dust: 50 kg',
    pr_40: '28', pr_20: '19', pr_10: '18', pr_6: '20', pr_dust: '15',
  }),
  compute: (v) => ({ ...blendCompute(v, WMM_SIEVES.length, WMM_AGGS.map(([a]) => a)), ...compactionCompute(v) }),
  blocks: (v) => [
    {
      pageBreak: true,
      heading: '(A) Property of Aggregate',
      head: [[t('S. No.'), t('Parameter'), t('Result'), t('As per MORTH Specification Table- 400-12')]],
      rows: propRows([
        P('1', 'Impact value (%)', 'impact', 'Max. 30 %'), P('2', 'Elongation Index and Flakiness Index (Combined)', 'eifi', 'Max. 30%'),
        P('3', 'Liquid limit %', 'll', 'Max. 25%'), sub('Plastic Limit %', 'pl', ''), sub('Plasticity Index (PI) % (Stone Dust)', 'pi', 'Max. 6'),
        ...perAggregate('4', 'Specific gravity', 'sg', [['40', '40 mm'], ['20', '20 mm'], ['10', '10 mm'], ['6', '6 mm'], ['dust', 'Stone Dust']]),
        ...perAggregate('5', 'Water Absorption', 'wa', [['40', '40 mm'], ['20', '20 mm'], ['10', '10 mm'], ['6', '6 mm'], ['dust', 'Stone Dust']], 'Max. 2 %'),
      ]),
    },
    ...withBreaks(gradingBlocks({ aggs: WMM_AGGS, sieves: WMM_SIEVES, individual: '(B) Grading of individual aggregates', combined: '(C) Combine grading (Percentage Passing)', limitHead: 'As per MoRTH specification Cumulative % by Weight of total aggregate passing Table 400-13' }), [0]),
    { ...compactionBlock(v, 'Moisture Content & Dry Density (Proctor)'), pageBreak: true },
    {
      pageBreak: true,
      heading: '(D) Moisture Content & Density of WMM',
      head: [[t('S.No'), t('Particulars'), t('Result')]],
      rows: [[t('1'), t('Optimum Moisture Content %', { left: true }), c('omc')], [t('2'), t('Density (gm/cc)', { left: true }), c('mdd')]],
    },
    {
      heading: "(E) Atterberg's limits of WMM",
      head: [[t('S.No'), t('Code no of sample'), t('L.L (%)'), t('P.L (%)'), t('P.I (%)')]],
      rows: [[t('1'), i('att_code'), i('att_ll'), i('att_pl'), i('att_pi')]],
    },
  ],
}

const BM_AGGS: Array<[string, string]> = [['20', 'Agg. (20mm)'], ['10', 'Aggregate (10mm)'], ['sand', 'Sand']]
const BM_SIEVES: Array<[string, string, string]> = [['26.5mm', '100', '100'], ['19mm', '90', '100'], ['13.2mm', '56', '88'], ['4.75mm', '16', '36'], ['2.36 mm', '4', '19'], ['300 micron', '2', '10'], ['75 micron', '0', '8']]
const bm2: LabFormat = {
  key: 'bm_ii_mix',
  subtitle: () => 'Mix Design of BM-II',
  envLabels: MIX_ENV,
  header: mixHeader([
    ['customer_details', 'Name of Client'], ['agency_name', 'Name of Agency'], ['reference_no', 'Letter Reference'], ['source_location', 'Name of Work'],
    ['h_source', 'Source'], ['h_materials', 'Material Identification', true], ['work_order_no', 'Work Order No.'],
    ['sample_date', 'Date of Sample Receipt'], ['sample_tested_date', 'Date of Sample Testing'], ['dispatch_date', 'Date of Issue'],
    ['h_method', 'Method of test'], ['h_condition', 'Condition of sample when Received'], ['environment', 'Environment condition'],
  ]),
  counts: [{ key: 'n_cdm', label: 'CDM specimens', min: 1, max: 6 }],
  defaults: () => ({
    ...MIX_DEFAULTS, h_method: 'As per MORTH specification Revision- V', n_cdm: '4', bit_type: 'VG-30', b_duct: 'Not Rupture',
    h_materials: 'Aggregate: 20mm (50 kg.)\nAggregate: 10mm (50 kg.)\nStone Dust: 50 kg\nBitumen VG-30',
    pr_20: '50', pr_10: '30', pr_sand: '20', ap_20: '48', ap_10: '29', ap_bit: '3.4', ap_sand: '19.6',
  }),
  compute: (v) => {
    const out = blendCompute(v, BM_SIEVES.length, BM_AGGS.map(([a]) => a))
    const parts = ['ap_20', 'ap_10', 'ap_bit', 'ap_sand'].map((k) => num(v[k]))
    out.ap_total = parts.some((x) => x !== null) ? fx(parts.reduce<number>((a, b) => a + (b ?? 0), 0)) : ''
    out.cdm_avg = fx(avg(range(count(v, 'n_cdm', 4)).map((k) => num(v[`cdm${k}`]))), 3)
    return out
  },
  blocks: (v) => [
    {
      pageBreak: true,
      title: 'Mix Design of Bituminous Macadam',
      before: ['INTRODUCTION', 'Mix design Procedure for Bitumen Macadam (BM) is largely a Matter of Selecting and Proportioning Materials to obtain the desired Properties in the Finished Construction. Method of Mix Design is adopted for achieving the above objective.'],
      heading: '(A) Grading Composition of Bituminous Macadam: (grading-2) as per MoRTH',
      head: [[t('S.No.'), t('Sieve Size'), t('As per MORTH specification Cumulative % by Weight of total aggregate passing Table 500-7')]],
      rows: BM_SIEVES.map(([size, lo, hi], k) => [t(String(k + 1)), t(size), t(lo === hi ? lo : `${lo}-${hi}`)]),
    },
    {
      heading: '(B) Property of Coarse Aggregate',
      head: [[t('S. No.'), t('Parameter'), t('Result'), t('As per MORTH Specification')]],
      rows: propRows([
        P('1', 'Impact value (%) 20mm', 'impact', 'Max. 30 %'), P('2', 'Elongation Index and Flakiness Index (Combined)', 'eifi', 'Max. 35%'),
        P('3', 'Stripping', 'stripping', 'Min. 95% Retained Coating.'),
        ...perAggregate('4', 'Water absorption', 'wa', [['20', '20 mm'], ['10', '10 mm'], ['sand', 'Sand']], 'Max. 2%'),
        ...perAggregate('5', 'Specific gravity', 'sg', [['20', '20 mm'], ['10', '10 mm'], ['sand', 'Sand']]),
      ]),
    },
    {
      pageBreak: true,
      heading: `(B.1) Bitumen (${v.bit_type || 'VG-30'}) Test Result`,
      head: [[t('S.No'), t('Name of Test'), t('Observation'), t('Requirement As per IS: 73')]],
      rows: propRows([
        P('(a)', 'Penetration Value in mm', 'b_pen', 'Min 45'), P('(b)', 'Specific Gravity', 'b_sg', '--'), P('(c)', 'Ductility, Value in mm', 'b_duct', 'Min. 40'),
        P('(d)', 'Softening Point, Value in ºC', 'b_soft', 'Min. 47'), P('(e)', '(a) Kinematic Viscosity (cSt)', 'b_kin', 'Min. 350'), P('', '(b) Absolute Viscosity (Poise)', 'b_abs', '2400-3600'),
      ]),
    },
    {
      ...gradingBlocks({ aggs: BM_AGGS, sieves: BM_SIEVES, individual: '(C) Selection of aggregates to be used in the mix', combined: '', limitHead: '' })[0],
      before: ['The aggregate of nominal size 20mm, 10mm and Sand are blended in suitable proportions to satisfy the selected grading. The percentage of each type of aggregates depends on the individual gradation; the grading of individual aggregates are given below:'],
    },
    {
      ...gradingBlocks({ aggs: BM_AGGS, sieves: BM_SIEVES, individual: '', combined: '(D) Determination of proportion of each type of aggregates — Combined Grading Percentage Passing', limitHead: 'Selected MORTH limits' })[1],
      before: [(x) => `The proportioning of various size of aggregates is done by trial and error method from grading of individual types of aggregates; the blend proportion are ${x.pr_20 || '—'}% : ${x.pr_10 || '—'}% : ${x.pr_sand || '—'}%. The combined grading along with limits of selected grading is given below:`],
    },
    {
      pageBreak: true,
      heading: '(E) Aggregate proportion of Bituminous Macadam',
      head: [[t('Grit Size'), t('Grit 20 mm'), t('Grit 10 mm'), t(`Bitumen (${v.bit_type || 'VG-30'})`), t('Sand'), t('Total')]],
      rows: [[t('%'), i('ap_20'), i('ap_10'), i('ap_bit'), i('ap_sand'), c('ap_total')]],
      after: [(x) => `(F) Type of Bitumen : ${x.bit_type || ''}`],
    },
    {
      heading: '(G) CDM of Bituminous Macadam',
      head: [[t('S.No.'), t(`CDM At ${v.ap_bit || '—'} % (Bitumen ${v.bit_type || 'VG-30'}) (gm/cc)`), t('Avg. Density (gm/cc)')]],
      rows: range(count(v, 'n_cdm', 4)).map((k) => [t(String(k)), i(`cdm${k}`), ...(k === 1 ? [c('cdm_avg', { rs: count(v, 'n_cdm', 4) })] : [])]),
    },
  ],
}

/** M-30 gradation tables: weight retained → %, cumulative, passing; IS lower / higher limits */
function m30Grad(title: string, prefix: string, sieves: Array<[string, string, string]>, v: Values): Block {
  return {
    heading: title.replace('{total}', v[`${prefix}_total`] || '—'),
    chart: (x, k) => gradingChart('% Passing', sieves, (n) => k[`${prefix}${n}_pass`], ['Lower', 'Higher', 'Passing (%)'])?.(x, k) ?? null,
    head: [
      [t('IS sieve size (mm)', { rs: 2 }), t('Weight retained in (gm)', { rs: 2 }), t('Weight retained in (%)', { rs: 2 }), t('Cum. weight retained in (%)', { rs: 2 }), t('Passing (%)', { rs: 2 }), t('Range as per IS', { cs: 2 }), t('Remarks', { rs: 2 })],
      [t('Lower'), t('Higher')],
    ],
    rows: sieves.map(([size, lo, hi], k): Row => [t(size), i(`${prefix}${k + 1}_w`), c(`${prefix}${k + 1}_pct`), c(`${prefix}${k + 1}_cum`), c(`${prefix}${k + 1}_pass`), t(lo), t(hi), ...(k === 0 ? [i(`${prefix}_remarks`, { rs: sieves.length })] : [])]),
  }
}
const FA_SIEVES: Array<[string, string, string]> = [['10', '100', '100'], ['4.75', '90', '100'], ['2.36', '75', '100'], ['1.18', '55', '90'], ['0.6', '35', '59'], ['0.3', '8', '30'], ['0.15', '0', '12']]
const C10_SIEVES: Array<[string, string, string]> = [['12.5', '100', '100'], ['10', '85', '100'], ['4.75', '0', '20'], ['2.36', '0', '5']]
const C20_SIEVES: Array<[string, string, string]> = [['40', '100', '100'], ['20', '85', '100'], ['10', '0', '20'], ['4.75', '0', '5']]
/** All-in aggregate sieves: % passing of each aggregate from its own table (above its largest sieve: 100) */
const AI_SIEVES: Array<{ size: string; lo: string; hi: string; fa: string; c10: string; c20: string }> = [
  { size: '40', lo: '100', hi: '100', fa: '100', c10: '100', c20: 'c201_pass' },
  { size: '20', lo: '95', hi: '100', fa: '100', c10: '100', c20: 'c202_pass' },
  { size: '4.75', lo: '30', hi: '50', fa: 'fa2_pass', c10: 'c103_pass', c20: 'c204_pass' },
  { size: '0.6', lo: '10', hi: '35', fa: 'fa5_pass', c10: '', c20: '' },
  { size: '0.15', lo: '0', hi: '6', fa: 'fa7_pass', c10: '', c20: '' },
]
const m30: LabFormat = {
  key: 'm30_mix',
  subtitle: (v) => `CONCRETE MIX DESIGN ${v.grade || 'M-30'} ( REF STANDARD- IS -456: 2000 & IS:10262-2019 )`,
  header: mixHeader([
    ['customer_details', 'Name of Department'], ['agency_name', 'Name of Client'], ['reference_no', 'Letter Reference'], ['source_location', 'Name of Work'],
    ['sampled_by', 'Sampled by /Condition of Sample'], ['h_materials', 'Material Identification', true], ['sample_date', 'Date of Sample Receipt'],
    ['sample_tested_date', 'Date of Sample Testing'], ['dispatch_date', 'Date of Issue'], ['work_order_no', 'Work order No.'],
  ]),
  extras: [{ key: 'grade', label: 'Grade of concrete', after: 'material_details' }, { key: 'cement_brand', label: 'Cement', after: 'material_details' }],
  defaults: () => ({
    grade: 'M-30', fck: '30', cement_brand: 'Wonder Cement (43g OPC)', fa_type: 'M- Sand', ca_type: 'Crusher produced',
    h_materials: 'Aggregate: 20mm (50 kg.)\nAggregate: 10mm (50 kg.)\nFine Aggregate: M- Sand 50 kg\nCement: 1 Bag (50 kg.)\nWonder Cement (43g OPC)\nAdmixture Sika NS4',
    fm20: '-', fm10: '-', fmfa: '-', imp_fa: '-',
    fa_total: '5000', c10_total: '10000', c20_total: '10000', fa_remarks: 'Conforming', c10_remarks: 'Conforming', c20_remarks: 'Conforming',
    ai_fa: '40', ai_10: '28', ai_20: '32',
    max_agg: '20 mm', slump_req: '25-75 mm (Pumpable)', qc: 'Good', exposure: 'Moderate', fm_c: '0', fm_f: '0',
    t_factor: '1.65', s_dev: '5', wc_max: '0.45', water_table: '186', sand_pct: '40', water: '164', wc: '0.40', cement_min: '300',
    adm_pct: '0.95', bag: '50',
  }),
  compute: (v) => {
    const out: Values = { ...gradation(v, 'fa', FA_SIEVES.length, 'fa_total'), ...gradation(v, 'c10', C10_SIEVES.length, 'c10_total'), ...gradation(v, 'c20', C20_SIEVES.length, 'c20_total') }
    const val = (k: string) => (k === '100' ? 100 : num(out[k] ?? v[k]))
    // All-in aggregate: weighted passing; sieves an aggregate was not graded on are typed (weighted) values
    const pr = { fa: num(v.ai_fa), c10: num(v.ai_10), c20: num(v.ai_20) }
    out.ai_total = fx((pr.fa ?? 0) + (pr.c10 ?? 0) + (pr.c20 ?? 0))
    AI_SIEVES.forEach((s, k) => {
      let sum = 0, any = false
      for (const a of ['fa', 'c10', 'c20'] as const) {
        const typed = s[a] === ''
        const x = typed ? num(v[`ai${k + 1}_${a}`]) : (() => { const p = val(s[a]); return p !== null && pr[a] !== null ? (p * (pr[a] as number)) / 100 : null })()
        if (!typed) out[`ai${k + 1}_${a}`] = fx(x)
        if (x !== null) { sum += x; any = true }
      }
      out[`ai${k + 1}`] = any ? fx(sum) : ''
    })
    // Copies of test data used in the design
    Object.assign(out, { d_sgc: v.c_sg ?? '', d_imp: v.imp20 ?? '', d_sg20: v.sg20 ?? '', d_sg10: v.sg10 ?? '', d_sgfa: v.sgfa ?? '', d_wa20: v.wa20 ?? '', d_wa10: v.wa10 ?? '', d_wafa: v.wafa ?? '' })
    const fck = num(v.fck), tf = num(v.t_factor), sd = num(v.s_dev)
    out.target = fck !== null && tf !== null && sd !== null ? fx(fck + tf * sd) : ''
    const water = num(v.water), wc = num(v.wc), sgc = num(v.c_sg)
    const cement = water !== null && wc ? water / wc : null
    out.cement = fx(cement, 0)
    const min = num(v.cement_min)
    out.cement_check = cement !== null && min !== null ? (cement >= min ? `${fx(cement, 0)} Kg/m3 is greater than ${min} Kg/m3, Hence O.K.` : `${fx(cement, 0)} Kg/m3 is less than ${min} Kg/m3 — increase cement`) : ''
    // IS 10262 volumes per m3 of concrete
    const volCement = cement !== null && sgc ? cement / sgc / 1000 : null
    const volWater = water !== null ? water / 1000 : null
    const volAgg = volCement !== null && volWater !== null ? 1 - (volCement + volWater) : null
    Object.assign(out, { vol_a: '1', vol_b: fx(volCement, 3), vol_c: fx(volWater, 3), vol_d: fx(volAgg, 3) })
    const mass = (sg: string | undefined, p: number | null) => { const g = num(sg); return volAgg !== null && g !== null && p !== null ? (volAgg * 1000 * g * p) / 100 : null }
    const msand = mass(v.sgfa, pr.fa), m10 = mass(v.sg10, pr.c10), m20 = mass(v.sg20, pr.c20)
    const adm = num(v.adm_pct)
    Object.assign(out, {
      tm_water: fx(water, 0), tm_cement: fx(cement, 0), tm_sand: fx(msand), tm_10: fx(m10), tm_20: fx(m20), tm_adm: fx(cement !== null && adm !== null ? (cement * adm) / 100 : null, 3),
    })
    const a7 = avg([1, 2, 3].map((k) => num(v[`cs7_${k}`]))), a28 = avg([1, 2, 3].map((k) => num(v[`cs28_${k}`])))
    out.avg7 = fx(a7)
    out.avg28 = fx(a28)
    // Per bag of cement
    const bag = num(v.bag)
    const f = bag !== null && cement ? bag / cement : null
    const per = (x: number | null) => fx(f !== null && x !== null ? x * f : null)
    Object.assign(out, { bg_water: per(water), bg_cement: fx(bag, 0), bg_sand: per(msand), bg_10: per(m10), bg_20: per(m20), bg_adm: fx(bag !== null && adm !== null ? (bag * adm) / 100 : null, 3) })
    return out
  },
  blocks: (v) => {
    const grade = v.grade || 'M-30'
    const two = (label: string, cell: Cell, unit = ''): Row => [t(label, { left: true }), cell, t(unit)]
    const trialHead = (title: string): Row[] => [
      [t('Sr. No.', { rs: 2 }), t(title, { cs: 7 }), t('7/28 days compressive strength (N/mm²)', { cs: 3 }), t('Avg. 7/28 days comp. Str. (N/mm²)', { rs: 2 })],
      [t('Water (liter)'), t('Cement (Kg)'), t('M-Sand (Kg)'), t('10 mm (kg)'), t('20mm (Kg)'), t(`Admixture @ ${v.adm_pct || '—'} % Wt. of Cement (Lit)`), t('Slump'), t('1'), t('2'), t('3')],
    ]
    const trialRows = (p: string): Row[] => [
      [t('7 days'), c(`${p}_water`, { rs: 2 }), c(`${p}_cement`, { rs: 2 }), c(`${p}_sand`, { rs: 2 }), c(`${p}_10`, { rs: 2 }), c(`${p}_20`, { rs: 2 }), c(`${p}_adm`, { rs: 2 }), i('slump', { rs: 2 }), i('cs7_1'), i('cs7_2'), i('cs7_3'), c('avg7')],
      [t('28 days'), i('cs28_1'), i('cs28_2'), i('cs28_3'), c('avg28')],
    ]
    return [
      {
        heading: '1. Method of test',
        rows: [
          [t('IS:2386 (Pt-1,3,4), IS:516, IS:4031, IS:8112 (Pt-4,5,6 & 11), IS: 10262: 2019, IS:9013-1978 Reaf. 2017 SP-23', { cs: 2, left: true })],
          ...['Water cement ratio.', 'Aggregate cement ratio.', 'Properties of aggregate.', 'Maximum size of aggregate.', 'Workability of green concrete', 'Method of placing', 'Compaction.', 'Curing of concrete']
            .map((x, k): Row => [t(String(k + 1)), t(x, { left: true })]),
        ],
        after: ['Design of concrete mix is a complex task because of vast variation in properties of constituent materials. Design of mix requires complete knowledge of constituent materials. The mix designer should be well versed with the properties of constituent materials and also what deviations are possible at site.'],
      },
      {
        pageBreak: true,
        heading: '2. INFORMATION REGARDING WORK',
        rows: [
          [t(`The work includes design of ${grade} grade concrete mix from the cement, aggregate and admixture supplied by the Client. The brief description of material is as given below.`, { cs: 2, left: true })],
          [t('Brief specification of material supplied by the client.', { cs: 2, bold: true })],
          [t('Sand'), i('fa_type', { left: true })],
          [t('Coarse aggregate'), i('ca_type', { left: true })],
          [t('Following tests on aggregate were conducted in NCS laboratory to assess its properties', { cs: 2, bold: true })],
          ...['Specific gravity.', 'Water absorption.', 'Particle size distribution of fine aggregate.', 'Particle size distribution of coarse aggregate.', 'Particle size distribution on mixed aggregate with respect to their chosen proportions.']
            .map((x, k): Row => [t(String(k + 1)), t(x, { left: true })]),
          [t('3. SCOPE OF WORK', { bold: true }), t('Design proportions of various ingredients of concrete as per IS: 10262-2019 to achieve the desired target strength and conducting following tests on Aggregate and concrete to assess its suitability for intended purpose.', { left: true })],
          ...['Specific gravity of fine aggregate.', 'Water absorption of fine aggregate.', 'Particle size distribution of fine aggregate.', 'Specific gravity of coarse aggregate.', 'Water absorption of coarse aggregate.', 'Particle size distribution of coarse aggregate, individual and combined.', 'Particle size distribution of all in one aggregate.', 'Slump test.', '7/28 days compressive strength']
            .map((x, k): Row => [t(String(k + 1)), t(x, { left: true })]),
          [t('The result obtained as per IS 2386 are presented in Table-1, Table-2, Table-3. Trial mixes are tabulated along with test on green and set concrete in Table-5.', { cs: 2, left: true })],
        ],
      },
      {
        pageBreak: true,
        heading: `1. Cement : ${v.cement_brand || ''} — TEST RESULTS ( As per IS 8112:2013)`,
        head: [[t('S.No.'), t('Name Of Test'), t('Method of test'), t('Result'), t('Unit'), t('Limit As per Specification')]],
        rows: [
          [t('1'), t('Specific Gravity', { left: true }), t('IS:4031(Part-11):1988'), i('c_sg'), t('-'), t('-')],
          [t('2'), t('Consistency', { left: true }), t('IS:4031(Part-4):1988'), i('c_cons'), t('%'), t('-')],
          [t('3'), t('Setting Time', { left: true, bold: true }), t('IS:4031(Part-5):1988', { rs: 3 }), t(''), t(''), t('')],
          [t(''), t('(i) Initial', { left: true }), i('c_init'), t('Min.'), t('Min. 30')],
          [t(''), t('(ii) Final', { left: true }), i('c_final'), t('Min.'), t('Max. 600')],
          [t('4'), t('Fineness Test', { left: true, bold: true }), t(''), t(''), t(''), t('-')],
          [t(''), t('(i) Blain Air Permeability', { left: true }), t('IS:4031(Part-2):1999'), i('c_fine'), t('m2/Kg'), t('Min. 300 m2/Kg')],
          [t('5'), t('Soundness Test', { left: true, bold: true }), t(''), t(''), t(''), t('')],
          [t(''), t('(i) Le-Chatelier Method', { left: true }), t('IS:4031(Part-3):1988'), i('c_sound'), t('mm'), t('Max. 10mm')],
          [t('6'), t('Comp. Strength (7 Days)', { left: true }), t('IS:4031(Part-6):1988', { rs: 2 }), i('c_cs7'), t('N/mm²'), t('Min. 33 N/mm²')],
          [t(''), t('Comp. Strength (28 Days)', { left: true }), i('c_cs28'), t('N/mm²'), t('Min. 43 N/mm²')],
        ],
      },
      {
        heading: '2. PHYSICAL PROPERTIES OF AGGREGATES (COARSE/FINE)',
        head: [[t('S.No.'), t('Name Of Test'), t('Method of test'), t('20mm'), t('10mm'), t('M- Sand'), t('Requirement')]],
        rows: [
          [t('a'), t('Specific Gravity', { left: true }), t('As Per IS :2386 pt-3'), i('sg20'), i('sg10'), i('sgfa'), t('')],
          [t('b'), t('Impact Value (%)', { left: true }), t('As Per IS :2386 pt-4'), i('imp20'), i('imp10'), i('imp_fa'), t('Max. 30')],
          [t('c'), t('Water Absorption (%)', { left: true }), t('As Per IS :2386 pt-3'), i('wa20'), i('wa10'), i('wafa'), t('')],
          [t('d'), t('Free Surface Moisture (%)', { left: true }), t('As Per IS :2386 pt-3'), i('fm20'), i('fm10'), i('fmfa'), t('')],
        ],
      },
      { ...m30Grad('Table No-1 : Particle size distribution of fine aggregate Total Wt. = {total} gm (Range as per IS Zone-II)', 'fa', FA_SIEVES, v), pageBreak: true },
      { ...m30Grad('Table No-2 : Particle size distribution of 10mm coarse aggregate Total Wt. = {total} gm', 'c10', C10_SIEVES, v) },
      { ...m30Grad('Table No-3 : Particle size distribution of 20mm coarse aggregate Total Wt. = {total} gm', 'c20', C20_SIEVES, v), pageBreak: true },
      {
        heading: 'Table No-4 : All-in-Aggregate Total (20mm, 10mm, Sand)',
        chart: (x, k) => gradingChart('% Passing', AI_SIEVES.map((s) => [s.size, s.lo, s.hi]), (n) => k[`ai${n}`], ['Lower', 'Higher', 'Combine'])?.(x, k) ?? null,
        head: [
          [t('IS sieve size (mm)', { rs: 2 }), t('Fine Aggregate'), t('10mm Aggregate'), t('20mm Aggregate'), t('Combine', { rs: 2 }), t('Range as per IS', { cs: 2 })],
          [t('Proportion (%)'), t('Proportion (%)'), t('Proportion (%)'), t('Lower'), t('Higher')],
        ],
        rows: [
          [t('Proportion', { left: true }), i('ai_fa'), i('ai_10'), i('ai_20'), c('ai_total'), t(''), t('')],
          ...AI_SIEVES.map((s, k): Row => [
            t(s.size),
            ...(['fa', 'c10', 'c20'] as const).map((a) => (s[a] === '' ? i(`ai${k + 1}_${a}`) : c(`ai${k + 1}_${a}`))),
            c(`ai${k + 1}`), t(s.lo), t(s.hi),
          ]),
        ],
      },
      {
        pageBreak: true,
        heading: `Design of mix ${grade} — (a) Design stipulations`,
        rows: [
          two('Characteristic strength', i('fck'), 'N/mm²'), two('Maximum size of aggregate', i('max_agg')), two('Degree of workability (Slump)', i('slump_req')),
          two('Degree of quality control', i('qc')), two('Type of weather exposure', i('exposure')),
        ],
      },
      {
        heading: '(b) Test Data for Materials',
        rows: [
          two('Specific gravity of cement', c('d_sgc')), two('Impact of coarse aggregate', c('d_imp')), two('Specific gravity of 20mm aggregate', c('d_sg20')),
          two('Specific gravity of 10mm coarse aggregate', c('d_sg10')), two('Specific gravity of fine aggregate', c('d_sgfa')),
          two('Water Absorption of 20mm Coarse Aggregate', c('d_wa20')), two('Water Absorption of 10mm Coarse Aggregate', c('d_wa10')), two('Water Absorption of fine Aggregate', c('d_wafa')),
          two('Free surface moisture of coarse aggregate', i('fm_c')), two('Free surface moisture of fine aggregate', i('fm_f')),
        ],
        after: ['Particle size distribution coarse aggregate conforms to range listed in IS: 10262:2019.', 'Particle size distribution fine aggregate conforming to zone II of IS 383:2016.'],
      },
      {
        heading: '(c) Target mean Strength',
        rows: [two('t', i('t_factor')), two('s', i('s_dev')), two('Target strength = fck + t × s', c('target'), 'N/mm²'), two('(d) From table 5 of IS 456 Maximum water cement ratio', i('wc_max'))],
      },
      {
        heading: '(e) Water and sand content — (f) Cement content = Water content / W/C ratio',
        rows: [
          two('Water content/cum for target strength (table)', i('water_table'), 'liter'), two('Sand content as percentage of total aggregate', i('sand_pct'), '%'),
          two('Water adopted', i('water'), 'Lit'), two('W/C ratio adopted', i('wc')), two('Cement content', c('cement'), 'Kg/m3'),
          two(`Minimum cement content for "${v.exposure || ''}" exposure (Table 5 of IS 456)`, i('cement_min'), 'Kg/m3'),
        ],
        after: [(_x, k) => k.cement_check || ''],
      },
      {
        pageBreak: true,
        heading: '(g) Mix Calculations',
        rows: [
          two('A. Volume of concrete', c('vol_a'), 'm3'), two('B. Volume of cement = (Mass of cement / Specific gravity of cement) × 1/1000', c('vol_b'), 'm3'),
          two('C. Volume of water = (Mass of water / Specific gravity of water) × 1/1000', c('vol_c'), 'm3'), two('D. Volume of all aggregate = A − (B + C)', c('vol_d'), 'm3'),
        ],
      },
      {
        heading: `Table-4 : Trial mix ${grade}`,
        head: trialHead('Quantity of Material / Cum of Concrete in Kg'),
        rows: trialRows('tm'),
        after: ['6. REPORT:-', (_x, k) => `The Avg. strength of three cubes tested for 7/28 days ${k.avg7 || '—'}/${k.avg28 || '—'} N/mm².`],
      },
      {
        heading: `7. RECOMMENDATIONS — Table-5 : Recommended mix proportions for ${grade} concrete (Quantities of material per ${v.bag || '—'} kg bag of cement)`,
        head: trialHead('Quantity of Material per bag of Cement in Kg'),
        rows: trialRows('bg'),
      },
    ]
  },
}

const tile22 = tileFormat('chequered_tile_22mm', 4, [
  ['Length', '± 0.4 %'], ['Width', '± 0.2 %'], ['Thickness', '± 4 %'], ['Straightness', '± 0.15 %'], ['Surface flatness', '± 0.22 %'],
  ['Surface quality', '1 defect in 20', true], ['Water Absorption', 'Less than 20 %'],
])
const floorTile = tileFormat('verified_floor_tile', 1, [
  ['Length', '± 0.4 %'], ['Width', '± 0.1 %'], ['Straightness', '--'], ['Surface flatness', '--'],
  ['Water Absorption', 'Less than 0.5 %'], ['Hardness', 'For Commercial Application 7 Min. For Home 5 Min.'],
])

const SOIL_TESTS: Array<[string, string, string, string, string]> = [
  ['1', 'Optimum Moisture Content (OMC)', 'IS 2720 P-8:1983', '%', 'omc'],
  ['2', 'Maximum Dry Density (MDD)', 'IS 2720 P-8:1983', 'g/cc', 'mdd'],
  ['3', 'Liquid Limit (LL)', 'IS 2720 P-5:1985', '%', 'll'],
  ['', 'Plastic Limit (PL)', 'IS 2720 P-5:1985', '%', 'pl'],
  ['', 'Plastic Index (PI)', 'IS 2720 P-5:1985', '%', 'pi'],
  ['4', '4 days Soaked CBR (%)', 'IS 2720 P-16:1987', '%', 'cbr'],
]
const soil: LabFormat = {
  key: 'soil_omc_mdd_cbr',
  labels: { material_details: 'Material Identification', source_location: 'Name of Work', sampled_by: 'Sampled by/Condition' },
  counts: [{ key: 'n_samples', label: 'Samples', min: 1, max: 5 }],
  defaults: () => ({ n_samples: '3' }),
  compute: (v) => {
    const out: Values = {}
    for (const s of range(count(v, 'n_samples', 3))) {
      const parts = ['gravel', 'coarse', 'medium', 'fine'].map((p) => num(v[`s${s}_${p}`]))
      out[`s${s}_silt`] = parts.some((p) => p !== null) ? fx(100 - parts.reduce<number>((a, b) => a + (b ?? 0), 0)) : ''
    }
    return out
  },
  blocks: (v) => {
    const n = count(v, 'n_samples', 3)
    return [
      {
        title: 'Grain Size Analysis : As per IS 2720 -IV',
        head: [[t('S. No.'), t('Gravel (%) (4.75mm)'), t('Coarse Sand (%) (2 mm)'), t('Medium Sand (%) (0.425 mm)'), t('Fine Sand (%) (0.075 mm)'), t('Silt & Clay (%) (PAN)')]],
        rows: range(n).map((s) => [t(String(s)), i(`s${s}_gravel`), i(`s${s}_coarse`), i(`s${s}_medium`), i(`s${s}_fine`), c(`s${s}_silt`)]),
      },
      ...range(n).map((s): Block => ({
        title: `Sample No. ${s}`,
        head: [[t('S. No.'), t('Test Parameter'), t('Method of Test'), t('Test Results'), t('Unit')]],
        rows: SOIL_TESTS.map(([no, name, method, unit, key]) => [t(no), t(name, { left: true }), t(method), i(`s${s}_${key}`), t(unit)]),
      })),
    ]
  },
}

const bitumenLoose: LabFormat = {
  key: 'bitumen_sample_dbm_bc',
  labels: { customer_details: 'Name of Dept.', reference_no: 'Reference letter No.', material_details: 'Material Identification', sampled_by: 'Sampled by /Condition' },
  counts: [{ key: 'n_rows', label: 'Samples', min: 1, max: 10 }],
  defaults: () => {
    const d: Values = { n_rows: '2' }
    for (const r of range(10)) Object.assign(d, { [`r${r}_name`]: r % 2 ? 'Bitumen Content (BC)' : 'Bitumen Content (DBM)', [`r${r}_method`]: 'IRC SP- 11' })
    return d
  },
  blocks: (v) => [{
    title: 'Test Results',
    head: [[t('S. No.'), t('Name of Test'), t('Date of Sampling'), t('Method of Test'), t('Bitumen Content'), t('Unit')]],
    rows: range(count(v, 'n_rows', 2)).map((r) => [t(String(r)), i(`r${r}_name`, { left: true }), i(`r${r}_date`), i(`r${r}_method`), i(`r${r}_result`), t('%')]),
  }],
  fromDetails: (rows) => {
    const v: Values = { n_rows: String(Math.max(1, rows.length)) }
    rows.forEach((r, k) => Object.assign(v, { [`r${k + 1}_name`]: str(r.name_of_test), [`r${k + 1}_date`]: str(r.date_of_sampling), [`r${k + 1}_method`]: str(r.mathod_of_test), [`r${k + 1}_result`]: str(r.result) }))
    return v
  },
}

const dbmDensity: LabFormat = {
  key: 'dbm_bc_density',
  labels: bitumenLoose.labels,
  counts: [{ key: 'n_rows', label: 'Cores', min: 1, max: 12 }],
  defaults: () => {
    const d: Values = { n_rows: '6', method: 'ASTM D 2726, IRC SP II' }
    for (const r of range(12)) d[`r${r}_name`] = r % 2 ? 'Bitumen Content (DBM)' : 'Bitumen Content (BC)'
    return d
  },
  blocks: (v) => {
    const n = count(v, 'n_rows', 6)
    return [{
      title: 'Test Results',
      head: [[t('S. No.'), t('Name of Test'), t('Thickness'), t('Date of Sampling'), t('Method of Test'), t('Density (%)'), t('Result'), t('Unit')]],
      rows: range(n).map((r) => [t(String(r)), i(`r${r}_name`, { left: true }), i(`r${r}_thick`), i(`r${r}_date`), ...(r === 1 ? [i('method', { rs: n })] : []), i(`r${r}_density`), i(`r${r}_result`), t('%')]),
    }]
  },
  fromDetails: (rows) => {
    const v: Values = { n_rows: String(Math.max(1, rows.length)) }
    rows.forEach((r, k) => Object.assign(v, { [`r${k + 1}_name`]: str(r.name_of_test), [`r${k + 1}_thick`]: str(r.thickness), [`r${k + 1}_date`]: str(r.date_of_sampling), [`r${k + 1}_density`]: str(r.density), [`r${k + 1}_result`]: str(r.result) }))
    if (rows[0] && str(rows[0].mathod_of_test)) v.method = str(rows[0].mathod_of_test)
    return v
  },
}

function coverFormat(key: string, title: string, groupText: string, location: string, observation: string, typeField: string): LabFormat {
  return {
    key,
    labels: { customer_details: 'Name of Dept.', reference_no: 'Reference letter No.', material_details: 'Material Identification', sampled_by: 'Sampled by/Condition' },
    counts: [{ key: 'n_rows', label: 'Covers', min: 1, max: 5 }],
    defaults: () => {
      const d: Values = { n_rows: '1', group: groupText }
      for (const r of range(5)) Object.assign(d, { [`r${r}_loc`]: location, [`r${r}_dia`]: '300', [`r${r}_obs`]: observation, [`r${r}_rem`]: 'OK' })
      return d
    },
    blocks: (v) => [{
      title,
      head: [[t('S. N'), t('Location'), t('Dia of Plat mm'), t('Date of Sample Collection'), t('Date of testing'), t('Applying of Load (KN)'), t('Observation'), t('Remark')]],
      rows: [
        [group('group', 8)],
        ...range(count(v, 'n_rows', 1)).map((r): Row => [t(String(r)), i(`r${r}_loc`), i(`r${r}_dia`), i(`r${r}_collect`), i(`r${r}_test`), i(`r${r}_load`), i(`r${r}_obs`), i(`r${r}_rem`)]),
      ],
    }],
    fromDetails: (rows) => {
      const v: Values = { n_rows: String(Math.max(1, rows.length)) }
      if (rows[0] && str(rows[0][typeField])) v.group = str(rows[0][typeField])
      rows.forEach((r, k) => Object.assign(v, {
        [`r${k + 1}_loc`]: str(r.location), [`r${k + 1}_dia`]: str(r.dia_of_plat), [`r${k + 1}_collect`]: str(r.date_of_sample_collection),
        [`r${k + 1}_test`]: str(r.date_of_testing), [`r${k + 1}_load`]: str(r.applying_of_load), [`r${k + 1}_obs`]: str(r.observation), [`r${k + 1}_rem`]: str(r.remark),
      }))
      return v
    },
  }
}
const ferro = coverFormat('fcdc_ferro_cover', 'TEST RESULTS (As per IS : 12592-2002, Ferro Cover)', 'Cover FCDC Class AA Loading (1000X800)', '', 'Cracks Not found', 'cover_type')
const manhole = coverFormat('main_hole_cover_hd20', 'TEST RESULTS (As per IS : 12592-2002, Manhole Cover)', 'Main Hole Ring & Cover HD', 'SFRC Mainhole cover', 'Crack Not found', 'hole_type')

export const LAB_FORMATS: Record<string, LabFormat> = Object.fromEntries(
  [cube, core, bricks, interlocking, kerb, sand, grit10, grit20, water, cement, acc, tile22, floorTile, soil, bitumenLoose, dbmDensity, ferro, manhole, gsb, wmm, bm2, m30].map((f) => [f.key, f]),
)

export const hasLabFormat = (key: string | undefined | null): key is string => !!key && key in LAB_FORMATS

/** Defaults ← older saved rows ← what the lab typed; plus the calculated cells */
export function effectiveValues(format: LabFormat, labData: Values, details: Array<Record<string, unknown>> = []): { values: Values; calc: Values } {
  const base = { ...ENV_DEFAULTS, ...format.defaults(labData) }
  const legacy = details.length && format.fromDetails ? stripEmpty(format.fromDetails(details)) : {}
  const values = { ...base, ...legacy, ...labData }
  return { values, calc: format.compute?.(values) ?? {} }
}

function stripEmpty(v: Values): Values {
  return Object.fromEntries(Object.entries(v).filter(([, x]) => x !== ''))
}

/** Header rows of a format, in print order */
export function headerRows(format: LabFormat | undefined): HeaderItem[] {
  if (format?.header) return format.header
  const order: StdField[] = ['customer_details', 'agency_name', 'reference_no', 'material_details', 'source_location', 'work_order_no', 'sample_date', 'sample_tested_date', 'sampled_by', 'environment']
  const rows: Array<{ key: string; label: string }> = []
  for (const key of order) {
    if (key === 'environment') for (const e of (format?.extras ?? []).filter((x) => x.after === 'sampled_by')) rows.push({ key: e.key, label: e.label })
    rows.push({ key, label: format?.labels?.[key] ?? DEFAULT_LABELS[key] })
    if (key !== 'sampled_by') for (const e of (format?.extras ?? []).filter((x) => x.after === key)) rows.push({ key: e.key, label: e.label })
  }
  return rows
}

/** CC Cube create: the legacy cube rows (Lab Reports list shows their dates) from the grid */
export function cubeSetsFromGrid(labData: Values): Array<Record<string, string>> {
  const { values, calc } = effectiveValues(cube, labData)
  return range(count(values, 'n_sets', 1)).map((s) => ({
    location: values[`s${s}_1_mark`] ?? '',
    size_of_cube: calc[`s${s}_1_area`]?.replace(/\.00$/, '') ?? '',
    date_of_casting: values[`s${s}_cast`] ?? '',
    date_of_testing: values[`s${s}_test`] ?? '',
    age_of_specimen: values.h_age ?? '',
    load_1: values[`s${s}_1_load`] ?? '', load_2: values[`s${s}_2_load`] ?? '', load_3: values[`s${s}_3_load`] ?? '',
    comp_strength_1: calc[`s${s}_1_str`] ?? '', comp_strength_2: calc[`s${s}_2_str`] ?? '', comp_strength_3: calc[`s${s}_3_str`] ?? '',
    avg_comp_strength: calc[`s${s}_avg`] ?? '',
    is_code_comp_strength: values[`s${s}_iscode`] ?? '',
  }))
}

