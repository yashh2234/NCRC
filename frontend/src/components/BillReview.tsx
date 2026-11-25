import { useState } from 'react'
import { Check, Pencil, Undo2 } from 'lucide-react'
import { dotDate, money2, type BillContent, type DocApproval } from '../lib/bills'
import { Modal } from './Modal'

const LABELS: Record<string, string> = {
  credit_note_no: 'Credit Note No.', credit_note_date: 'Credit Note Dated', invoice_no: 'Invoice No.', invoice_date: 'Date', uid_no: 'UID No.', uid_date: 'UID Dated',
  work_order_no: 'Letter / Work Order No.', work_order_date: 'Letter / Work Order Dated', report_no: 'Report No.', report_date: 'Report Dated', terms_of_delivery: 'Terms of Delivery',
  client_name: 'Client', client_address: 'Address', client_gstin: 'Client GSTIN', gst_type: 'GST', transport: 'Transportation & Other Exp.', advance: 'Advance',
  net_amount: 'Net Amount', total: 'Total Credit',
}
const MONEY = ['transport', 'advance', 'net_amount', 'total']
const GST: Record<string, string> = { intra: 'CGST 9% + SGST 9%', inter: 'IGST 18%', none: 'No GST' }

const show = (key: string, v: unknown): string => {
  if (v === null || v === undefined || v === '') return '-'
  if (key.endsWith('_date')) return dotDate(String(v)) || String(v)
  if (MONEY.includes(key)) return `₹${money2(Number(v))}`
  return key === 'gst_type' ? GST[String(v)] ?? String(v) : String(v)
}

function changesOf(before: BillContent, after: BillContent): Array<{ label: string; before: string; after: string }> {
  const rows = Object.entries(LABELS).map(([key, label]) => ({ label, before: show(key, before[key]), after: show(key, after[key]) })).filter((r) => r.before !== r.after)
  const text = (it: BillContent['items'][number] | undefined) => (it ? `${it.description}\n${it.qty} × ₹${money2(Number(it.rate))}${it.discount ? ` − ${it.discount}%` : ''} = ₹${money2(Number(it.amount))}` : '-')
  const n = Math.max(before.items.length, after.items.length)
  for (let i = 0; i < n; i += 1) {
    const [a, b] = [text(before.items[i]), text(after.items[i])]
    if (a !== b) rows.push({ label: `Particular ${i + 1}`, before: a, after: b })
  }
  return rows
}

/** For approvers: what changed, how it will print, and Approve / Send back */
export function BillReview({ kind, subtitle, approval, preview, onClose, onDecide, onEdit }: {
  kind: string
  subtitle: string
  approval: DocApproval
  /** The print, marked NOT APPROVED */
  preview: string
  onClose: () => void
  onDecide: (action: 'approve' | 'send_back', remark: string) => Promise<void>
  onEdit: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [returning, setReturning] = useState(approval.approval === 'returned')
  const [remark, setRemark] = useState(approval.approval_remark ?? '')
  const changes = approval.approved_content && approval.content ? changesOf(approval.approved_content, approval.content) : null

  const run = async (action: 'approve' | 'send_back') => {
    setBusy(true)
    setError('')
    try {
      await onDecide(action, remark.trim())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save')
      setBusy(false)
    }
  }

  const footer = returning ? (
    <>
      <button type="button" className="btn btn-outline" disabled={busy} onClick={() => setReturning(false)}>Cancel</button>
      <button type="button" className="btn btn-primary" disabled={busy || !remark.trim()} onClick={() => void run('send_back')}><Undo2 size={15} /> Send back</button>
    </>
  ) : (
    <>
      <div className="ui-modal__footer-left"><button type="button" className="btn btn-outline" disabled={busy} onClick={onEdit}><Pencil size={15} /> Edit</button></div>
      <button type="button" className="btn btn-outline" disabled={busy} onClick={() => setReturning(true)}><Undo2 size={15} /> Send back</button>
      <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void run('approve')}><Check size={15} /> {busy ? 'Saving…' : 'Approve'}</button>
    </>
  )

  return (
    <Modal title={`Approve ${kind}`} subtitle={subtitle} onClose={onClose} size="lg" footer={footer}>
      <div style={{ display: 'grid', gap: 14 }}>
        {error ? <p role="alert" style={{ margin: 0, padding: '8px 12px', borderRadius: 8, background: '#fef2f2', color: '#b91c1c' }}>{error}</p> : null}
        <p style={{ margin: 0, fontSize: '0.85rem', color: '#475569' }}>
          {approval.approval_requested_by_name ? <>{changes ? 'Changed' : 'Made'} by <strong>{approval.approval_requested_by_name}</strong></> : null}
          {approval.approval_requested_at ? ` · ${new Date(approval.approval_requested_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}` : ''}
          {approval.approval === 'returned' && approval.approval_remark ? <> · sent back: <strong>{approval.approval_remark}</strong></> : null}
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
                  <thead><tr><th style={{ width: 170 }}></th><th>Approved</th><th>Now</th></tr></thead>
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
        ) : <p style={{ margin: 0, padding: '8px 12px', borderRadius: 8, background: '#f8fafc', color: '#475569', fontSize: '0.85rem' }}>New {kind}: it was never approved before.</p>}

        <iframe title={`Preview of the ${kind}`} srcDoc={preview} style={{ width: '100%', height: 520, border: '1px solid #e2e8f0', borderRadius: 8, background: '#e5e7eb' }} />
      </div>
    </Modal>
  )
}

/** Under a number in the list: waiting / sent back */
export function ApprovalNote({ approval }: { approval: DocApproval }) {
  if (approval.approval === 'approved') return null
  const back = approval.approval === 'returned'
  return (
    <div title={approval.approval_remark ?? ''} style={{ maxWidth: 190, overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.72rem', fontWeight: 600, color: back ? '#b91c1c' : '#92400e' }}>
      {back ? `Sent back: ${approval.approval_remark ?? ''}` : `Waiting for approval${approval.approval_requested_by_name ? ` · ${approval.approval_requested_by_name}` : ''}`}
    </div>
  )
}
