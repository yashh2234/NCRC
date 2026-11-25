/**
 * Printable lab report (TEST REPORT, Format No: NCS/TR/09), laid out like the lab's Excel formats.
 * Built from the same format definitions as the report screen, so the print shows exactly what was typed.
 * Printed by the browser (handles Hindi text; "Save as PDF" in the print dialog gives a PDF).
 */
import { EXCEL_TEMPLATE_OPTIONS, getTemplate, resolveExcelTemplateKey } from '../components/ExcelLabReportEditor'
import { LAB_FORMATS, effectiveValues, fullUlr, headerRows, type Block, type Cell, type Line, type Values } from './labFormats'
import { layoutBlocks, rowIds } from './labRows'
import { chartSvg } from './labCharts'
import qrcode from 'qrcode-generator'
import { DEFAULT_BEND, DEFAULT_REBEND, STEEL_DIAS, STEEL_GRADES, STEEL_MAX_SAMPLES, STEEL_STANDARD, steelKey, utsRequirementText } from './steel'

type Rec = Record<string, unknown>

const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] as string))
const str = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim())

/** dd/mm/yyyy for 2026-11-20 or 2026-11-20T…; other text (26/02/2024, "--") as typed */
function showDate(v: unknown): string {
  const s = str(v)
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return s
  return m[1] === '0000' ? '' : `${m[3]}/${m[2]}/${m[1]}`
}

/** Escaped text; '--' when empty; line breaks kept; ISO dates shown dd/mm/yyyy */
function text(v: unknown, dash = true): string {
  const s = showDate(v)
  return s ? esc(s).replace(/\n/g, '<br>') : dash ? '--' : ''
}

function lines(list: Line[] | undefined, values: Values, calc: Values): string {
  return (list ?? []).map((l) => (typeof l === 'function' ? l(values, calc) : l)).filter(Boolean).map((l) => `<p class="para">${esc(l)}</p>`).join('')
}

function table(block: Block, values: Values, calc: Values, ulrLabel = ''): string {
  const rows = block.rows ?? []
  const chart = block.chart?.(values, calc)
  const svg = chart ? chartSvg(chart) : ''
  const post = (svg ? `<div class="chart">${svg}</div>` : '') + lines(block.after, values, calc)
  const pre = (block.pageBreak ? `<div class="pg-break"></div><div class="pg-ulr">${ulrLabel}</div>` : '')
    + (block.title ? `<div class="blk-title">${esc(block.title)}</div>` : '') + lines(block.before, values, calc) + (block.heading ? `<div class="blk-head">${esc(block.heading)}</div>` : '')
  if (!rows.length) return pre + post
  const cols = (block.head?.[0] ?? rows[0] ?? []).reduce((n, c) => n + (c.cs ?? 1), 0)
  const cell = (c: Cell, tag: 'td' | 'th') => {
    const attrs = `${c.rs && c.rs > 1 ? ` rowspan="${c.rs}"` : ''}${c.cs && c.cs > 1 ? ` colspan="${c.cs}"` : ''}`
    if ('text' in c) {
      const cls = [c.left ? 'l' : '', c.bold ? 'b' : ''].filter(Boolean).join(' ')
      return `<${tag}${attrs}${cls ? ` class="${cls}"` : ''}>${esc(c.text)}</${tag}>`
    }
    if ('calc' in c) return `<td${attrs}>${text(calc[c.calc])}</td>`
    const cls = c.wide ? ' class="grp"' : c.left ? ' class="l"' : ''
    return `<td${attrs}${cls}>${c.prefix ? esc(c.prefix) : ''}${text(values[c.in], !c.prefix)}</td>`
  }
  let html = pre + '<table class="res">'
  for (const row of block.head ?? []) html += `<tr>${row.map((c) => cell(c, 'th')).join('')}</tr>`
  for (const row of rows) html += `<tr>${row.map((c) => cell(c, 'td')).join('')}</tr>`
  if (block.footKey && str(values[block.footKey])) html += `<tr><td colspan="${cols}" class="grp">${text(values[block.footKey])}</td></tr>`
  return html + '</table>' + post
}

