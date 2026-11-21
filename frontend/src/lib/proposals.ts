/**
 * Client proposals on the Namotech letterhead: data types, API calls, the light text markup
 * used in section bodies, and the "paste ready text" parser.
 *
 * Section body markup (also what the AI writes):
 *   blank line = new paragraph · "## Sub heading" = numbered sub-section (3.1, 3.2 …)
 *   **bold** · "- item" bullet · "1. item" numbered · "| a | b |" table row (first row = header)
 *   a line that is only **Label** = bold label
 */
import { request } from './api'

export interface ProposalSection {
  heading: string
  body: string
  fee: boolean
}

export interface FeeRow {
  description: string
  amount: number
}

export interface ProposalInput {
  ref_no: string
  proposal_date: string
  title: string
  project_name: string
  submitted_to: string
  sections: ProposalSection[]
  fee_rows: FeeRow[]
  fee_note: string
  supporting_info: string
  signatory_name: string
  signatory_designation: string
  brief: string
}

export interface Proposal extends ProposalInput {
  id: number
  total: number
  updated_at: string | null
  updated_by: string | null
}

export type ProposalSummary = Pick<Proposal, 'id' | 'ref_no' | 'proposal_date' | 'title' | 'project_name' | 'submitted_to' | 'total' | 'updated_at' | 'updated_by'>

export type ProposalDraft = Partial<Pick<ProposalInput, 'title' | 'project_name' | 'submitted_to' | 'ref_no' | 'proposal_date' | 'fee_note' | 'supporting_info'>> & {
  sections: ProposalSection[]
  fee_rows?: FeeRow[]
}

export const DEFAULT_FEE_NOTE = 'GST be charged extra.'

export function emptyProposal(): ProposalInput {
  return {
    ref_no: '',
    proposal_date: new Date().toISOString().slice(0, 10),
    title: 'PROPOSAL FOR ',
    project_name: '',
    submitted_to: '',
    sections: [],
    fee_rows: [],
    fee_note: DEFAULT_FEE_NOTE,
    supporting_info: '',
    signatory_name: 'Saksham Gupta',
    signatory_designation: 'Director / Partner',
    brief: '',
  }
}

export const proposalApi = {
  list: () => request<{ data: ProposalSummary[] }>('/proposals'),
  get: (id: number) => request<{ data: Proposal }>(`/proposals/${id}`),
  create: (data: ProposalInput) => request<{ data: Proposal }>('/proposals', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: ProposalInput) => request<{ data: Proposal }>(`/proposals/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id: number) => request<{ message: string }>(`/proposals/${id}`, { method: 'DELETE' }),
  generate: (brief: string) => request<{ data: ProposalDraft & { model?: string } }>('/proposals/generate', { method: 'POST', body: JSON.stringify({ brief }) }),
}

// ─── Money ───────────────────────────────────────────────────────────────

export function feeTotal(rows: FeeRow[]): number {
  return rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0)
}

/** ₹97,500/- (Indian digit grouping) */
export function formatFee(amount: number): string {
  const n = Number(amount) || 0
  const whole = Number.isInteger(Math.round(n * 100) / 100)
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })}/-`
}

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function below100(n: number): string {
  if (n < 20) return ONES[n]
  return TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : '')
}

function below1000(n: number): string {
  const h = Math.floor(n / 100)
  const rest = n % 100
  return [h ? `${ONES[h]} Hundred` : '', rest ? below100(rest) : ''].filter(Boolean).join(' ')
}

/** Indian numbering: 97500 → "Ninety-Seven Thousand Five Hundred" */
function integerWords(n: number): string {
  if (n === 0) return 'Zero'
  const crore = Math.floor(n / 10000000)
  const lakh = Math.floor((n % 10000000) / 100000)
  const thousand = Math.floor((n % 100000) / 1000)
  const rest = n % 1000
  return [
    crore ? `${integerWords(crore)} Crore` : '',
    lakh ? `${below100(lakh)} Lakh` : '',
    thousand ? `${below100(thousand)} Thousand` : '',
    rest ? below1000(rest) : '',
  ].filter(Boolean).join(' ')
}

/** "Rupees Ninety-Seven Thousand Five Hundred Only" */
export function rupeesInWords(amount: number): string {
  const n = Math.max(0, Number(amount) || 0)
  const rupees = Math.floor(n)
  const paise = Math.round((n - rupees) * 100)
  return `Rupees ${integerWords(rupees)}${paise ? ` and ${below100(paise)} Paise` : ''} Only`
}

