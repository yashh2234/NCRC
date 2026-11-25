import { useMemo, useState } from 'react'
import { Check, Pencil, Undo2 } from 'lucide-react'
import { dotDate, money2 } from '../lib/bills'
import { previewDocument } from '../lib/quotationPrint'
import { quotationToInput, quotationsApi, type Quotation, type QuotationContent } from '../lib/quotations'
import { Modal } from './Modal'

const LABELS: Partial<Record<keyof QuotationContent, string>> = {
  quotation_no: 'Quotation No.', date: 'Date', valid_until: 'Valid Till', client_name: 'Client Name', client_address: 'Address', client_gstin: 'Client GSTIN',
  contact_person: 'Contact Person', mobile_no: 'Phone', email: 'Email', location: 'Site / Location', ref_no: 'Client Ref. No.', ref_date: 'Ref. Dated',
  prepared_by: 'Prepared By', subject: 'Subject', intro: 'Introduction', discount: 'Discount', transport: 'Transportation', transport_gst: 'GST on transportation',
  payment_terms: 'Payment Terms', signatory_name: 'Signatory Name', signatory_designation: 'Designation', gst_mode: 'GST', net_amount: 'Total',
}
const DATES = ['date', 'valid_until', 'ref_date']
const MONEY = ['discount', 'transport', 'net_amount']

interface Change { label: string; before: string; after: string }

function show(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '-'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (DATES.includes(key)) return dotDate(String(value)) || String(value)
  if (MONEY.includes(key)) return `₹${money2(Number(value))}`
  return String(value)
}

type Item = QuotationContent['items'][number]
const itemText = (it: Item) => it.kind !== 'item' ? `${it.kind === 'heading' ? 'Heading' : 'Sub-heading'}: ${it.description}` : [
  it.description, it.details, ...it.extra.map((p) => [p.title, p.details].filter(Boolean).join(': ')),
  it.included ? `${it.quantity} ${it.unit} · Included` : `${it.quantity} ${it.unit} × ₹${money2(it.rate)} = ₹${money2(it.amount)}`,
].filter(Boolean).join('\n')
const sectionText = (s: QuotationContent['sections'][number]) => [s.title, s.body].filter(Boolean).join('\n')

/** Lines that are only on one side, in their order (the rest did not change) */
function listChanges(label: string, before: string[], after: string[]): Change[] {
  const left = [...before]
  const added = after.filter((text) => {
    const at = left.indexOf(text)
    if (at < 0) return true
    left.splice(at, 1)
    return false
  })
  const rows: Change[] = []
  for (let i = 0; i < Math.max(left.length, added.length); i += 1) rows.push({ label, before: left[i] ?? '-', after: added[i] ?? '(removed)' })
  if (!rows.length && before.join('\u0000') !== after.join('\u0000')) rows.push({ label, before: 'Old order', after: 'New order' })
  return rows
}

function changesOf(before: QuotationContent, after: QuotationContent): Change[] {
  const rows: Change[] = []
  for (const [key, label] of Object.entries(LABELS) as [keyof QuotationContent, string][]) {
    const [a, b] = [show(key, before[key]), show(key, after[key])]
    if (a !== b) rows.push({ label, before: a, after: b })
  }
  return [
    ...rows,
    ...listChanges('Item', before.items.map(itemText), after.items.map(itemText)),
    ...listChanges('Section', before.sections.map(sectionText), after.sections.map(sectionText)),
  ]
}

/** For approvers: what changed, how it will print, and Approve / Send back */
export function QuotationReview({ quotation, onClose, onDone, onEdit }: { quotation: Quotation; onClose: () => void; onDone: (q: Quotation) => void; onEdit: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [returning, setReturning] = useState(quotation.approval === 'returned')
  const [remark, setRemark] = useState(quotation.approval_remark ?? '')
  const changes = useMemo(() => (quotation.approved_content ? changesOf(quotation.approved_content, quotation.content) : null), [quotation])
  const preview = useMemo(() => previewDocument(quotationToInput(quotation)), [quotation])

  const run = async (action: () => Promise<{ data: Quotation }>) => {
    setBusy(true)
    setError('')
    try {
      onDone((await action()).data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save')
      setBusy(false)
    }
  }

  const footer = returning ? (
    <>
      <button type="button" className="btn btn-outline" disabled={busy} onClick={() => setReturning(false)}>Cancel</button>
      <button type="button" className="btn btn-primary" disabled={busy || !remark.trim()} onClick={() => void run(() => quotationsApi.sendBack(quotation, remark.trim()))}><Undo2 size={15} /> Send back</button>
    </>
  ) : (
    <>
      <div className="ui-modal__footer-left"><button type="button" className="btn btn-outline" disabled={busy} onClick={onEdit}><Pencil size={15} /> Edit</button></div>
      <button type="button" className="btn btn-outline" disabled={busy} onClick={() => setReturning(true)}><Undo2 size={15} /> Send back</button>
      <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void run(() => quotationsApi.approve(quotation))}><Check size={15} /> {busy ? 'Saving…' : 'Approve'}</button>
    </>
  )

  return (
    <Modal title="Approve quotation" subtitle={`${quotation.quotation_no} · ${quotation.client_name}`} onClose={onClose} size="lg" footer={footer}>
      <div style={{ display: 'grid', gap: 14 }}>
        {error ? <p role="alert" style={{ margin: 0, padding: '8px 12px', borderRadius: 8, background: '#fef2f2', color: '#b91c1c' }}>{error}</p> : null}
        <p style={{ margin: 0, fontSize: '0.85rem', color: '#475569' }}>
          {quotation.approval_requested_by_name ? <>{changes ? 'Changed' : 'Made'} by <strong>{quotation.approval_requested_by_name}</strong></> : null}
          {quotation.approval_requested_at ? ` · ${new Date(quotation.approval_requested_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}` : ''}
          {quotation.approval === 'returned' && quotation.approval_remark ? <> · sent back: <strong>{quotation.approval_remark}</strong></> : null}
        </p>

        {returning ? (
          <label style={{ display: 'grid', gap: 4, fontSize: '0.82rem', fontWeight: 600 }}>What should be corrected?
            <textarea className="input" rows={3} autoFocus maxLength={1000} value={remark} onChange={(e) => setRemark(e.target.value)} style={{ resize: 'vertical', fontFamily: 'inherit' }} />
          </label>
        ) : null}

        {changes ? (
          <div>
            <h4 style={{ margin: '0 0 6px' }}>What changed since it was approved</h4>
            {changes.length ? (
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ minWidth: 560 }}>
                  <thead><tr><th style={{ width: 150 }}></th><th>Approved</th><th>Now</th></tr></thead>
                  <tbody>
                    {changes.map((c, i) => (
                      <tr key={i} style={{ verticalAlign: 'top' }}>
                        <td style={{ fontWeight: 600 }}>{c.label}</td>
                        <td style={{ whiteSpace: 'pre-line', color: '#64748b' }}>{c.before}</td>
                        <td style={{ whiteSpace: 'pre-line', fontWeight: 600 }}>{c.after}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p style={{ margin: 0, color: '#64748b' }}>It is the same as the approved one.</p>}
          </div>
        ) : <p style={{ margin: 0, padding: '8px 12px', borderRadius: 8, background: '#f8fafc', color: '#475569', fontSize: '0.85rem' }}>New quotation: it was never approved before.</p>}

        <iframe title="Quotation preview" srcDoc={preview} style={{ width: '100%', height: 520, border: '1px solid #e2e8f0', borderRadius: 8, background: '#e5e7eb' }} />
      </div>
    </Modal>
  )
}