function steelTables(key: string, lab: Values): string {
  const g = STEEL_GRADES[key]
  const brand = str(lab.steel_brand)
  const get = (i: number, f: string, d = '') => str(lab[steelKey(i, f)]) || d
  const rows: Cell[][] = []
  rowIds(lab, 'steel_count', 1).slice(0, STEEL_MAX_SAMPLES).forEach((i, at) => {
    const dia = get(i, 'dia')
    const spec = STEEL_DIAS[dia]
    rows.push([{ text: `(${String.fromCharCode(65 + at)}) ${dia ? `${dia}mm dia ` : ''}${g.label} ${brand ? `${brand} ` : ''}TMT Steel`, cs: 8, left: true, bold: true }])
    rows.push([{ text: '1' }, { text: `Sample${dia ? ` ${dia} mm dia` : ''}` }, { text: get(i, 'weight', '--') }, { text: get(i, 'uts', '--') }, { text: get(i, 'proof', '--') }, { text: get(i, 'elong', '--') },
      { text: get(i, 'bend', DEFAULT_BEND), rs: 3 }, { text: get(i, 'rebend', DEFAULT_REBEND), rs: 3 }])
    rows.push([{ text: '2' }, { text: 'As per IS Code' }, { text: spec ? String(spec.weight) : '--' }, { text: utsRequirementText(g), rs: 2 }, { text: `Not less than ${g.proofMin}`, rs: 2 }, { text: String(g.elongationMin), rs: 2 }])
    rows.push([{ text: '3' }, { text: 'Permissible Limit' }, { text: spec ? `=+/- ${spec.tolerance}%` : '--' }])
  })
  if (str(lab.steel_note)) rows.push([{ text: `*** ${str(lab.steel_note)}`, cs: 8, left: true, bold: true }])
  return table({
    title: `Test Results ( ${STEEL_STANDARD} )`,
    head: [['S.no', 'Particulars of Test', 'Weight/mtr. (kg)', 'Ultimate Tensile Stress (MPa)', '0.2% Proof Stress (MPa)', 'Elongation %', 'Bend test', 'Re-Bend Test'].map((h) => ({ text: h }))],
    rows,
  }, {}, {})
}

/** Formats without an Excel layout yet (mix designs): the screen's general table */
function generalTable(type: string, material: string, key: string, details: Rec[], lab: Values): string {
  const tpl = getTemplate(type, material, key)
  const rows = details.length ? details : [{}]
  return table({
    title: `${tpl.title} — ${tpl.standard}`,
    head: [[{ text: 'S. No.' }, ...tpl.fields.map((f) => ({ text: f.label }))]],
    rows: rows.map((r, n) => [{ text: String(n + 1) }, ...tpl.fields.map((f) => ({ text: showDate(r[f.key] ?? lab[f.key] ?? '') || '--' }))]),
  }, {}, {})
}

/** Where the QR on an approved report points: the public view on its own domain, not the software */
export const PUBLIC_REPORT_BASE = 'https://reports.namotech.in/r/'

/** QR code as crisp inline SVG (one path), sized in mm for print */
function qrSvg(textValue: string, sizeMm: number): string {
  const qr = qrcode(0, 'M')
  qr.addData(textValue)
  qr.make()
  const n = qr.getModuleCount(), m = 2, total = n + m * 2
  let d = ''
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + m} ${r + m}h1v1h-1z`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${sizeMm}mm" height="${sizeMm}mm" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="#000"/></svg>`
}

/** QR block for approved reports that have a public link; empty otherwise */
function qrBlock(report: Rec): string {
  const token = str(report.public_token)
  if (str(report.status) !== 'Complete' || !/^[A-Za-z0-9]{16,40}$/.test(token)) return ''
  return `<div class="qr">${qrSvg(PUBLIC_REPORT_BASE + token, 24)}<div>Scan to view report</div></div>`
}

const DRAFT_CSS = '.draft{position:fixed;left:0;right:0;top:42%;z-index:9;text-align:center;transform:rotate(-32deg);font-size:120pt;font-weight:800;letter-spacing:14px;color:rgba(200,0,0,.13);pointer-events:none}'

