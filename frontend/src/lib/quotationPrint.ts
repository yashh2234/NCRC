/**
 * Printable NCS LLP / NCRC Pvt Ltd quotation in the Namotech bill design, over as many A4 pages as it needs.
 * The document is first laid out in one long strip, then paginate() moves it onto real A4 pages, so every
 * page has the brand bar, the footer with "Page 1 of 2", and (from page 2) the quotation no. at the top.
 * With / without sign is chosen before opening; the print dialog opens by itself.
 */
import { BILL_CSS, esc, fmtQty } from './billPrint'
import { COMPANIES, SERVICES, dotDate, money2 } from './bills'
import { calcQuotation, itemNumbers, itemUsed, quotationItemAmount, quotationLines, validityText, type QuotationInput, type QuotationSection } from './quotations'

const CSS = `
.page { display: block; padding: 0; }
.page-body { position: absolute; left: 12mm; right: 12mm; top: 11mm; bottom: 24mm; }
.page.cont .page-body { top: 23mm; }
.page-head { display: none; }
.page.cont .page-head { position: absolute; left: 12mm; right: 12mm; top: 10mm; display: flex; justify-content: space-between; align-items: baseline;
  padding-bottom: 2mm; border-bottom: 1px solid var(--line); font-size: 9pt; color: #3F4B5A; }
.page-head b { color: var(--brand); font-size: 10pt; }
.page .footer { position: absolute; left: 12mm; right: 12mm; bottom: 7mm; margin: 0; }
.page .footer .meta { display: flex; justify-content: space-between; text-align: left; }
.page + .page { break-before: page; }
#src { position: absolute; left: 0; top: 0; width: 186mm; visibility: hidden; }

.company { flex: 1; min-width: 0; }
.company-name { font-size: 13pt; white-space: nowrap; }
.company-ids { display: flex; flex-wrap: wrap; gap: .5mm 5mm; }
.company-ids span { white-space: nowrap; }
.company-ids span + span { margin-left: 0; }
.doc-title { display: flex; flex-direction: column; align-items: flex-end; }
.doc-title h1 { font-size: 20pt; letter-spacing: 2px; }

.quote-meta { display: grid; grid-template-columns: 1.15fr 1fr; gap: 7mm; }
.quote-meta.single { grid-template-columns: 1fr; }
.subject { margin-top: 4.5mm; display: flex; gap: 4mm; align-items: baseline; background: var(--tint); border-left: 3px solid var(--accent);
  border-radius: 0 2mm 2mm 0; padding: 2.6mm 4mm; font-size: 10.3pt; }
.subject b { color: var(--brand); text-transform: uppercase; letter-spacing: 1px; font-size: 8pt; flex: none; }
.subject span { font-weight: 600; }
.intro { margin-top: 4mm; color: #3F4B5A; white-space: pre-line; }

.items-wrap { display: block; min-height: 0; flex: none; margin-top: 4.5mm; }
.cont .page-body > .items-wrap:first-child { margin-top: 0; }
table.items { height: auto; }
table.items td, table.items thead th { height: auto; }
table.items td { padding: 2.4mm 2.5mm; overflow-wrap: anywhere; }
table.items td.num, table.items td.ctr { overflow-wrap: normal; }
table.items .uom { width: 16mm; }
table.items thead tr { background: var(--brand); }
/* Keeps the space under the line also in the PDF for mail */
.head-block { display: flow-root; }
table.items .desc-main { white-space: pre-line; }
table.items .desc-sub { font-size: 8.4pt; line-height: 1.38; }
table.items .desc-sub + .desc-main, table.items .desc-main + .desc-main { margin-top: 1.4mm; }
table.items tr.head td { background: var(--tint); color: var(--brand); font-weight: 700; font-size: 10pt; border-right: 0; break-inside: avoid; }
table.items tr.subhead td { background: var(--tint-2); font-weight: 700; border-right: 0; }
table.items tr.head td, table.items tr.subhead td { padding-top: 1.8mm; padding-bottom: 1.8mm; white-space: pre-line; }
table.items tr.subhead td.ctr { font-size: 8.8pt; padding-left: 0; padding-right: 0; white-space: nowrap; }
table.items .incl { color: #6A7889; font-style: italic; }

.summary { margin-top: 5mm; }
.totals tr.sub td { font-weight: 700; border-top: 1.5px solid var(--line); }
.sec { margin-top: 4.5mm; }
.sec-pair { margin-top: 4.5mm; display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; align-items: start; }
.sec-pair .sec { margin-top: 0; }
.sec p, .sec ul, .sec ol { margin: 0; font-size: 9.2pt; color: #3F4B5A; overflow-wrap: anywhere; }
.sec ul, .sec ol { padding-left: 5mm; }
.sec li, .sec p { margin-bottom: .8mm; }
.terms-grid { margin-top: 5mm; display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; }
.terms-grid.single { grid-template-columns: 1fr; }
.terms-grid .box { border: 1px solid var(--line); border-radius: 2mm; padding: 3.2mm 4mm; }
.terms-grid .text { white-space: pre-line; }
.terms-grid table { border-collapse: collapse; font-size: 9.3pt; width: 100%; }
.terms-grid td { padding: .7mm 0; vertical-align: top; }
.terms-grid td.k { color: #6A7889; width: 30mm; }
.terms-grid td.v { font-weight: 600; }
.closing { margin-top: 5mm; display: flex; justify-content: space-between; align-items: flex-start; }
/* On the last page the signatures stand at the bottom, right above the footer */
.closing.at-bottom { position: absolute; left: 0; right: 0; bottom: 0; }
.closing .sign { width: 70mm; }
.closing .sign .for { white-space: nowrap; }
.closing .sign .seal { height: 20mm; }
.closing .sign .seal img { max-height: 20mm; }
.closing .sign .who { font-size: 9pt; color: #3F4B5A; margin-top: .6mm; min-height: 1.45em; }
.closing .sign .who b { color: #14213D; }
.page-body > :first-child { margin-top: 0; }
/* NCRC Pvt Ltd has the longer name */
.theme-ncrc .company-name { white-space: normal; }
.theme-ncrc .closing .sign { width: 88mm; }

/* Tighter spacing, used only when it saves a whole page */
body.compact .header { padding-top: 1.5mm; }
body.compact .rule { margin: 2.5mm 0; }
body.compact .party { padding: 2.2mm 3.5mm; }
body.compact .client-ids { margin-top: 1.2mm; }
body.compact .subject { margin-top: 3mm; padding: 1.8mm 4mm; }
body.compact .intro, body.compact .items-wrap, body.compact .summary, body.compact .sec, body.compact .sec-pair, body.compact .terms-grid { margin-top: 3mm; }
body.compact table.items thead th { padding: 1.8mm 2.5mm; }
body.compact table.items td { padding: 1.5mm 2.5mm; }
body.compact table.items tr.head td, body.compact table.items tr.subhead td { padding-top: 1.2mm; padding-bottom: 1.2mm; font-size: 9.2pt; }
body.compact table.items { font-size: 9.2pt; }
body.compact table.items .desc-sub + .desc-main, body.compact table.items .desc-main + .desc-main { margin-top: .8mm; }
body.compact table.items .desc-sub { font-size: 8pt; line-height: 1.3; margin-top: .3mm; }
body.compact .words { padding: 2.2mm 3.5mm; }
body.compact .totals tr:not(.grand) td { padding: 1mm 2.5mm; }
body.compact .totals .grandbox { padding: 2mm 2.5mm; }
body.compact .terms-grid .box { padding: 2.2mm 3.5mm; }
body.compact .terms-grid td { padding: .3mm 0; }
body.compact .sec li, body.compact .sec p { margin-bottom: .3mm; }
body.compact .closing { margin-top: 3mm; }
body.compact .closing .sign .seal, body.compact .closing .sign .seal img { height: 17mm; max-height: 17mm; }
`

