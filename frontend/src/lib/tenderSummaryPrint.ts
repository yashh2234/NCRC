/**
 * Printable tender summary on as many A4 pages as it needs, in its own window (the popup on screen scrolls, so
 * printing it would stop at its height). paginate() puts it on real A4 pages with their own margins, so the margin
 * setting of the print dialog cannot cut anything; list items and table rows are not cut in two.
 */
import { esc } from './billPrint'
import { daysLeft, formatClosing, formatDate, formatTime, isClosed, type SavedTenderSummary, type Tender, type TenderSummary } from './tenders'
import { addPrintBackBar } from './printBack'

const CSS = `
@page { size: A4; margin: 0; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
html, body { margin: 0; background: #fff; }
body { font: 9.5pt/1.4 Arial, Helvetica, sans-serif; color: #1e293b; }
.toolbar { display: flex; align-items: center; gap: 12px; padding: 10px 16px; background: #0f172a; color: #cbd5e1; font-size: 13px; }
.toolbar button { padding: 8px 16px; border: 0; border-radius: 6px; background: #2563eb; color: #fff; font-size: 13px; font-weight: 600; cursor: pointer; }
.page { position: relative; width: 210mm; height: 297mm; overflow: hidden; background: #fff; }
.page-body { position: absolute; left: 13mm; right: 13mm; top: 13mm; bottom: 18mm; }
.page-body > :first-child { margin-top: 0; }
.page-foot { position: absolute; left: 13mm; right: 13mm; bottom: 8mm; text-align: right; padding-top: 1.5mm; border-top: .2mm solid #cbd5e1; font-size: 7.5pt; color: #64748b; }
#src { position: absolute; left: -10000px; top: 0; width: 184mm; visibility: hidden; }
@media screen { body { background: #e2e8f0; } .page { margin: 16px auto; box-shadow: 0 2px 14px rgba(0, 0, 0, .15); } }
@media print { .toolbar { display: none; } .page + .page { break-before: page; } }

.head { display: flex; align-items: center; justify-content: space-between; gap: 8mm; padding-bottom: 3.5mm; border-bottom: .6mm solid #1e3a8a; }
.head img { height: 15mm; max-width: 60mm; object-fit: contain; }
.head div { text-align: right; }
.head h1 { margin: 0; font-size: 16pt; letter-spacing: .5px; color: #1e3a8a; }
.head p { margin: .5mm 0 0; font-size: 9pt; color: #475569; }
h2.title { margin: 5mm 0 1.5mm; font-size: 12.5pt; line-height: 1.35; color: #0f172a; }
.overview { margin: 0 0 4mm; }
.from { margin: 0 0 4mm; font-size: 8.5pt; color: #64748b; }

table { width: 100%; border-collapse: collapse; }
td, th { padding: 1.2mm 2.5mm; border: .25mm solid #cbd5e1; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
tr { break-inside: avoid; }
.facts th { width: 20%; background: #f1f5f9; font-size: 8.8pt; font-weight: 600; color: #475569; }
.facts td { font-weight: 600; color: #0f172a; }
.facts td.half { width: 30%; }
.dates thead th { background: #1e3a8a; color: #fff; font-size: 8.8pt; }
.dates .when { width: 30%; font-weight: 600; }
.dates .left { width: 18%; }
.urgent { font-weight: 700; color: #b91c1c; }

h3 { margin: 4.2mm 0 1.5mm; padding-bottom: 1mm; border-bottom: .3mm solid #cbd5e1; font-size: 11pt; color: #1e3a8a; break-after: avoid; }
h3 small { font-size: 8.5pt; font-weight: 600; color: #64748b; }
ul { margin: 0; padding-left: 5.5mm; }
li { margin: 0 0 1.1mm; break-inside: avoid; orphans: 2; widows: 2; }
.box { margin: 4mm 0; padding: 2.5mm 4mm 2mm; border: .3mm solid; border-left-width: 1.4mm; border-radius: 1.5mm; -webkit-box-decoration-break: clone; box-decoration-break: clone; }
.box h3 { margin: 0 0 1.5mm; padding: 0; border: 0; color: inherit; }
.box p { margin: 0 0 1.5mm; font-size: 9pt; }
.watch { border-color: #f59e0b; background: #fffbeb; color: #78350f; }
.conflicts { border-color: #dc2626; background: #fef2f2; color: #7f1d1d; }

.checks td { border-left: 0; border-right: 0; }
.checks td.no { width: 10mm; padding-left: 0; text-align: right; white-space: nowrap; color: #64748b; }
.checks tr:first-child td { border-top: 0; }
.checks td.tick { width: 9mm; padding-left: 1mm; }
.checks td.who { width: 40mm; font-size: 8.3pt; color: #475569; }
.checks i { display: block; width: 4mm; height: 4mm; margin-top: .3mm; border: .4mm solid #475569; border-radius: .6mm; }
.checks i.on { position: relative; border-color: #15803d; background: #15803d; }
.checks i.on::after { content: ''; position: absolute; left: 1mm; top: .1mm; width: 1.1mm; height: 2.2mm; border: solid #fff; border-width: 0 .5mm .5mm 0; transform: rotate(45deg); }
`

