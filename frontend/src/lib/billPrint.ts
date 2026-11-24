/**
 * Printable invoice / tax invoice / credit note in the new Namotech bill design
 * (Downloads/billing templates: logo, coloured brand bar, Bill To + Details boxes, items table
 * that fills the page, words + bank + totals, signature, services footer).
 * Adjusted to how the office bills:
 *  - GST on the items total only; transport is added after GST
 *  - HSN 9983 column on NCS LLP (no SAC column), no Place of Supply / Reverse Charge / client state
 *  - Letter / Work Order / Report / UID rows only when filled
 *  - dates dd-mm-yyyy; paise round-off on its own line
 * With / without sign is chosen before opening; the print dialog opens by itself ("Save as PDF" gives the PDF).
 */
import { COMPANIES, DEFAULT_HSN, DEFAULT_SAC, SERVICES, amountWords, calcBill, dotDate, itemAmount, money2, type BillInput } from './bills'

/** Credit note against a cancelled invoice */
export interface CreditNote { no: string; date: string }

export const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] as string))
export const fmtQty = (v: unknown) => {
  const n = Number(v)
  if (v === '' || v === null || v === undefined || Number.isNaN(n)) return ''
  return Number.isInteger(n) ? String(n) : String(+n.toFixed(2))
}

export const BILL_CSS = `
@page { size: A4; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
.theme-llp  { --brand: #092765; --brand-2: #1C3F8A; --accent: #D30202; --steel: #93A3B2;
              --tint: #F1F4F8; --tint-2: #F8FAFC; --line: #D5DCE4; --line-2: #E7EBF0;
              --bar: linear-gradient(90deg, #092765 0%, #092765 100%); }
.theme-ncrc { --brand: #0042FF; --brand-2: #0033C4; --accent: #CF0707; --steel: #8FA2C8;
              --tint: #EEF3FF; --tint-2: #F7F9FF; --line: #D3DDF5; --line-2: #E6ECFA;
              --bar: linear-gradient(90deg, #0042FF 0%, #6A2BA8 55%, #CF0707 100%); }
body { font-family: "Inter", "Segoe UI", Roboto, Arial, sans-serif; font-size: 10pt; line-height: 1.45; color: #14213D;
       -webkit-print-color-adjust: exact; print-color-adjust: exact; background: #e5e7eb; }
.page { width: 210mm; height: 297mm; padding: 11mm 12mm 8mm; margin: 12px auto; background: #fff;
        position: relative; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,.15); }
.brandbar { position: absolute; top: 0; left: 0; right: 0; height: 4.5mm; background: var(--bar); }
.brandbar::after { content: ""; position: absolute; left: 0; right: 0; bottom: -1.2mm; height: 1.2mm; background: var(--accent); }
.theme-ncrc .brandbar::after { display: none; }
.k-label { font-size: 7.8pt; font-weight: 700; color: var(--brand); text-transform: uppercase; letter-spacing: 1.2px; margin-bottom: 1.8mm; }

.header { display: flex; justify-content: space-between; align-items: flex-start; gap: 8mm; padding-top: 3mm; }
.company { display: flex; gap: 5mm; align-items: flex-start; }
.company > div { min-width: 0; }
.logo { width: 32mm; height: 24mm; object-fit: contain; object-position: left top; flex: none; }
.theme-ncrc .logo { width: 40mm; height: 22mm; }
.company-name { font-size: 14.5pt; font-weight: 700; color: var(--brand); margin: 0 0 1.2mm; line-height: 1.2; }
.company-line { color: #3F4B5A; font-size: 9pt; }
.company-ids { margin-top: 1.6mm; font-size: 9pt; }
.company-ids span + span { margin-left: 5mm; }

.doc-title { text-align: right; flex: none; }
.doc-title h1 { margin: 0; padding-bottom: 1.4mm; border-bottom: 2.5px solid var(--accent); display: inline-block;
                font-size: 22pt; font-weight: 800; letter-spacing: 2.5px; color: var(--brand); line-height: 1.1; }
.doc-title .copy { font-size: 8pt; color: #6A7889; text-transform: uppercase; letter-spacing: 1px; margin-top: 1.5mm; }
.doc-title .docno { margin-top: 4mm; display: inline-grid; grid-template-columns: auto auto; gap: 1mm 5mm; text-align: left; font-size: 9.5pt; }
.doc-title .docno .k { color: #6A7889; }
.doc-title .docno .v { font-weight: 700; }

.rule { border: 0; border-top: 1px solid var(--line); margin: 4mm 0 4mm; }

.parties { display: grid; grid-template-columns: 1fr 1fr; gap: 7mm; }
.party { background: var(--tint); border-radius: 2mm; padding: 3.2mm 4mm; }
.client-name { font-size: 12pt; font-weight: 700; margin-bottom: 1mm; }
.client-addr { color: #3F4B5A; white-space: pre-line; }
.client-ids { margin-top: 2.5mm; display: grid; gap: .6mm; font-size: 9.3pt; }
.client-ids b { font-weight: 600; color: #6A7889; display: inline-block; min-width: 14mm; }

.details { width: 100%; border-collapse: collapse; font-size: 9.3pt; }
.details td { padding: 1.5mm 2mm; border-bottom: 1px solid var(--line-2); vertical-align: top; }
.details td.k { color: #6A7889; width: 36%; white-space: nowrap; }
.details td.v { font-weight: 600; }
.details td.d { color: #3F4B5A; text-align: right; white-space: nowrap; }
.details tr:last-child td { border-bottom: 0; }

.items-wrap { flex: 1; display: flex; flex-direction: column; margin-top: 5mm; min-height: 28mm;
              border: 1px solid var(--line); border-radius: 2mm; overflow: hidden; }
table.items { width: 100%; height: 100%; border-collapse: collapse; font-size: 9.6pt; flex: 1; }
table.items thead th { background: var(--brand); color: #fff; font-weight: 600; font-size: 8.4pt; text-transform: uppercase;
  letter-spacing: .6px; padding: 2.8mm 2.5mm; text-align: left; height: 1px; }
table.items td { padding: 3mm 2.5mm; vertical-align: top; border-right: 1px solid var(--line-2); height: 1px; }
table.items td:last-child, table.items th:last-child { border-right: 0; }
table.items tbody tr.item + tr.item td { border-top: 1px solid var(--line-2); }
table.items tr.filler td { height: auto; padding: 0; }
table.items .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
table.items .ctr { text-align: center; }
table.items .sr { width: 10mm; }
table.items .desc-main { font-weight: 600; }
table.items .desc-sub { color: #5B6878; font-size: 8.8pt; margin-top: .8mm; white-space: pre-line; }

.summary { display: grid; grid-template-columns: 1fr 80mm; gap: 8mm; margin-top: 5mm; align-items: start; }
.words { background: var(--tint); border-radius: 2mm; padding: 3.2mm 4mm; }
.words .val { font-weight: 600; font-size: 10.3pt; margin-top: .6mm; }
.bank { margin-top: 3mm; border: 1px solid var(--line); border-radius: 2mm; padding: 3.2mm 4mm; }
.bank table { border-collapse: collapse; font-size: 9.3pt; }
.bank td { padding: .7mm 0; vertical-align: top; }
.bank td.k { color: #6A7889; width: 30mm; }
.bank td.v { font-weight: 600; }
.totals { width: 100%; border-collapse: collapse; font-size: 9.8pt; font-variant-numeric: tabular-nums; }
.totals td { padding: 1.7mm 2.5mm; }
.totals td.v { text-align: right; white-space: nowrap; }
.totals tr.muted td { color: #3F4B5A; }
.totals tr.grand td { padding: 1mm 0; }
.totals .grandbox { display: flex; justify-content: space-between; background: var(--brand); color: #fff; font-weight: 700;
                    font-size: 12pt; padding: 3mm 2.5mm; border-radius: 2mm; }
.totals tr.after td { font-size: 9.3pt; color: #3F4B5A; }
.totals tr.net td { font-weight: 700; font-size: 11pt; border-top: 1.5px solid var(--brand); color: var(--brand); }

.bottom { display: grid; grid-template-columns: 1fr 66mm; gap: 8mm; margin-top: 4mm; align-items: end; }
.notes { font-size: 8.6pt; color: #3F4B5A; }
.notes .decl { margin-top: 3mm; font-style: italic; }
.sign { text-align: center; }
.sign .for { font-size: 9.2pt; font-weight: 600; }
.sign .seal { height: 22mm; margin: 1mm auto 0; display: flex; align-items: center; justify-content: center; }
.sign .seal img { max-height: 22mm; max-width: 54mm; }
.sign .line { border-top: 1px solid #14213D; margin-top: 1mm; padding-top: 1.2mm; font-size: 9pt; color: #3F4B5A; }
body.nosign .sign .seal img { visibility: hidden; }

.footer { margin-top: 4mm; padding: 2.4mm 4mm; flex: none; border-radius: 2mm; background: var(--tint); display: grid; gap: 1mm; font-size: 8pt; color: #5B6878; }
.footer .services { color: var(--brand); font-weight: 600; text-align: center; letter-spacing: .3px; }
.footer .services i { color: var(--accent); font-style: normal; padding: 0 1.5mm; }
.footer .meta { text-align: center; }


@media print {
  body { background: #fff; }
  .page { margin: 0; box-shadow: none; }
}
`

