/**
 * Printable proposal on the Namotech letterhead (header, watermark, stamp and footer on every page),
 * laid out like the standard proposal: cover page, table of contents, numbered sections, fee table,
 * signature block. Pages are filled here (measured in the print window), so the table of contents
 * shows real page numbers. "Save as PDF" in the print dialog gives the PDF.
 */
import { feeTotal, formatFee, longDate, rupeesInWords, type ProposalInput } from './proposals'

const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] as string))

/** Escaped text with **bold** */
const inline = (text: string) => esc(text).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')

type Block =
  | { kind: 'h1'; html: string; anchor: number }
  | { kind: 'h2'; html: string; anchor: number }
  | { kind: 'label'; html: string }
  | { kind: 'p'; html: string }
  | { kind: 'li'; marker: string; html: string; last: boolean }
  | { kind: 'table'; head: string[]; rows: string[][]; widths?: string[]; foot?: string[]; cls?: string }
  | { kind: 'raw'; html: string; anchor?: number }

interface TocEntry { num: string; text: string; bold: boolean; anchor: number }

/** One section body (markup) → blocks */
function bodyBlocks(body: string, sectionNo: number, toc: TocEntry[], nextAnchor: () => number): Block[] {
  const blocks: Block[] = []
  const lines = body.replace(/\r/g, '').split('\n')
  let sub = 0
  let para: string[] = []
  const flushPara = () => {
    if (!para.length) return
    const text = para.join(' ').trim()
    para = []
    if (!text) return
    if (/^\*\*[^*]+\*\*:?$/.test(text)) blocks.push({ kind: 'label', html: inline(text) })
    else blocks.push({ kind: 'p', html: inline(text) })
  }

  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim()
    if (!t) { flushPara(); continue }

    const h2 = t.match(/^##+\s+(.+)$/)
    if (h2) {
      flushPara()
      sub += 1
      const num = `${sectionNo}.${sub}`
      const anchor = nextAnchor()
      toc.push({ num, text: h2[1].replace(/\*\*/g, ''), bold: false, anchor })
      blocks.push({ kind: 'h2', html: `${num} ${inline(h2[1].replace(/\*\*/g, ''))}`, anchor })
      continue
    }

    if (/^\|.*\|$/.test(t)) {
      flushPara()
      const rows: string[][] = []
      while (i < lines.length && /^\|.*\|$/.test(lines[i].trim())) {
        const cells = lines[i].trim().slice(1, -1).split('|').map((c) => c.trim())
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells.map(inline))
        i++
      }
      i--
      if (rows.length) {
        const cols = Math.max(...rows.map((r) => r.length))
        const pad = (r: string[]) => [...r, ...Array(cols - r.length).fill('')]
        blocks.push({ kind: 'table', head: pad(rows[0]), rows: rows.slice(1).map(pad) })
      }
      continue
    }

    const bullet = t.match(/^[-•*]\s+(.+)$/)
    const numbered = t.match(/^(\d{1,3})[.)]\s+(.+)$/)
    if (bullet || numbered) {
      flushPara()
      const next = (lines[i + 1] ?? '').trim()
      const last = !/^([-•*]|\d{1,3}[.)])\s+/.test(next)
      blocks.push({ kind: 'li', marker: bullet ? '•' : `${numbered![1]}.`, html: inline(bullet ? bullet[1] : numbered![2]), last })
      continue
    }

    para.push(t)
  }
  flushPara()
  return blocks
}

function feeBlocks(p: ProposalInput): Block[] {
  const total = feeTotal(p.fee_rows)
  const rows = p.fee_rows.filter((r) => r.description.trim() || r.amount)
  return [
    {
      kind: 'table',
      head: ['Sr. No.', 'Description', 'Amount'],
      widths: ['13%', '', '17%'],
      rows: rows.map((r, i) => [`<b>${i + 1}</b>`, inline(r.description), esc(formatFee(r.amount))]),
      foot: ['', '<b>TOTAL PROFESSIONAL FEE</b>', `<b>${esc(formatFee(total))}</b>`],
    },
    { kind: 'p', html: `<b>TOTAL: ${esc(formatFee(total))}</b>` },
    { kind: 'p', html: `<b>${esc(rupeesInWords(total))}</b>` },
    ...(p.fee_note.trim() ? [{ kind: 'p' as const, html: `<b>${inline(p.fee_note.trim())}</b>` }] : []),
  ]
}