export function buildReportHtml(type: string, report: Rec, details: Rec[], opts: { qr?: boolean } = {}): string {
  const lab = (report.lab_data ?? {}) as Values
  const material = str(report.material_details)
  const key = str(lab._template) || resolveExcelTemplateKey(type, material)
  const format = LAB_FORMATS[key]
  const { values, calc } = format ? effectiveValues(format, lab, details) : { values: { h_temperature: '', h_humidity: '', ...lab }, calc: {} }

  // Header rows: the format's own labels and extra rows, numbered like the Excel
  const [envT, envH] = format?.envLabels ?? ['Temperature', 'Humidity']
  const header = headerRows(format).map(({ key: field, label, fallback, parts }, n) => {
    let value: string
    let cls = field === 'customer_details' || field === 'material_details' ? ' class="b"' : ''
    if (field === 'environment') {
      const temp = str(values.h_temperature), hum = str(values.h_humidity)
      const line = (name: string, v: string) => `<div class="env"><span>${esc(name)}</span><span>${esc(v)}</span></div>`
      // Two rows with a line in between, like the Excel
      if (format && (temp || hum)) return `<tr><th rowspan="2">${n + 1}. ${esc(label)}</th><td>${line(envT, temp)}</td></tr><tr><td>${line(envH, hum)}</td></tr>`
      value = text(report.environment_condition)
    } else if (parts) {
      // Machine | capacity | calibration date: boxes on one line
      const boxes = parts.filter((p) => str(values[p.key])).map((p) => `<span>${esc(p.prefix ?? '')}${esc(showDate(values[p.key]))}</span>`)
      value = boxes.length ? `<div class="parts">${boxes.join('')}</div>` : '--'
      if (boxes.length) cls = ' class="cells"'
    } else if (field.startsWith('h_')) {
      value = text(str(values[field]) || (fallback ? report[fallback] : ''))
    } else if (field === 'sample_date' || field === 'sample_tested_date' || field === 'dispatch_date') {
      value = text(showDate(report[field]) ? `Dt. ${showDate(report[field])}` : '')
    } else {
      value = text(report[field])
    }
    return `<tr><th>${n + 1}. ${esc(label)}</th><td${cls}>${value}</td></tr>`
  }).join('')

  // ULR No. (+ format suffix, e.g. /GSB-III); repeated at the top of each page of the mix designs
  const ulrDate = showDate(report.create_date) ? report.create_date : report.dispatch_date
  const ulrLabel = text(fullUlr(report.ulr_no, ulrDate)) + (format?.ulrSuffix && str(report.ulr_no) ? esc(format.ulrSuffix) : '')
  const results = format
    ? layoutBlocks(format, values).map((b) => table(b, values, calc, ulrLabel)).join('')
    : key in STEEL_GRADES ? steelTables(key, lab) : generalTable(type, material, key, details, lab)

  const date = showDate(report.dispatch_date) || showDate(report.create_date)
  const label = format?.name?.(values) ?? EXCEL_TEMPLATE_OPTIONS.find(([k]) => k === key)?.[1] ?? ''

  // Not approved yet: DRAFT across every page (fixed boxes repeat on each printed page)
  const draft = str(report.status) !== 'Complete'

  return `<!doctype html><html><head><meta charset="utf-8"><title>${draft ? 'DRAFT ' : ''}Test Report ${esc(report.uid_no)}${label ? ` - ${esc(label)}` : ''}</title><style>
@page{size:A4;margin:12mm 10mm}
*{box-sizing:border-box}
body{margin:0;color:#000;background:#fff;font-family:Arial,"Nirmala UI","Mangal","Noto Sans Devanagari",sans-serif;font-size:10.5pt;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.doc{border:1.5px solid #000;background:#fff}
table{width:100%;border-collapse:collapse}
td,th{border:1px solid #000;padding:3px 5px;vertical-align:middle;word-wrap:break-word}
.info th{width:38%;text-align:left;font-weight:bold}
.info .title{font-size:15pt;font-weight:bold;text-align:center;padding:6px;letter-spacing:.5px}
.meta .row{display:flex;justify-content:space-between;margin-top:2px}
.env{display:flex;gap:40px}.env span:first-child{min-width:90px}
.info td.cells{padding:0}.parts{display:flex;font-size:9pt}.parts span{padding:4px 5px;white-space:nowrap;border-left:1px solid #000}.parts span:first-child{border-left:0;flex:1}
.b{font-weight:bold}
.sec-title{font-weight:bold;text-align:center;padding:5px;font-size:10pt}
.subtitle{font-size:11pt;margin-top:2px}
.blk-title{font-weight:bold;text-align:center;padding:6px 5px 2px;font-size:10.5pt;border-top:1px solid #000}
.blk-head{font-weight:bold;padding:6px 5px 3px;font-size:9.5pt}
.para{margin:2px 6px;font-size:9pt;line-height:1.35}
.blk-head,.blk-title{break-after:avoid;page-break-after:avoid}
.pg-break{break-before:page;page-break-before:always;height:0}
.pg-ulr{text-align:right;font-weight:bold;font-size:9pt;padding:4px 6px}
.chart{text-align:center;padding:8px 6px;break-inside:avoid;page-break-inside:avoid}
@media screen{.pg-break{border-top:2px dashed #94a3b8;margin-top:8px}}
.res + .blk-head,.res + .para{border-top:0}
.res{font-size:9pt;page-break-inside:auto}.res tr{page-break-inside:avoid}
.res th{font-weight:bold;text-align:center}
.res td{text-align:center}.res td.l,.res th.l{text-align:left}.res td.grp{text-align:left;font-weight:bold}
.foot{padding:8px 6px 4px;page-break-inside:avoid}
.space{height:42px}
.sign{display:flex;justify-content:space-between;align-items:flex-end}
.foot-top{display:flex;justify-content:space-between;align-items:flex-end;gap:12px}
.qr{text-align:center;font-size:7pt;line-height:1.2}.qr svg{display:block;margin:0 auto 1px}
.notes{font-size:8pt;line-height:1.35;margin-top:8px}.notes p{margin:1px 0}
.end{text-align:center;font-weight:bold;font-size:9.5pt;margin-top:6px}
@media screen{body{background:#e5e7eb;padding:16px}.sheet{max-width:210mm;margin:0 auto;background:#fff;padding:10mm;box-shadow:0 2px 10px rgba(0,0,0,.15)}}
${draft ? DRAFT_CSS : ''}</style></head><body>${draft ? '<div class="draft" aria-hidden="true">DRAFT</div>' : ''}<div class="sheet"><div class="doc">
<table class="info">
<tr><td colspan="2" class="title">TEST REPORT${format?.subtitle ? `<div class="subtitle">${esc(format.subtitle(values))}</div>` : ''}</td></tr>
<tr><td colspan="2" class="meta">${format?.header ? '' : '<div class="b">Format No: NCS/TR/09</div>'}<div class="row"><span class="b">${ulrLabel}</span><span class="b">Date: ${esc(date)}</span></div></td></tr>
${header}
</table>
${results}
<div class="foot">
<div class="foot-top"><div>
<div class="b">For Namotech Consultancy Services LLP</div><div class="space"></div>
<div>Omendra Gupta - Managing Director</div>
<div class="sign"><span class="b">Authorized Signatory</span></div>
</div>${opts.qr === false ? '' : qrBlock(report)}</div>
<div class="notes"><p class="b">Note:-</p>
<p>1. ${esc(format?.note1 ?? 'Results related only to the sample (s) under test in as received condition and applicable parameter(s).')}</p>
<p>2. This Test Report shall not reproduce wholly or in part and cannot be used as evidence in the court of law without written approval of Namotech Consultancy LLP.</p>
<p>3. The sample will be stored up to one month from the date of issue of Test Report unless otherwise specified.</p></div>
<div class="end">***End of Report***</div>
</div></div></div></body></html>`
}

/** Opens the report print in a new tab and shows the print dialog */
export async function openReportPrint(load: () => Promise<{ report: unknown; details: unknown[] }>, type: string): Promise<void> {
  // Open the tab during the click so pop-up blockers allow it, then fill it
  const win = window.open('', '_blank')
  try {
    const { report, details } = await load()
    if (!win) throw new Error('Allow pop-ups for this site to print reports')
    win.document.open()
    win.document.write(buildReportHtml(type, report as Rec, details as Rec[]))
    win.document.close()
    win.focus()
    win.setTimeout(() => win.print(), 400)
  } catch (err) {
    win?.close()
    throw err
  }
}