const FACTS: Array<[keyof TenderSummary, string]> = [
  ['tender_id', 'Tender ID'], ['department', 'Department / Client'], ['location', 'Location'], ['portal', 'Portal'],
  ['tender_value', 'Tender value'], ['emd', 'EMD'], ['emd_exemption', 'EMD exemption'], ['tender_fee', 'Tender fee'],
  ['contract_period', 'Contract period'], ['bid_validity', 'Bid validity'], ['contact', 'Contact'],
]

const list = (items: string[]) => `<ul>${items.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>`

const section = (title: string, items: string[]) => (items?.length ? `<h3>${title} <small>(${items.length})</small></h3>${list(items)}` : '')

function facts(s: TenderSummary): string {
  const known = FACTS.filter(([key]) => s[key])
  // Short ones two in a row, long ones over the whole width
  const rows: string[] = []
  let waiting = ''
  for (const [key, label] of known) {
    const value = String(s[key])
    const cells = (attrs: string) => `<th>${label}</th><td ${attrs}>${esc(value)}</td>`
    if (value.length > 60) rows.push(`<tr>${cells('colspan="3"')}</tr>`)
    else if (waiting) {
      rows.push(`<tr>${waiting}${cells('class="half"')}</tr>`)
      waiting = ''
    } else waiting = cells('class="half"')
  }
  if (waiting) rows.push(`<tr>${waiting.replace('class="half"', 'colspan="3"')}</tr>`)
  return rows.length ? `<table class="facts"><tbody>${rows.join('')}</tbody></table>` : ''
}

function dates(s: TenderSummary): string {
  if (!s.dates.length) return ''
  const rows = s.dates.map((d) => {
    const full = /^\d{4}-\d{2}-\d{2}$/.test(d.date)
    const left = full ? daysLeft(d.date) : null
    const passed = full && (left ?? 0) <= 0 && isClosed({ closingDate: d.date, closingTime: /^\d{2}:\d{2}$/.test(d.time) ? d.time : '' })
    const text = left === null ? '' : passed ? 'Passed' : left === 0 ? 'Today' : `${left} day${left === 1 ? '' : 's'} left`
    return `<tr><td>${esc(d.label || '-')}</td><td class="when">${esc(full ? formatDate(d.date) : d.date || '-')}${d.time ? `, ${esc(formatTime(d.time))}` : ''}</td><td class="left${left !== null && !passed && left <= 4 ? ' urgent' : ''}">${text}</td></tr>`
  }).join('')
  return `<h3>Key dates</h3><table class="dates"><thead><tr><th>Event</th><th>Date and time</th><th>Days left</th></tr></thead><tbody>${rows}</tbody></table>`
}