function signatureHtml(p: ProposalInput): string {
  return `<div class="sign">
    <p><b>For NAMOTECH CONSULTANCY SERVICES LLP</b></p>
    <p><b>Authorized Signatory</b></p>
    ${p.signatory_name.trim() ? `<p><b>${esc(p.signatory_name)}</b></p>` : ''}
    <p>${p.signatory_designation.trim() ? `<b>${esc(p.signatory_designation)}</b><br>` : ''}Namotech Consultancy Services LLP<br>Jaipur, Rajasthan</p>
    <p><b>Website:</b> namotech.in</p>
  </div>`
}

function coverHtml(p: ProposalInput): string {
  const to = p.submitted_to.split('\n').map((l) => l.trim()).filter(Boolean)
  return `<div class="cover">
    <h1 class="cover-title">${esc(p.title)}</h1>
    ${p.project_name.trim() ? `<p class="cover-project"><b>${esc(p.project_name)}</b></p>` : ''}
    ${to.length ? `<p><b>Submitted To:</b><br><b>${esc(to[0])}</b>${to.slice(1).map((l) => `<br>${esc(l)}`).join('')}</p>` : ''}
    <p><b>Submitted By:</b><br><b>NAMOTECH CONSULTANCY SERVICES LLP</b></p>
    <p><i>Structural | Geotechnical | NDT | Infrastructure Consultancy</i><br>Jaipur, Rajasthan</p>
    <div class="cover-ref"><b>${esc(p.ref_no)}</b><span>${p.proposal_date ? `<b>Date:</b> ${esc(longDate(p.proposal_date))}` : ''}</span></div>
  </div>`
}

function blockHtml(b: Block): string {
  switch (b.kind) {
    case 'h1': return `<h2 class="h1" data-anchor="${b.anchor}">${b.html}</h2>`
    case 'h2': return `<h3 class="h2" data-anchor="${b.anchor}">${b.html}</h3>`
    case 'label': return `<p class="label">${b.html}</p>`
    case 'p': return `<p>${b.html}</p>`
    case 'li': return `<div class="li${b.last ? ' li-last' : ''}"><span class="mk">${b.marker}</span><span>${b.html}</span></div>`
    case 'raw': return b.anchor !== undefined ? `<div data-anchor="${b.anchor}">${b.html}</div>` : b.html
    case 'table': return tableHtml(b, b.rows, true)
  }
}

function tableHtml(b: Extract<Block, { kind: 'table' }>, rows: string[][], withFoot: boolean): string {
  const cols = b.widths ? `<colgroup>${b.head.map((_, i) => `<col${b.widths![i] ? ` style="width:${b.widths![i]}"` : ''}>`).join('')}</colgroup>` : ''
  const body = rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')
  const foot = withFoot && b.foot ? `<tr class="foot">${b.foot.map((c) => `<td>${c}</td>`).join('')}</tr>` : ''
  return `<div class="tbl"><table${b.cls ? ` class="${b.cls}"` : ''}>${cols}<thead><tr>${b.head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${body}${foot}</tbody></table></div>`
}