export function quotationFileName(q: QuotationInput): string {
  const serial = (q.quotation_no.split('/').pop() || '').trim()
  return ['Quotation', q.company === 'ncrc' ? 'NCRC' : '', serial, q.client_name.split('\n')[0].trim()].filter(Boolean).join(' ').replace(/[\\/:*?"<>|]+/g, '-')
}

const lines = (body: string) => body.split('\n').map((l) => l.trim()).filter(Boolean)
/** Points pasted with their own bullet or number print with ours only */
const stripMarker = (l: string) => l.replace(/^(?:[•●▪*–-]\s+|\(?\d{1,2}[.)]\s+)/, '')

function sectionHtml(s: QuotationSection): string {
  const title = s.title.trim() ? `<div class="k-label">${esc(s.title)}</div>` : ''
  const points = lines(s.body)
  const body = !points.length ? ''
    : s.style === 'text' ? points.map((p) => `<p>${esc(p)}</p>`).join('')
      : s.style === 'numbers' ? `<ol>${points.map((p) => `<li>${esc(stripMarker(p))}</li>`).join('')}</ol>`
        : `<ul>${points.map((p) => `<li>${esc(stripMarker(p))}</li>`).join('')}</ul>`
  return `<div class="sec" data-flow="section">${title}${body}</div>`
}

/** Two half-width sections in a row print side by side; a lone one takes the full width */
function sectionsHtml(sections: QuotationSection[]): string {
  const used = sections.filter((s) => s.title.trim() || s.body.trim())
  const out: string[] = []
  for (let i = 0; i < used.length; i += 1) {
    if (used[i].half && used[i + 1]?.half) {
      out.push(`<div class="sec-pair">${sectionHtml(used[i])}${sectionHtml(used[i + 1])}</div>`)
      i += 1
    } else {
      out.push(sectionHtml(used[i]))
    }
  }
  return out.join('')
}

function sourceHtml(q: QuotationInput): string {
  const co = COMPANIES[q.company]
  const t = calcQuotation(q)
  const origin = window.location.origin

  const docRows: [string, string][] = [['Quotation No.', q.quotation_no], ['Date', dotDate(q.date)]]
  if (q.valid_until) docRows.push(['Valid Till', dotDate(q.valid_until)])
  const header = `
    <div class="head-block">
      <div class="header">
        <div class="company">
          <img class="logo" src="${origin}/letterhead/${co.logo}" alt="" onerror="this.remove()">
          <div>
            <div class="company-name">${esc(co.name)}</div>
            <div class="company-line">${esc(co.address)}</div>
            <div class="company-line">Ph: ${esc(co.phones.join(' / '))} &nbsp;|&nbsp; ${esc(co.email)}</div>
            <div class="company-line">${esc(co.website)}</div>
            <div class="company-ids">${co.gstin ? `<span><b>GSTIN:</b> ${esc(co.gstin)}</span>` : ''}<span><b>PAN:</b> ${esc(co.pan)}</span></div>
          </div>
        </div>
        <div class="doc-title">
          <h1>QUOTATION</h1>
          <div class="docno">${docRows.map(([k, v]) => `<span class="k">${esc(k)}</span><span class="v">${esc(v)}</span>`).join('')}</div>
        </div>
      </div>
      <hr class="rule">
    </div>`

  const ids: [string, string][] = [['Attn.', q.contact_person], ['Phone', q.mobile_no], ['Email', q.email], ['GSTIN', q.client_gstin]]
  const idRows = ids.filter(([, v]) => v.trim()).map(([k, v]) => `<div><b>${k}</b> ${esc(v)}</div>`).join('')
  const details = [
    q.location.trim() ? `<tr><td class="k">Site / Location</td><td class="v" colspan="2">${esc(q.location)}</td></tr>` : '',
    q.ref_no.trim() ? `<tr><td class="k">Your Ref. / Enquiry</td><td class="v">${esc(q.ref_no)}</td><td class="d">${q.ref_date ? `dt. ${esc(dotDate(q.ref_date))}` : ''}</td></tr>` : '',
    q.prepared_by.trim() ? `<tr><td class="k">Prepared By</td><td class="v" colspan="2">${esc(q.prepared_by)}</td></tr>` : '',
  ].join('')
  const parties = `
    <div class="quote-meta${details ? '' : ' single'}">
      <div class="party">
        <div class="k-label">Quotation To</div>
        <div class="client-name">${esc(q.client_name)}</div>
        ${q.client_address.trim() ? `<div class="client-addr">${esc(q.client_address)}</div>` : ''}
        ${idRows ? `<div class="client-ids">${idRows}</div>` : ''}
      </div>
      ${details ? `<div><div class="k-label">Quotation Details</div><table class="details">${details}</table></div>` : ''}
    </div>`

  const items = q.items.filter(itemUsed)
  const numbers = itemNumbers(items)
  const rows = items.map((it, i) => it.kind !== 'item' ? `
    <tr class="item ${it.kind === 'heading' ? 'head' : 'subhead'}">
      <td class="ctr">${numbers[i]}</td>
      <td colspan="5"><div class="desc-main">${esc(it.description.trim())}</div></td>
    </tr>` : `
    <tr class="item">
      <td class="ctr">${numbers[i]}</td>
      <td>${[{ title: it.description, details: it.details }, ...it.extra].map((p) => `${p.title.trim() ? `<div class="desc-main">${esc(p.title.trim())}</div>` : ''}${p.details.trim() ? `<div class="desc-sub">${esc(p.details.trim())}</div>` : ''}`).join('')}</td>
      <td class="ctr">${esc(it.unit)}</td>
      <td class="num">${esc(fmtQty(it.quantity))}</td>
      ${it.included ? '<td class="num incl" colspan="2">Included</td>' : `<td class="num">${money2(Number(it.rate) || 0)}</td><td class="num">${money2(quotationItemAmount(it))}</td>`}
    </tr>`).join('')
  const table = `
    <div class="items-wrap" data-flow="items"><table class="items">
      <thead><tr><th class="sr ctr">#</th><th>Description of Work</th><th class="ctr uom">UOM</th><th class="num">Qty</th><th class="num">Rate (₹)</th><th class="num">Amount (₹)</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`

  const tr = (label: string, value: string, cls = 'muted') => `<tr class="${cls}"><td>${label}</td><td class="v">${value}</td></tr>`
  const totals = [tr('Sub Total', money2(t.subtotal), '')]
  quotationLines(q, money2).forEach(([label, value, sum]) => totals.push(tr(esc(label), esc(value), sum ? 'sub' : 'muted')))
  totals.push(`<tr class="grand"><td colspan="2"><div class="grandbox"><span>${t.grandLabel}</span><span>₹ ${money2(t.grand)}</span></div></td></tr>`)
  const summary = `
    <div class="summary" data-flow="summary">
      <div class="words"><div class="k-label" style="margin:0">Total Amount (in words)</div><div class="val">${esc(t.words)}</div></div>
      <table class="totals">${totals.join('')}</table>
    </div>`

  const bank = co.bank
  const commercial: [string, string][] = [
    ['GSTIN', co.gstin], ['PAN', co.pan], ['Payment Terms', q.payment_terms.trim()], ['Validity', validityText(q.date, q.valid_until)],
  ]
  const commercialRows = commercial.filter(([, v]) => v).map(([k, v]) => `<tr><td class="k">${k}</td><td class="v text">${esc(v)}</td></tr>`).join('')
  const terms = `
    <div class="terms-grid${commercialRows ? '' : ' single'}">
      ${commercialRows ? `<div class="box"><div class="k-label">Commercial Terms</div><table>${commercialRows}</table></div>` : ''}
      <div class="box">
        <div class="k-label">Bank Details</div>
        <table>
          <tr><td class="k">Account Name</td><td class="v">${esc(bank.accountName)}</td></tr>
          <tr><td class="k">Bank</td><td class="v">${esc(bank.name)}</td></tr>
          <tr><td class="k">A/C No.</td><td class="v">${esc(bank.account)}</td></tr>
          <tr><td class="k">IFSC</td><td class="v">${esc(bank.ifsc)}</td></tr>
          ${bank.swift ? `<tr><td class="k">SWIFT</td><td class="v">${esc(bank.swift)}</td></tr>` : ''}
          <tr><td class="k">Branch</td><td class="v">${esc(bank.branch)}</td></tr>
        </table>
      </div>
    </div>`

  // NCRC Pvt Ltd: "Authorised Signatory" only, no name or designation
  const who = q.company === 'ncrc' ? '' : q.signatory_name.trim()
    ? `<b>${esc(q.signatory_name)}</b>${q.signatory_designation.trim() ? ` · ${esc(q.signatory_designation)}` : ''}`
    : esc(q.signatory_designation)
  const closing = `
    <div class="closing">
      <div class="sign"><div class="for">Accepted by Client</div><div class="seal"></div><div class="line">Signature, Name &amp; Seal</div><div class="who"></div></div>
      <div class="sign">
        <div class="for">For ${esc(co.name)}</div>
        <div class="seal">${co.seal ? `<img src="${origin}/letterhead/${co.seal}" alt="" onerror="this.remove()">` : ''}</div>
        <div class="line">Authorised Signatory</div><div class="who">${who}</div>
      </div>
    </div>`

  return [
    header, parties,
    q.subject.trim() ? `<div class="subject"><b>Subject</b><span>${esc(q.subject)}</span></div>` : '',
    q.intro.trim() ? `<div class="intro">${esc(q.intro)}</div>` : '',
    table, summary, sectionsHtml(q.sections), terms, closing,
  ].join('')
}

/**
 * Runs inside the print window (its source text is written there), so it must not use anything outside itself.
 * Moves the blocks of #src onto A4 pages: whole blocks where possible, item rows and section points one by one.
 */
function paginate(): void {
  const doc = document
  const src = doc.getElementById('src') as HTMLElement
  const out = doc.getElementById('out') as HTMLElement
  const pageTemplate = doc.getElementById('page-template') as HTMLTemplateElement

  const layout = (): number => {
    out.innerHTML = ''
    let body: HTMLElement
    const newPage = () => {
      const page = (pageTemplate.content.cloneNode(true) as DocumentFragment).firstElementChild as HTMLElement
      if (out.children.length) page.classList.add('cont')
      out.appendChild(page)
      body = page.querySelector('.page-body') as HTMLElement
    }
    const fits = () => {
      const last = body.lastElementChild
      return !last || last.getBoundingClientRect().bottom <= body.getBoundingClientRect().bottom + 0.5
    }

    /** Text too long for a whole page: keeps the words that fit in `el`, returns the rest */
    const cutText = (el: HTMLElement): string => {
      const parts = (el.textContent ?? '').split(/(\s+)/)
      let lo = 0
      let hi = parts.length
      while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2)
        el.textContent = parts.slice(0, mid).join('')
        if (fits()) lo = mid
        else hi = mid - 1
      }
      const kept = Math.max(lo, 1)
      el.textContent = parts.slice(0, kept).join('').trimEnd()
      return parts.slice(kept).join('').trim()
    }

    const addBlock = (block: HTMLElement) => {
      body.appendChild(block)
      if (!fits() && body.children.length > 1) {
        block.remove()
        newPage()
        body.appendChild(block)
      }
    }

    const addItems = (wrap: HTMLElement) => {
      const queue = Array.from(wrap.querySelectorAll('tbody > tr')) as HTMLElement[]
      const start = () => {
        const w = wrap.cloneNode(true) as HTMLElement
        const tbody = w.querySelector('tbody') as HTMLElement
        tbody.innerHTML = ''
        body.appendChild(w)
        return { w, tbody }
      }
      let cur = start()
      while (queue.length) {
        const row = queue.shift() as HTMLElement
        cur.tbody.appendChild(row)
        if (fits()) continue
        row.remove()
        // Nothing but the heading on this page yet and other blocks above it: take the table to the next page
        const onlyTable = body.children.length === 1
        const isHead = (r: Element) => r.classList.contains('head') || r.classList.contains('subhead')
        if (!onlyTable || Array.from(cur.tbody.children).some((r) => !isHead(r))) {
          // Headings go along with the item under them
          const heads: Element[] = []
          while (cur.tbody.lastElementChild && isHead(cur.tbody.lastElementChild)) {
            heads.unshift(cur.tbody.lastElementChild)
            cur.tbody.lastElementChild.remove()
          }
          if (!cur.tbody.children.length) cur.w.remove()
          newPage()
          cur = start()
          heads.forEach((r) => cur.tbody.appendChild(r))
          cur.tbody.appendChild(row)
          if (fits()) continue
          row.remove()
        }
        // Taller than a full page: split the long text over two rows
        cur.tbody.appendChild(row)
        const cell = row.children[1] as HTMLElement
        const rest = row.cloneNode(true) as HTMLElement
        const moved: HTMLElement[] = []
        while (cell.children.length > 1 && !fits()) {
          const block = cell.lastElementChild as HTMLElement
          block.remove()
          moved.unshift(block)
        }
        // The first block that does not fit whole: as many of its words as there is room for
        const first = moved[0]
        if (first) {
          const whole = first.textContent ?? ''
          cell.appendChild(first)
          const left = cutText(first)
          if (!fits()) {
            first.remove()
            first.textContent = whole
          } else {
            moved.shift()
            if (left) {
              const tail = first.cloneNode(false) as HTMLElement
              tail.textContent = left
              moved.unshift(tail)
            }
          }
        } else if (cell.lastElementChild) {
          const only = cell.lastElementChild as HTMLElement
          const left = cutText(only)
          if (left) {
            const tail = only.cloneNode(false) as HTMLElement
            tail.textContent = left
            moved.push(tail)
          }
        }
        if (moved.length) {
          Array.from(rest.children).forEach((td) => { td.textContent = '' })
          moved.forEach((block) => rest.children[1].appendChild(block))
          queue.unshift(rest)
        }
      }
    }

    /** The totals never stand alone on a page: the last item row goes with them */
    const addSummary = (block: HTMLElement) => {
      body.appendChild(block)
      if (fits() || body.children.length === 1) return
      block.remove()
      const wrap = body.lastElementChild as HTMLElement
      const rows = wrap.querySelectorAll('tbody > tr')
      const isHead = (r: Element) => r.classList.contains('head') || r.classList.contains('subhead')
      let from = rows.length - 1
      while (from > 0 && isHead(rows[from])) from -= 1
      while (from > 0 && isHead(rows[from - 1])) from -= 1
      const lastRows = from > 0 ? Array.from(rows).slice(from) : []
      newPage()
      if (lastRows.length) {
        const w = wrap.cloneNode(true) as HTMLElement
        const tbody = w.querySelector('tbody') as HTMLElement
        tbody.innerHTML = ''
        lastRows.forEach((r) => tbody.appendChild(r))
        body.appendChild(w)
      }
      body.appendChild(block)
      // A very tall last row: totals go on their own page
      if (!fits() && body.children.length > 1) {
        block.remove()
        newPage()
        body.appendChild(block)
      }
    }

    const addSection = (sec: HTMLElement) => {
      body.appendChild(sec)
      if (fits()) return
      sec.remove()
      const label = sec.querySelector('.k-label')
      const list = sec.querySelector('ol, ul')
      const queue = Array.from(list ? list.children : sec.querySelectorAll('p')) as HTMLElement[]
      // Short sections stay whole; only long ones are split between pages
      const whole = sec.cloneNode(true) as HTMLElement
      src.appendChild(whole)
      const short = whole.getBoundingClientRect().height < body.getBoundingClientRect().height * 0.35
      whole.remove()
      if (!queue.length || short) { addBlock(sec); return }
      let done = 0
      const start = (withTitle: boolean) => {
        const part = doc.createElement('div')
        part.className = 'sec'
        if (withTitle && label) part.appendChild(label.cloneNode(true))
        let box: HTMLElement = part
        if (list) {
          box = list.cloneNode(false) as HTMLElement
          if (list.tagName === 'OL') box.setAttribute('start', String(done + 1))
          part.appendChild(box)
        }
        body.appendChild(part)
        return { part, box }
      }
      let cur = start(true)
      let placed = 0
      while (queue.length) {
        const item = queue.shift() as HTMLElement
        cur.box.appendChild(item)
        if (fits()) { placed += 1; done += 1; continue }
        item.remove()
        if (placed || body.children.length > 1) {
          if (!placed) cur.part.remove()
          newPage()
          cur = start(done === 0)
          cur.box.appendChild(item)
          if (fits()) { placed = 1; done += 1; continue }
        } else {
          cur.box.appendChild(item)
        }
        const rest = item.cloneNode(false) as HTMLElement
        rest.textContent = cutText(item)
        placed = 1
        if (rest.textContent) {
          // The rest of the same point carries no second number / bullet
          rest.style.listStyle = 'none'
          queue.unshift(rest)
        } else {
          done += 1
        }
      }
    }

    newPage()
    Array.from(src.children).forEach((child) => {
      const block = child.cloneNode(true) as HTMLElement
      if (block.dataset.flow === 'items') addItems(block)
      else if (block.dataset.flow === 'summary') addSummary(block)
      else if (block.dataset.flow === 'section') addSection(block)
      else if (block.className === 'sec-pair') {
        addBlock(block)
        // Taller than a page side by side: one below the other instead
        if (!fits()) {
          block.remove()
          Array.from(block.children).forEach((s) => addSection(s as HTMLElement))
        }
      } else if (block.className === 'closing') {
        body.appendChild(block)
        if (!fits() && body.children.length > 1) {
          // The signatures are never alone on a page: payment terms and bank details go with them
          block.remove()
          const terms = body.lastElementChild as HTMLElement
          const withTerms = terms.classList.contains('terms-grid') && body.children.length > 1
          newPage()
          if (withTerms) body.appendChild(terms)
          body.appendChild(block)
        }
        block.classList.add('at-bottom')
      } else addBlock(block)
    })
    return out.children.length
  }

  let pages = layout()
  if (pages > 1) {
    doc.body.classList.add('compact')
    const compactPages = layout()
    if (compactPages >= pages) {
      doc.body.classList.remove('compact')
      layout()
    } else pages = compactPages
  }
  Array.from(out.children).forEach((page, i) => {
    (page.querySelector('.page-no') as HTMLElement).textContent = `Page ${i + 1} of ${pages}`
  })
  src.remove()
}