export function billFileName(b: BillInput, cn?: CreditNote): string {
  const d = dotDate(cn ? cn.date : b.invoice_date).replace(/-(\d{2})(\d{2})$/, '-$2')
  const no = (b.invoice_no.split('/').pop() || b.invoice_no).trim()
  const head = cn ? ['Credit Note', cn.no.split('/').pop() ?? '', 'bill no', no] : ['bill no', no]
  return [...head, d ? `Dt. ${d}` : '', b.client_name.split('\n')[0].trim()].filter(Boolean).join(' ').replace(/[\\/:*?"<>|]+/g, '-')
}

function billHtml(b: BillInput, cn?: CreditNote): string {
  const co = COMPANIES[b.company]
  const isNcs = b.company === 'ncs'
  const t = calcBill(b)
  const origin = window.location.origin
  const kind = cn ? 'credit note' : 'invoice'

  // Totals: GST on the items total, transport after GST, round-off on its own line
  const grand = Math.round(t.total)
  const roundOff = Math.round((grand - t.total) * 100) / 100
  const advance = cn ? 0 : t.advance
  const net = grand - advance

  // ── Header ──
  const docRows: [string, string][] = cn
    ? [['Credit Note No.', cn.no], ['Date', dotDate(cn.date)], ['Against Invoice', b.invoice_no], ['Invoice Date', dotDate(b.invoice_date)]]
    : [['Invoice No.', b.invoice_no], ['Date', dotDate(b.invoice_date)]]
  const header = `
    <div class="header">
      <div class="company">
        <img class="logo" src="${origin}/letterhead/${co.logo}" alt="" onerror="this.remove()">
        <div>
          <div class="company-name">${esc(co.name)}</div>
          <div class="company-line">${esc(co.address)}</div>
          <div class="company-line">Ph: ${esc(co.phones.join(' / '))} &nbsp;|&nbsp; ${esc(co.email)}</div>
          <div class="company-line">${esc(co.website)}</div>
          <div class="company-ids">
            ${co.gstin ? `<span><b>GSTIN:</b> ${esc(co.gstin)}</span>` : ''}
            ${co.pan ? `<span><b>PAN:</b> ${esc(co.pan)}</span>` : ''}
          </div>
        </div>
      </div>
      <div class="doc-title">
        <h1>${cn ? 'CREDIT NOTE' : esc(co.title)}</h1>
        <div class="copy">Original for Recipient</div>
        <div class="docno">${docRows.map(([k, v]) => `<span class="k">${esc(k)}</span><span class="v">${esc(v)}</span>`).join('')}</div>
      </div>
    </div>
    <hr class="rule">`

  // ── Bill To + Details (references only when filled) ──
  const refs: [string, string, string][] = []
  if (b.work_order_no.trim()) refs.push([co.orderLabel, b.work_order_no, b.work_order_date])
  if (b.report_no.trim()) refs.push(['Report No.', b.report_no, b.report_date])
  if (isNcs && b.uid_no.trim()) refs.push(['UID No.', b.uid_no, b.uid_date])
  const details = [
    `<tr><td class="k">SAC Code</td><td class="v" colspan="2">${DEFAULT_SAC}</td></tr>`,
    ...refs.map(([k, v, d]) => `<tr><td class="k">${esc(k)}</td><td class="v">${esc(v)}</td><td class="d">${d ? `dt. ${esc(dotDate(d))}` : ''}</td></tr>`),
    b.terms_of_delivery.trim() ? `<tr><td class="k">Terms of Delivery</td><td class="v" colspan="2">${esc(b.terms_of_delivery)}</td></tr>` : '',
  ].join('')
  const parties = `
    <div class="parties">
      <div class="party">
        <div class="k-label">${cn ? 'Issued To' : 'Bill To'}</div>
        <div class="client-name">${esc(b.client_name)}</div>
        <div class="client-addr">${esc(b.client_address)}</div>
        ${b.client_gstin.trim() ? `<div class="client-ids"><div><b>GSTIN</b> ${esc(b.client_gstin)}</div></div>` : ''}
      </div>
      <div>
        <div class="k-label">${cn ? 'Credit Note Details' : 'Invoice Details'}</div>
        <table class="details">${details}</table>
      </div>
    </div>`

  // ── Items: first line of the particular in bold, the rest as a grey description ──
  const items = b.items.filter((it) => it.description.trim() || Number(it.rate))
  const cols = isNcs ? 7 : 6
  const itemRows = items.map((it, i) => {
    const [main, ...rest] = it.description.trim().split('\n')
    const sub = rest.join('\n').trim()
    return `<tr class="item">
      <td class="ctr">${i + 1}</td>
      <td><div class="desc-main">${esc(main)}</div>${sub ? `<div class="desc-sub">${esc(sub)}</div>` : ''}</td>
      ${isNcs ? `<td class="ctr">${DEFAULT_HSN}</td>` : ''}
      <td class="num">${esc(fmtQty(it.qty))}</td>
      <td class="num">${money2(Number(it.rate) || 0)}</td>
      <td class="num">${Number(it.discount) ? `${esc(fmtQty(it.discount))}%` : '—'}</td>
      <td class="num">${money2(itemAmount(it))}</td>
    </tr>`
  }).join('')
  const itemsTable = `
    <div class="items-wrap"><table class="items">
      <thead><tr>
        <th class="sr ctr">#</th><th>Particulars</th>${isNcs ? '<th class="ctr">HSN</th>' : ''}
        <th class="num">Qty</th><th class="num">Rate (₹)</th><th class="num">Disc.</th><th class="num">Amount (₹)</th>
      </tr></thead>
      <tbody>${itemRows}<tr class="filler">${'<td></td>'.repeat(cols)}</tr></tbody>
    </table></div>`

  // ── Words / bank / totals ──
  // Every line prints, also when 0 (as on the Excel bills); only the paise round-off is hidden when there is none
  const line = (label: string, value: number) => `<tr class="muted"><td>${label}</td><td class="v">${money2(value)}</td></tr>`
  const totals: string[] = [`<tr><td>Sub Total</td><td class="v">${money2(t.subtotal)}</td></tr>`]
  if (isNcs) totals.push(line('CGST @ 9%', t.cgst), line('SGST @ 9%', t.sgst), line('IGST @ 18%', t.igst))
  totals.push(line('Transportation &amp; Other Exp.', t.transport))
  if (roundOff) totals.push(`<tr class="muted"><td>Round Off</td><td class="v">${roundOff > 0 ? '' : '−'}${money2(Math.abs(roundOff))}</td></tr>`)
  totals.push(`<tr class="grand"><td colspan="2"><div class="grandbox"><span>${cn ? 'Total Credit' : 'Invoice Total'}</span><span>₹ ${money2(grand)}</span></div></td></tr>`)
  if (!cn) {
    totals.push(`<tr class="after"><td>Advance Received</td><td class="v">− ${money2(advance)}</td></tr>`,
      `<tr class="net"><td>Net Amount Due</td><td class="v">₹ ${money2(net)}</td></tr>`)
  }
  const bank = co.bank
  const summary = `
    <div class="summary">
      <div>
        <div class="words">
          <div class="k-label" style="margin:0">${cn ? 'Amount Credited' : 'Amount Chargeable'} (in words)</div>
          <div class="val">${esc(amountWords(advance ? net : grand))}</div>
        </div>
        <div class="bank">
          <div class="k-label">Payment Details</div>
          <table>
            <tr><td class="k">Account Name</td><td class="v">${esc(bank.accountName)}</td></tr>
            <tr><td class="k">Bank</td><td class="v">${esc(bank.name)}</td></tr>
            <tr><td class="k">A/C No.</td><td class="v">${esc(bank.account)}</td></tr>
            <tr><td class="k">IFSC</td><td class="v">${esc(bank.ifsc)}</td></tr>
            ${bank.swift ? `<tr><td class="k">SWIFT</td><td class="v">${esc(bank.swift)}</td></tr>` : ''}
            <tr><td class="k">Branch</td><td class="v">${esc(bank.branch)}</td></tr>
          </table>
        </div>
      </div>
      <table class="totals">${totals.join('')}</table>
    </div>`

  // ── Declaration, signature, footer ──
  const decl = cn
    ? 'We declare that this credit note correctly reflects the reduction in value of the services billed and that all particulars are true and correct.'
    : 'We declare that this invoice shows the actual price of the services described and that all particulars are true and correct.'
  const bottom = `
    <div class="bottom">
      <div class="notes"><div class="k-label">Terms &amp; Declaration</div><div class="decl">${decl}</div></div>
      <div class="sign">
        <div class="for">For ${esc(co.name)}</div>
        <div class="seal"><img src="${origin}/letterhead/${co.seal}" alt="" onerror="this.remove()"></div>
        <div class="line">Authorised Signatory</div>
      </div>
    </div>
    <div class="footer">
      <div class="services">${SERVICES.map(esc).join('<i>•</i>')}</div>
      <div class="meta">This is a computer-generated ${kind}.</div>
    </div>`

  return `<div class="page"><div class="brandbar"></div>${header}${parties}${itemsTable}${summary}${bottom}</div>`
}

export function openBillPrint(b: BillInput, withSign: boolean, cn?: CreditNote) {
  const w = window.open('', '_blank')
  if (!w) {
    window.alert('Allow pop-ups for this site to preview or print the invoice.')
    return
  }
  const co = COMPANIES[b.company]
  const title = billFileName(b, cn) || 'Invoice'
  w.document.open()
  // No toolbar: sign was chosen in the app; the print dialog opens once fonts and images have loaded
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>${BILL_CSS}</style></head>
    <body class="theme-${co.theme}${withSign ? '' : ' nosign'}">
      ${billHtml(b, cn)}
      <script>
        window.addEventListener('load', function () {
          var go = function () { setTimeout(function () { window.print() }, 150) };
          if (document.fonts && document.fonts.ready) document.fonts.ready.then(go); else go();
        });
      </script>
    </body></html>`)
  w.document.close()
}