const CSS = `
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #e5e7eb; }
  body { font-family: 'Times New Roman', Times, serif; font-size: 15.5px; line-height: 1.42; color: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .toolbar { position: sticky; top: 0; z-index: 5; display: flex; gap: 10px; align-items: center; justify-content: center; padding: 10px; background: #1e293b; color: #fff; font: 14px system-ui, sans-serif; }
  .toolbar button { font: 600 14px system-ui, sans-serif; padding: 8px 18px; border-radius: 6px; border: 0; background: #2563eb; color: #fff; cursor: pointer; }
  .toolbar span { opacity: .8; }
  .page { position: relative; width: 210mm; height: 297mm; margin: 16px auto; background: #fff; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,.18); page-break-after: always; break-after: page; }
  .page:last-child { page-break-after: auto; break-after: auto; }
  .hdr { position: absolute; top: 0; left: 0; width: 100%; }
  .wm { position: absolute; left: 27%; top: 34%; width: 49%; opacity: 1; z-index: 0; }
  .ftr { position: absolute; bottom: 0; left: 0; width: 100%; }
  .stamp { position: absolute; left: 50%; transform: translateX(-62%); bottom: 84px; width: 143px; z-index: 2; }
  .pno { position: absolute; left: 96px; bottom: 112px; font: 12px 'Times New Roman', serif; color: #555; z-index: 2; }
  .content { position: absolute; top: 180px; left: 96px; right: 96px; height: 760px; z-index: 1; }
  #measure { position: absolute; left: -10000px; top: 0; width: calc(210mm - 192px); visibility: hidden; }
  p { margin: 0 0 13px; }
  .h1 { font-size: 15.5px; font-weight: bold; text-transform: uppercase; margin: 0; padding: 8px 0 12px; }
  .h2 { font-size: 15.5px; font-weight: bold; margin: 0; padding: 6px 0 12px; }
  .label { margin: 0 0 12px; }
  .li { display: flex; gap: 0; padding: 0 0 2px 22px; }
  .li .mk { flex: 0 0 26px; }
  .li-last { padding-bottom: 14px; }
  .tbl { padding: 0 0 16px; }
  table { width: 100%; border-collapse: collapse; background: transparent; }
  th, td { border: 1px solid #9a9a9a; padding: 5px 8px; text-align: left; vertical-align: top; }
  th { font-weight: bold; text-align: center; border-bottom: 3px double #777; }
  td:first-child { font-weight: bold; }
  .foot td { font-weight: bold; }
  .sign { padding-top: 28px; }
  .sign p { margin: 0 0 18px; }
  .cover-title { font-size: 16px; font-weight: bold; text-align: center; margin: 2px 24px 64px; line-height: 1.45; }
  .cover-project { margin-bottom: 24px; }
  .cover p { margin-bottom: 22px; }
  .cover-ref { display: flex; justify-content: space-between; padding-right: 40px; margin-top: 30px; }
  .toc-title { text-align: center; font-weight: bold; margin: 8px 0 18px; }
  .toc td:first-child { font-weight: bold; }
  .toc-table th, .toc-table td { padding: 2px 8px; line-height: 1.25; font-size: 15px; }
  .toc tr.b td { font-weight: bold; }
  @media print {
    html, body { background: #fff; }
    .toolbar { display: none; }
    .page { margin: 0; box-shadow: none; }
  }
`

/**
 * Opens the proposal in a new window, ready to print. Pass a window opened beforehand
 * (e.g. before loading the proposal) so the browser does not block the pop-up.
 */