function checklist(saved: SavedTenderSummary): string {
  const items = saved.summary.documents_required
  if (!items.length) return ''
  const done = saved.checks.filter(Boolean).length
  const rows = items.map((item, i) => {
    const check = saved.checks[i]
    const when = check?.at ? new Date(check.at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : ''
    return `<tr><td class="no">${i + 1}.</td><td class="tick"><i${check ? ' class="on"' : ''}></i></td><td>${esc(item)}</td>${done ? `<td class="who">${check ? esc([check.by ?? '', when].filter(Boolean).join(', ')) : ''}</td>` : ''}</tr>`
  }).join('')
  return `<h3>Documents required <small>(${done} of ${items.length} ready)</small></h3><table class="checks"><tbody>${rows}</tbody></table>`
}

/**
 * Runs inside the print window (its source text is written there), so it must not use anything outside itself.
 * Every block is taken apart into rows / points with the tables, lists and boxes they are in, and these are opened
 * again on the next page when they go on there.
 */
function paginate(): void {
  const src = document.getElementById('src') as HTMLElement
  const out = document.getElementById('out') as HTMLElement
  const template = document.getElementById('page-template') as HTMLTemplateElement

  interface Unit { node: HTMLElement; chain: HTMLElement[]; heading: boolean }
  const units: Unit[] = []
  const collect = (el: HTMLElement, chain: HTMLElement[]) => {
    if (el.tagName === 'TABLE') Array.from(el.querySelectorAll<HTMLElement>('tbody > tr')).forEach((row) => units.push({ node: row, chain: [...chain, el], heading: false }))
    else if (el.tagName === 'UL' || el.classList.contains('box')) Array.from(el.children).forEach((c) => (el.tagName === 'UL' ? units.push({ node: c as HTMLElement, chain: [...chain, el], heading: false }) : collect(c as HTMLElement, [...chain, el])))
    else units.push({ node: el, chain, heading: el.tagName === 'H3' || (el.tagName === 'P' && chain.length > 0) })
  }
  Array.from(src.children).forEach((c) => collect(c as HTMLElement, []))

  let body: HTMLElement
  /** What is open at the end of the page: the original element and its part on this page */
  let open: { from: HTMLElement; shell: HTMLElement }[] = []
  const newPage = () => {
    const page = (template.content.cloneNode(true) as DocumentFragment).firstElementChild as HTMLElement
    out.appendChild(page)
    body = page.querySelector('.page-body') as HTMLElement
    open = []
  }
  const inner = (shell: HTMLElement) => (shell.tagName === 'TABLE' ? (shell.querySelector('tbody') as HTMLElement) : shell)
  const fits = () => {
    const last = body.lastElementChild
    return !last || last.getBoundingClientRect().bottom <= body.getBoundingClientRect().bottom + 0.5
  }
  const put = (u: Unit) => {
    let same = 0
    while (same < open.length && same < u.chain.length && open[same].from === u.chain[same]) same += 1
    open = open.slice(0, same)
    let parent = same ? inner(open[same - 1].shell) : body
    for (const el of u.chain.slice(same)) {
      const shell = el.cloneNode(el.tagName === 'TABLE') as HTMLElement
      if (el.tagName === 'TABLE') inner(shell).innerHTML = ''
      parent.appendChild(shell)
      open.push({ from: el, shell })
      parent = inner(shell)
    }
    parent.appendChild(u.node)
  }
  const take = (u: Unit) => {
    let parent = u.node.parentElement
    u.node.remove()
    // Boxes, lists and tables that are empty now
    while (parent && parent !== body) {
      const up: HTMLElement | null = parent.parentElement
      const shell = parent.tagName === 'TBODY' ? (parent.parentElement as HTMLElement) : parent
      const empty = !parent.children.length
      const next = shell === parent ? up : shell.parentElement
      if (!empty) break
      shell.remove()
      open = open.filter((o) => o.shell !== shell)
      parent = next
    }
  }

  newPage()
  let onPage: Unit[] = []
  units.forEach((u) => {
    put(u)
    if (fits() || !onPage.length) { onPage.push(u); return }
    // Headings go along with what is under them
    const moved = [u]
    take(u)
    while (onPage.length > 1 && onPage[onPage.length - 1].heading) {
      const heading = onPage.pop() as Unit
      take(heading)
      moved.unshift(heading)
    }
    newPage()
    onPage = []
    moved.forEach((m) => { put(m); onPage.push(m) })
  })
  Array.from(out.children).forEach((page, i) => {
    (page.querySelector('.page-no') as HTMLElement).textContent = `Page ${i + 1} of ${out.children.length}`
  })
  src.remove()
}

/** Call it straight from the click, or the pop-up blocker stops it. */
export function printTenderSummary(tender: Tender, saved: SavedTenderSummary): void {
  const w = window.open('', '_blank')
  if (!w) {
    window.alert('Allow pop-ups for this site to print the summary.')
    return
  }
  const s = saved.summary
  const analysed = saved.analysed_at ? new Date(saved.analysed_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : ''
  const from = [`From ${saved.file || 'tender document'}`, analysed && `analysed ${analysed}`, saved.analysed_by && `by ${saved.analysed_by}`].filter(Boolean).join(' · ')

  w.document.write(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(`Tender summary ${tender.srNo} ${tender.tenderId}`.replace(/[\\/:*?"<>|]+/g, '-'))}</title><style>${CSS}</style></head><body>
    <div class="toolbar"><button type="button" onclick="window.print()">Print / Save as PDF</button><span>Choose “Save as PDF” as the printer to get a PDF. Paper: A4.</span></div>
    <div id="src">
      <div class="head">
        <img src="${window.location.origin}/letterhead/logo-ncs.svg" alt="" onerror="this.remove()">
        <div><h1>TENDER SUMMARY</h1><p><b>${esc(tender.srNo)}</b>${tender.closingDate ? ` &nbsp;·&nbsp; Closing: <b>${esc(formatClosing(tender))}</b>` : ''}</p></div>
      </div>
      ${s.title || tender.title ? `<h2 class="title">${esc(s.title || tender.title)}</h2>` : ''}
      <p class="from">${esc(from)}</p>
      ${s.overview ? `<p class="overview">${esc(s.overview)}</p>` : ''}
      ${facts(s)}
      ${s.conflicts?.length ? `<div class="box conflicts"><h3>Conflicts in the document (${s.conflicts.length})</h3><p>The tender says different things in different places: get these clarified (pre-bid query) before bidding.</p>${list(s.conflicts)}</div>` : ''}
      ${s.points_to_watch.length ? `<div class="box watch"><h3>Points to watch</h3>${list(s.points_to_watch)}</div>` : ''}
      ${dates(s)}
      ${section('Eligibility criteria', s.eligibility)}
      ${checklist(saved)}
      ${section('Scope of work', s.scope_of_work)}
      ${section('Technical requirements', s.technical_requirements)}
      ${section('Payment terms', s.payment_terms)}
      ${section('Penalties and securities', s.penalties)}
    </div>
    <div id="out"></div>
    <template id="page-template"><div class="page"><div class="page-body"></div><div class="page-foot"><span class="page-no"></span></div></div></template>
    <script>
      var paginate = ${paginate.toString()};
      window.addEventListener('load', function () { paginate(); setTimeout(function () { window.print() }, 200) });
    </script>
  </body></html>`)
  w.document.close()
  addPrintBackBar(w)
}