/** Opens the empty print window; call it straight from the click, or the pop-up blocker stops it */
export function openPrintWindow(): Window | null {
  const w = window.open('', '_blank')
  if (!w) window.alert('Allow pop-ups for this site to preview or print the quotation.')
  return w
}

export const FONT_URL = 'https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&display=swap'

/** The whole print page; `then` is script that runs once it is laid out on its pages */
export function quotationDocument(q: QuotationInput, withSign: boolean, then: string): string {
  const co = COMPANIES[q.company]
  const pageTemplate = `
    <div class="page">
      <div class="brandbar"></div>
      <div class="page-head"><b>${esc(co.name)}</b><span>Quotation No. <strong>${esc(q.quotation_no)}</strong> &nbsp;·&nbsp; ${esc(dotDate(q.date))}</span></div>
      <div class="page-body"></div>
      <div class="footer">
        <div class="services">${SERVICES.map(esc).join('<i>•</i>')}</div>
        <div class="meta"><span>${esc(q.quotation_no)}</span><span>This is a computer-generated quotation.</span><span class="page-no"></span></div>
      </div>
    </div>`
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(quotationFileName(q))}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="${FONT_URL}" rel="stylesheet">
    <style>${BILL_CSS}${CSS}</style></head>
    <body class="theme-${co.theme}${withSign ? '' : ' nosign'}">
      <div id="src">${sourceHtml(q)}</div>
      <div id="out"></div>
      <template id="page-template">${pageTemplate.trim()}</template>
      <script>
        var paginate = ${paginate.toString()};
        window.addEventListener('load', function () {
          var go = function () { paginate(); ${then} };
          if (document.fonts && document.fonts.ready) document.fonts.ready.then(go); else go();
        });
      </script>
    </body></html>`
}

export function printQuotation(w: Window, q: QuotationInput, withSign: boolean) {
  w.document.open()
  w.document.write(quotationDocument(q, withSign, 'setTimeout(function () { window.print() }, 150)'))
  w.document.close()
}