export function openProposalPrint(p: ProposalInput, target?: Window | null): void {
  const w = target ?? window.open('', '_blank')
  if (!w) {
    window.alert('Allow pop-ups for this site to preview or print the proposal.')
    return
  }

  // ── Build blocks ──
  let anchors = 0
  const nextAnchor = () => anchors++
  const toc: TocEntry[] = []
  const blocks: Block[] = []
  p.sections.forEach((s, i) => {
    const no = i + 1
    const anchor = nextAnchor()
    const heading = s.heading.trim() || `Section ${no}`
    toc.push({ num: String(no), text: heading, bold: true, anchor })
    blocks.push({ kind: 'h1', html: `${no}. ${esc(heading)}`, anchor })
    blocks.push(...bodyBlocks(s.body, no, toc, nextAnchor))
    if (s.fee) blocks.push(...feeBlocks(p))
  })
  const signAnchor = nextAnchor()
  blocks.push({ kind: 'raw', html: signatureHtml(p), anchor: signAnchor })

  const origin = window.location.origin
  const img = (name: string) => `${origin}/letterhead/${name}`
  const chrome = (pageNo: number | null) => `
    <img class="hdr" src="${img('header.jpg')}" alt="">
    <img class="wm" src="${img('watermark.jpg')}" alt="">
    <img class="stamp" src="${img('stamp.png')}" alt="">
    <img class="ftr" src="${img('footer.jpg')}" alt="">
    ${pageNo ? `<div class="pno">Page ${pageNo}</div>` : ''}`

  const title = [p.ref_no, p.project_name || p.title].filter(Boolean).join(' – ') || 'Proposal'
  w.document.open()
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${CSS}</style></head>
    <body><div class="toolbar"><button type="button" onclick="window.print()">Print / Save as PDF</button><span>Choose “Save as PDF” as the printer to get a PDF. Paper: A4, margins: none.</span></div>
    <div id="pages"></div><div id="measure"></div></body></html>`)
  w.document.close()

  const doc = w.document
  const measure = doc.getElementById('measure')!
  const pagesEl = doc.getElementById('pages')!
  const LIMIT = 760

  const height = (html: string): number => {
    measure.innerHTML = `<div style="display:flow-root">${html}</div>`
    return (measure.firstElementChild as HTMLElement).getBoundingClientRect().height
  }

  /** Height of the part of a block that must follow a heading on the same page (a table: header + first row) */
  const leadHeight = (b: Block): number => b.kind === 'table'
    ? height(tableHtml(b, b.rows.slice(0, 1), b.rows.length <= 1))
    : Math.min(height(blockHtml(b)), 70)

  type Page = { html: string[]; used: number }
  /** Fills pages with blocks; returns pages and, for each anchor, its page index */
  const paginate = (list: Block[]): { pages: Page[]; anchorPage: Map<number, number> } => {
    const pages: Page[] = [{ html: [], used: 0 }]
    const anchorPage = new Map<number, number>()
    const cur = () => pages[pages.length - 1]
    const newPage = () => { pages.push({ html: [], used: 0 }) }
    const place = (html: string, h: number) => {
      if (cur().used > 0 && cur().used + h > LIMIT) newPage()
      cur().html.push(html)
      cur().used += h
    }

    list.forEach((b, i) => {
      if ('anchor' in b && b.anchor !== undefined) {
        // Headings and labels stay with the first lines of what follows them.
        const h = height(blockHtml(b))
        const next = list[i + 1]
        const keep = (b.kind === 'h1' || b.kind === 'h2') && next ? leadHeight(next) : 0
        if (cur().used > 0 && cur().used + h + keep > LIMIT) newPage()
        anchorPage.set(b.anchor, pages.length - 1)
        place(blockHtml(b), h)
        return
      }
      if (b.kind === 'label') {
        const h = height(blockHtml(b))
        const next = list[i + 1]
        const keep = next ? leadHeight(next) : 0
        if (cur().used > 0 && cur().used + h + keep > LIMIT) newPage()
        place(blockHtml(b), h)
        return
      }
      if (b.kind === 'table') {
        const full = tableHtml(b, b.rows, true)
        const fullH = height(full)
        if (cur().used + fullH <= LIMIT || fullH > LIMIT * 3) {
          place(full, fullH)
          return
        }
        // Split by rows, repeating the header row on each page.
        const rowsAll = [...b.rows]
        let start = 0
        while (start < rowsAll.length) {
          let end = start + 1
          while (end < rowsAll.length && cur().used + height(tableHtml(b, rowsAll.slice(start, end + 1), end + 1 === rowsAll.length)) <= LIMIT) end++
          const chunk = tableHtml(b, rowsAll.slice(start, end), end === rowsAll.length)
          const h = height(chunk)
          if (cur().used > 0 && cur().used + h > LIMIT) { newPage(); continue }
          cur().html.push(chunk)
          cur().used += h
          start = end
          if (start < rowsAll.length) newPage()
        }
        if (!rowsAll.length) place(full, fullH)
        return
      }
      place(blockHtml(b), height(blockHtml(b)))
    })
    return { pages, anchorPage }
  }

  const render = () => {
    const body = paginate(blocks)

    // Table of contents with the real page numbers (first content page = 1)
    const pg = (anchor: number) => String((body.anchorPage.get(anchor) ?? 0) + 1).padStart(2, '0')
    const tocRows = [
      ...toc.map((t) => [`${esc(t.num)}`, t.bold ? `<b>${esc(t.text)}</b>` : esc(t.text), pg(t.anchor)]),
      ['', '<b>Authorized Signatory</b>', pg(signAnchor)],
    ]
    const tocBlock: Block = { kind: 'table', head: ['Sr. No.', 'Particulars', 'Page No.'], widths: ['15%', '', '10%'], rows: tocRows, cls: 'toc-table' }
    const support = p.supporting_info.split('\n').map((l) => l.trim().replace(/^([-•]|\*(?!\*))\s*/, '')).filter(Boolean)
    const tocBlocks: Block[] = [
      { kind: 'raw', html: '<p class="toc-title">TABLE OF CONTENTS</p>' },
      tocBlock,
      ...(support.length ? [
        { kind: 'label' as const, html: '<b>Supporting Information</b>' },
        ...support.map((s, i) => ({ kind: 'li' as const, marker: '•', html: inline(s), last: i === support.length - 1 })),
      ] : []),
    ]
    const tocPages = paginate(tocBlocks).pages

    const pageHtml = (inner: string, pageNo: number | null, extra = '') => `<div class="page">${chrome(pageNo)}<div class="content${extra}">${inner}</div></div>`
    pagesEl.innerHTML = [
      pageHtml(coverHtml(p), null),
      ...tocPages.map((pgItem) => pageHtml(`<div class="toc">${pgItem.html.join('')}</div>`, null)),
      ...body.pages.map((pgItem, i) => pageHtml(pgItem.html.join(''), i + 1)),
    ].join('')
    measure.remove()
  }

  // Measure once the fonts are ready, so line wraps match the printout.
  const fonts = (doc as Document & { fonts?: FontFaceSet }).fonts
  if (fonts?.ready) void fonts.ready.then(render)
  else render()
}