// ─── Dates ───────────────────────────────────────────────────────────────

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** 2026-09-28 → "28 September 2026" */
export function longDate(iso: string): string {
  const m = (iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return iso || ''
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1] ?? ''} ${m[1]}`
}

/** "28 September 2026" / "28/09/2026" → 2026-09-28, or '' */
function parseDate(text: string): string {
  const t = text.trim()
  let m = t.match(/^(\d{1,2})\s+([A-Za-z]+)\s*,?\s+(\d{4})/)
  if (m) {
    const month = MONTHS.findIndex((name) => name.toLowerCase().startsWith(m![2].toLowerCase().slice(0, 3)))
    if (month >= 0) return `${m[3]}-${String(month + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`
  }
  m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  return ''
}

// ─── Headings ────────────────────────────────────────────────────────────

const SMALL_WORDS = new Set(['a', 'an', 'and', 'as', 'at', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'with', 'from', 'per'])
const ACRONYMS = new Set(['NDT', 'UPV', 'RCC', 'PCC', 'BOQ', 'GST', 'IS', 'NABL', 'ISO', 'IEC', 'PWD', 'NHAI', 'CBR', 'SBC', 'DLC', 'PQC', 'GSB', 'WMM', 'DBM', 'BC', 'SPT', 'DPR', 'MEP', 'CPWD', 'RFI', 'QA', 'QC', 'II', 'III', 'IV', 'LLP'])

/** "OBJECTIVE OF THE ASSIGNMENT" → "Objective of the Assignment"; mixed-case text is kept */
export function titleCase(text: string): string {
  const t = text.trim()
  if (/[a-z]/.test(t)) return t
  return t.split(/(\s+|[/–-])/).map((word, i) => {
    const bare = word.replace(/[^A-Za-z]/g, '')
    if (!bare) return word
    if (ACRONYMS.has(bare) || /\d/.test(word)) return word
    const lower = word.toLowerCase()
    if (i > 0 && SMALL_WORDS.has(bare.toLowerCase())) return lower
    return lower.replace(/[a-z]/, (c) => c.toUpperCase())
  }).join('')
}

/** Sub-headings ("## …") of a section body, in order */
export function subHeadings(body: string): string[] {
  return body.split('\n').map((l) => l.match(/^##\s+(.+)$/)?.[1]?.trim() ?? '').filter(Boolean)
}

// ─── Paste parser ────────────────────────────────────────────────────────

const LETTERHEAD_JUNK = [
  /\+91[\s-]?\d{5}\s?\d{5}/, /chandra nagar/i, /info@namotech/i, /www\.namotech\.in/i, /^engineering \| design/i,
  /^[•●]?\s*(laboratory testing|engineering consultancy|survey & investigation|safety audits & assessments)\s*$/i,
]
const BULLET = /^[•●▪◦‣■□➢➤✓✔*-]\s*/
const NUMBERED = /^(\d{1,2})[.)]\s+(.*)$/
const H1_NUMBERED = /^(\d{1,2})\.\s+(.{2,100})$/
const H2_NUMBERED = /^(\d{1,2})\.(\d{1,2})\.?\s+(.{2,120})$/

const isUpperHeading = (text: string) => /[A-Z]/.test(text) && !/[a-z]/.test(text) && !/[.;]$/.test(text.trim())

/**
 * Turns pasted proposal text (from Word, a PDF, or typed) into sections in the app's markup.
 * Numbered UPPER-CASE lines ("1. BACKGROUND") or "# Heading" start sections; "3.1 …" lines become
 * sub-headings; •/- lines become bullets; PDF line wraps are joined back into paragraphs.
 */
export function parsePastedProposal(raw: string): ProposalDraft {
  let lines = raw.replace(/\r/g, '').replace(/\u00a0/g, ' ').split('\n').map((l) => l.replace(/\s+$/, ''))
  lines = lines.filter((l) => !LETTERHEAD_JUNK.some((re) => re.test(l.trim())))
  const signAt = lines.findIndex((l) => /^\s*for\s+namotech/i.test(l))
  if (signAt >= 0) lines = lines.slice(0, signAt)
  lines = rebuildCellTables(joinLoneMarkers(lines))

  const draft: ProposalDraft = { sections: [] }
  const preamble: string[] = []
  let current: { heading: string; lines: string[] } | null = null
  const raws: Array<{ heading: string; lines: string[] }> = []

  for (const line of lines) {
    const t = line.trim()
    const md1 = t.match(/^#\s+(.+)$/)
    const h1 = t.match(H1_NUMBERED)
    if (md1 || (h1 && isUpperHeading(h1[2]))) {
      current = { heading: titleCase((md1 ? md1[1] : h1![2]).trim()), lines: [] }
      raws.push(current)
      continue
    }
    if (current) current.lines.push(line)
    else preamble.push(line)
  }

  readPreamble(preamble, draft)

  for (const section of raws) {
    if (/\bfee\b|\bfees\b|commercial|price/i.test(section.heading)) {
      const { body, rows, note } = readFeeSection(section.lines)
      draft.sections.push({ heading: section.heading, body, fee: true })
      if (rows.length) draft.fee_rows = rows
      if (note) draft.fee_note = note
    } else {
      draft.sections.push({ heading: section.heading, body: toMarkup(section.lines), fee: false })
    }
  }

  // Plain text with no recognisable headings: keep it as one section to split by hand.
  if (!draft.sections.length) {
    const body = toMarkup(preamble)
    if (body) draft.sections.push({ heading: 'Introduction', body, fee: false })
  }
  return draft
}

/** PDF copies often put a bullet / number on its own line: "•" then "RCC columns." → "• RCC columns." */
function joinLoneMarkers(lines: string[]): string[] {
  const out: string[] = []
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim()
    if (/^([•●▪◦‣■□➢➤✓✔*-]|\d{1,2}[.)])$/.test(t)) {
      let j = i + 1
      while (j < lines.length && !lines[j].trim()) j++
      if (j < lines.length) {
        out.push(`${t} ${lines[j].trim()}`)
        i = j
        continue
      }
    }
    out.push(lines[i])
  }
  return out
}

/**
 * PDF copies of a table put every cell on its own line ("Sr. No." / "Activity" / "Quantity" / "1" / …).
 * Rebuilds such tables as "| a | b | c |" rows: the header runs from "Sr. No." to the line "1",
 * then each row is one number line plus as many lines as the header has columns.
 */
function rebuildCellTables(lines: string[]): string[] {
  const out: string[] = []
  for (let i = 0; i < lines.length; i++) {
    if (!/^(sr|s)\.?\s*no\.?$/i.test(lines[i].trim())) { out.push(lines[i]); continue }
    const cells: string[] = []
    let j = i
    for (; j < lines.length && cells.length < 40; j++) {
      const t = lines[j].trim()
      if (!t) continue
      if (/^#|^\d{1,2}\.\s+[A-Z][A-Z\s&/,()-]+$/.test(t)) break // next section heading
      cells.push(t)
    }
    const head: string[] = []
    let k = 0
    while (k < cells.length && cells[k] !== '1' && head.length < 8) head.push(cells[k++])
    const cols = head.length
    if (cols < 2 || cells[k] !== '1') { out.push(lines[i]); continue }
    const rows: string[][] = []
    let used = k
    while (used + cols <= cells.length && /^\d{1,2}$/.test(cells[used]) && Number(cells[used]) === rows.length + 1) {
      rows.push(cells.slice(used, used + cols))
      used += cols
    }
    if (!rows.length) { out.push(lines[i]); continue }
    out.push(`| ${head.join(' | ')} |`, ...rows.map((r) => `| ${r.join(' | ')} |`), '')
    // Skip the source lines that were consumed (count non-blank lines up to `used` cells).
    let seen = 0
    while (i < lines.length && seen < used) { if (lines[i].trim()) seen++; i++ }
    i--
  }
  return out
}

/** Cover-page details and annexures from the text before the first section. */
function readPreamble(lines: string[], draft: ProposalDraft) {
  const text = lines.map((l) => l.trim())
  const ref = text.join('\n').match(/\b(NCS\/\d{4}\/[\w-]+)/i)
  if (ref) draft.ref_no = ref[1]
  const dateLine = text.find((l) => /date\s*:/i.test(l))
  if (dateLine) {
    const iso = parseDate(dateLine.replace(/^.*date\s*:\s*/i, ''))
    if (iso) draft.proposal_date = iso
  }

  const titleAt = text.findIndex((l) => /^proposal\b/i.test(l))
  let after = titleAt
  if (titleAt >= 0) {
    const parts = [text[titleAt]]
    // The cover title wraps onto the next line when the line is long or ends mid-phrase ("… &").
    const wraps = (l: string) => l.length >= 50 || /([&,–-]|\b(AND|OF|FOR|THE|TO|IN))$/i.test(l)
    while (wraps(text[after]) && text[after + 1] && !/^submitted/i.test(text[after + 1]) && parts.length < 4) {
      parts.push(text[++after])
    }
    draft.title = parts.join(' ').toUpperCase()
  }

  const toAt = text.findIndex((l) => /^submitted to\s*:?/i.test(l))
  if (toAt >= 0) {
    const block: string[] = []
    const inline = text[toAt].replace(/^submitted to\s*:?\s*/i, '')
    if (inline) block.push(inline)
    for (let i = toAt + 1; i < text.length && text[i] && !/^submitted by/i.test(text[i]); i++) block.push(text[i])
    if (block.length) draft.submitted_to = block.join('\n')
    // Project / site name: the upper-case line between the title and "Submitted To".
    const project = text.slice(Math.max(after + 1, 0), toAt).filter((l) => l && isUpperHeading(l) && !/table of contents/i.test(l))
    if (project.length) draft.project_name = project[project.length - 1]
  }

  const annexures = text.filter((l) => /^[•●-]?\s*annexure\b/i.test(l)).map((l) => {
    const clean = l.replace(BULLET, '')
    const m = clean.match(/^(annexure\s+[\w-]+\s*:)\s*(.*)$/i)
    return m ? `**${m[1]}** ${m[2]}` : clean
  })
  if (annexures.length) draft.supporting_info = annexures.join('\n')
}

function readFeeSection(lines: string[]): { body: string; rows: FeeRow[]; note: string } {
  const rows: FeeRow[] = []
  const notes: string[] = []
  const rest: string[] = []
  for (const line of lines) {
    const t = line.trim()
    const cells = t.includes('\t') ? t.split('\t').map((c) => c.trim()).filter(Boolean)
      : /^\|.*\|$/.test(t) ? t.slice(1, -1).split('|').map((c) => c.trim()).filter(Boolean) : null
    const amountText = (s: string) => Number(s.replace(/[^\d.]/g, '').replace(/\.$/, '')) || 0
    const row = t.match(/^(\d{1,2})[.)]?\s+(.+?)\s+(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d+)?)\s*\/?-?\s*$/i)
    if (/total|^rupees\b.*only\.?$|^\|?\s*(sr|s)\.?\s*no/i.test(t)) continue
    if (/^(₹|rs\.?|inr)\s*[\d,]+(\.\d+)?\s*\/?-?$/i.test(t)) continue // a lone amount is the total
    if (cells && cells.length >= 3 && /^\d{1,2}$/.test(cells[0]) && /\d/.test(cells[cells.length - 1])) {
      rows.push({ description: cells.slice(1, -1).join(' '), amount: amountText(cells[cells.length - 1]) })
    } else if (row) {
      rows.push({ description: row[2].trim(), amount: amountText(row[3]) })
    } else if (/\bgst\b|\btax(es)?\b|payment/i.test(t)) {
      notes.push(t)
    } else {
      rest.push(line)
    }
  }
  return { body: toMarkup(rest), rows, note: notes.join(' ') }
}

/** Plain pasted lines → section body markup */
function toMarkup(lines: string[]): string {
  type Item = { kind: 'p' | 'li' | 'ol' | 'h2' | 'row'; text: string; num?: string; lastLen: number }
  const items: Item[] = []
  let open: Item | null = null

  for (const line of lines) {
    const t = line.trim()
    if (!t) { open = null; continue }

    const h2 = t.match(H2_NUMBERED)
    const md2 = t.match(/^##\s+(.+)$/)
    if (md2 || (h2 && !/[.;,]$/.test(h2[3]) && h2[3].length <= 100)) {
      items.push({ kind: 'h2', text: (md2 ? md2[1] : h2![3]).trim(), lastLen: 0 })
      open = null
      continue
    }
    if (t.includes('\t')) {
      items.push({ kind: 'row', text: `| ${t.split('\t').map((c) => c.trim()).join(' | ')} |`, lastLen: 0 })
      open = null
      continue
    }
    if (/^\|.*\|$/.test(t)) { items.push({ kind: 'row', text: t, lastLen: 0 }); open = null; continue }
    if (BULLET.test(t) && t.replace(BULLET, '')) {
      open = { kind: 'li', text: t.replace(BULLET, ''), lastLen: t.length }
      items.push(open)
      continue
    }
    const num = t.match(NUMBERED)
    if (num) {
      open = { kind: 'ol', num: num[1], text: num[2], lastLen: t.length }
      items.push(open)
      continue
    }
    // A wrapped PDF/Word line continues the previous one when that line was long and did not end a sentence.
    if (open && open.lastLen >= 55 && !/[.:;?!]$/.test(open.text)) {
      open.text += ` ${t}`
      open.lastLen = t.length
      continue
    }
    open = { kind: 'p', text: t, lastLen: t.length }
    items.push(open)
  }

  const out: string[] = []
  items.forEach((item, i) => {
    const prev = items[i - 1]
    const sameBlock = prev && ((prev.kind === 'li' || prev.kind === 'ol') && (item.kind === 'li' || item.kind === 'ol') || prev.kind === 'row' && item.kind === 'row')
    if (i > 0 && !sameBlock) out.push('')
    if (item.kind === 'h2') out.push(`## ${item.text}`)
    else if (item.kind === 'li') out.push(`- ${item.text}`)
    else if (item.kind === 'ol') out.push(`${item.num}. ${item.text}`)
    else if (item.kind === 'row') out.push(item.text)
    // A short line on its own with no full stop is a label ("Stage 1 – Site Reconnaissance").
    else if (item.text.length <= 70 && !/[.:;?!,]$/.test(item.text) && !/\*\*/.test(item.text)) out.push(`**${item.text}**`)
    else out.push(item.text)
  })
  return out.join('\n').trim()
}
