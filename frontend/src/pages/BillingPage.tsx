import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Ban, Download, FileMinus, Pencil, Plus, Printer, RotateCcw, Save, Search, Stamp, Trash2, X } from 'lucide-react'
import { DateRangeFilter } from '../components/DateRangeFilter'
import { Modal } from '../components/Modal'
import { request } from '../lib/api'
import { useTracking } from '../lib/useTracking'
import {
  COMPANIES, billToInput, billsApi, creditNoteInput, calcBill, dotDate, emptyBill, emptyItem, itemAmount, money2, today,
  type Bill, type BillCompany, type BillInput, type BillItem,
} from '../lib/bills'
import { openBillPrint, type CreditNote } from '../lib/billPrint'

interface BillingPageProps {
  /** Show only this UID's bills (from the Registrations "Bill" column) */
  uidFilter?: string
  onClearUidFilter?: () => void
  /** Start a new bill for this UID (from the Registrations "Bill" column) */
  createForUid?: string
  onCreateHandled?: () => void
  /** 'invoices' = active invoices (Invoice menu); 'credit_notes' = cancelled invoices (Credit Note menu) */
  mode?: 'invoices' | 'credit_notes'
}

/** `cn` set = editing the credit note of a cancelled NCS LLP invoice (its own copy of the document) */
type CnMeta = { no: string; date: string; reason: string; invoiceNo: string; invoiceDate: string }
type Editing = { id: number | null; form: BillInput; cn?: CnMeta }

const cnMeta = (b: Bill): CnMeta => ({
  no: b.credit_note_no ?? '', date: b.credit_note_date ?? b.cancelled_at ?? today(), reason: b.cancel_reason ?? '',
  invoiceNo: b.invoice_no ?? '', invoiceDate: b.invoice_date ?? '',
})

const card: React.CSSProperties = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16, marginBottom: 14 }
const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }
const lbl: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.8rem', fontWeight: 600, color: '#334155' }
const inr = (n: number) => `₹${money2(n)}`

const companyBadge = (c: BillCompany) => (
  <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 700, whiteSpace: 'nowrap', background: c === 'ncrc' ? '#ede9fe' : '#e0f2fe', color: c === 'ncrc' ? '#6d28d9' : '#0369a1' }}>
    {COMPANIES[c].short}
  </span>
)

export function BillingPage({ uidFilter = '', onClearUidFilter, createForUid = '', onCreateHandled, mode = 'invoices' }: BillingPageProps) {
  const isCn = mode === 'credit_notes'
  const [notice, setNotice] = useState('')
  useTracking('billing')
  const [list, setList] = useState<Bill[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [company, setCompany] = useState<'' | BillCompany>('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [editing, setEditing] = useState<Editing | null>(null)
  /** Company chooser before a new bill; `uid` fills the client from that registration */
  const [choosing, setChoosing] = useState<{ uid: string } | null>(() => (createForUid ? { uid: createForUid } : null))

  const [version, setVersion] = useState(0)
  const reload = useCallback(() => setVersion((v) => v + 1), [])

  useEffect(() => {
    let cancelled = false
    const params: Record<string, string> = {}
    if (!isCn && start) params.start_date = start
    if (!isCn && end) params.end_date = end
    billsApi.list(params)
      .then((res) => { if (!cancelled) { setList(res.data); setError('') } })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load bills') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [start, end, version, isCn])

  // The page mounts fresh when opened from Registrations; the request is taken in the initial state above
  useEffect(() => {
    if (createForUid) onCreateHandled?.()
  }, [createForUid, onCreateHandled])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const uid = uidFilter.trim().toLowerCase()
    const cnDate = (b: Bill) => b.credit_note_date || b.cancelled_at || ''
    return list.filter((b) =>
      // Cancelled invoices leave the Invoice list and show under Credit Note
      (!isCn || inCreditNotes(b)) &&
      (!isCn || ((!start || cnDate(b) >= start) && (!end || cnDate(b) <= end))) &&
      (!company || b.company === company) &&
      (!uid || (b.uid_no ?? '').trim().toLowerCase() === uid) &&
      (!q || [b.invoice_no, b.uid_no, b.client_name, b.client_address, b.work_order_no, b.report_no, b.credit_note_no]
        .some((v) => (v ?? '').toLowerCase().includes(q))))
  }, [list, search, company, uidFilter, isCn, start, end])

  /** Print chooser: with / without sign (and invoice / credit note for a cancelled invoice) */
  const [printing, setPrinting] = useState<{ bill: Bill; cnOnly?: boolean } | null>(null)
  /** Cancel popup; `cnOnly` = already cancelled, only the credit note is being made */
  const [cancelling, setCancelling] = useState<{ bill: Bill; cnOnly: boolean } | null>(null)

  const restore = async (b: Bill) => {
    if (!window.confirm(`Undo the cancellation of invoice ${b.invoice_no ?? ''}? It moves back to the Invoice list.${b.credit_note_no ? ` Credit note ${b.credit_note_no} will be removed.` : ''}`)) return
    try {
      await billsApi.restore(b.id)
      setNotice(`Invoice ${b.invoice_no ?? ''} is active again and back in the Invoice list.`)
      reload()
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Could not undo')
    }
  }

  const startNew = async (c: BillCompany, uid: string) => {
    setChoosing(null)
    const form = emptyBill(c)
    if (uid) {
      form.uid_no = uid
      try {
        const { data } = await billsApi.fromRegistration(uid)
        Object.assign(form, {
          uid_date: data.uid_date ?? '',
          client_name: data.client_name,
          client_address: data.client_address,
          client_gstin: data.client_gstin,
          work_order_no: data.work_order_no,
          report_no: data.report_no,
          advance: data.advance || '',
        })
        if (data.name_of_work) form.items = [{ ...emptyItem(c), description: data.name_of_work }]
      } catch { /* no registration: keep the UID only */ }
    }
    setEditing({ id: null, form })
  }

  const openEdit = async (id: number) => {
    try {
      const { data } = await billsApi.get(id)
      setEditing({ id, form: billToInput(data) })
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Could not open the invoice')
    }
  }

  const remove = async (b: Bill) => {
    if (!window.confirm(`Delete invoice ${b.invoice_no ?? ''} (${b.client_name ?? ''})?`)) return
    try {
      await billsApi.remove(b.id)
      reload()
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Could not delete')
    }
  }

  const exportCsv = () => {
    const head = ['Date', 'Invoice No', 'Company', 'UID', 'Client', 'Net Amount', 'Received', 'Due', 'Received Date', 'Mode', 'Status', 'Credit Note No', 'Credit Note Date', 'Remark']
    const rows = filtered.map((b) => [dotDate(b.invoice_date), b.invoice_no, COMPANIES[b.company].short, b.uid_no, b.client_name, b.net_amount, b.amount_received, b.due_amount, dotDate(b.received_date), b.payment_mode, b.cancelled ? 'Cancelled' : 'Active', b.credit_note_no, dotDate(b.credit_note_date), b.remark])
    const csv = [head, ...rows].map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' }))
    a.download = `${isCn ? 'credit-notes' : 'invoices'}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  if (editing) {
    return (
      <BillEditor
        key={`${editing.id ?? 'new'}-${editing.cn ? 'cn' : 'inv'}`}
        id={editing.id}
        initial={editing.form}
        cn={editing.cn}
        onClose={(changed) => { setEditing(null); if (changed) reload() }}
      />
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 260px' }}>
          <Search size={16} style={{ position: 'absolute', left: 10, top: 11, color: '#82909a' }} />
          <input className="input" style={{ paddingLeft: 32 }} placeholder="Search invoice no., UID, client, work order, report no., credit note..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {!isCn ? <select className="input" style={{ width: 170 }} value={company} onChange={(e) => setCompany(e.target.value as '' | BillCompany)}>
          <option value="">All companies</option>
          <option value="ncrc">NCRC Pvt Ltd</option>
          <option value="ncs">NCS LLP</option>
        </select> : null}
        <DateRangeFilter start={start} end={end} onApply={(s, e) => { setStart(s); setEnd(e) }} onClear={() => { setStart(''); setEnd('') }} />
      </div>

      {notice ? (
        <p style={{ margin: '0 0 12px', padding: '8px 12px', borderRadius: 8, background: '#f0fdf4', color: '#166534', fontSize: '0.85rem', display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ flex: 1 }}>{notice}</span>
          <button type="button" className="ghost-button" onClick={() => setNotice('')}><X size={14} /></button>
        </p>
      ) : null}

      {uidFilter && !isCn ? (
        <p style={{ margin: '0 0 12px', padding: '8px 12px', borderRadius: 8, background: '#eff6ff', color: '#1e40af', fontSize: '0.85rem', display: 'flex', gap: 8, alignItems: 'center' }}>
          Showing invoices for UID <b>{uidFilter}</b>
          <button type="button" className="ghost-button" onClick={() => setChoosing({ uid: uidFilter })}><Plus size={14} /> New invoice for this UID</button>
          <button type="button" className="ghost-button" onClick={onClearUidFilter}><X size={14} /> Show all</button>
        </p>
      ) : null}

      <section className="surface">
        <div className="surface-heading">
          <div><p className="section-label">Accounts</p><h2>{isCn ? 'Credit Notes' : 'Invoices'} ({filtered.length})</h2></div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-outline" onClick={exportCsv} disabled={!filtered.length}><Download size={16} /> Export</button>
            {!isCn ? <button type="button" className="btn btn-primary" onClick={() => setChoosing({ uid: '' })}><Plus size={16} /> Create Invoice</button> : null}
          </div>
        </div>
        {error ? <p style={{ color: '#b91c1c', margin: '0 0 12px' }}>{error} <button type="button" className="ghost-button" onClick={() => { setLoading(true); reload() }}>Retry</button></p> : null}
        {isCn ? <CreditNoteTable rows={filtered} loading={loading} empty={!list.some(inCreditNotes)} onPrint={(b) => setPrinting({ bill: b })} onMakeCn={(b) => setCancelling({ bill: b, cnOnly: true })} onEdit={(b) => setEditing({ id: b.id, form: creditNoteInput(b), cn: cnMeta(b) })} onRestore={(b) => void restore(b)} /> : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ minWidth: 1000 }}>
            <thead>
              <tr>
                <th>Date</th><th>Invoice No</th><th>Company</th><th>UID</th><th>Client</th>
                <th style={{ textAlign: 'right' }}>Net Amount</th><th style={{ textAlign: 'right' }}>Received</th><th style={{ textAlign: 'right' }}>Due</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9} className="empty-state">{loading ? 'Loading invoices…' : list.length === 0 ? 'No invoices yet. Click “Create Invoice” to make the first one.' : 'No invoices match the filters.'}</td></tr>
              ) : filtered.map((b) => (
                <tr key={b.id} style={b.cancelled ? { background: '#fef2f2' } : undefined}>
                  <td style={{ whiteSpace: 'nowrap' }}>{dotDate(b.invoice_date) || '-'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <span style={{ fontWeight: 700, color: b.cancelled ? '#94a3b8' : '#2563eb', textDecoration: b.cancelled ? 'line-through' : undefined }}>{b.invoice_no || '-'}</span>
                    {b.cancelled ? <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#dc2626' }} title={b.cancel_reason ?? ''}>Cancelled{b.credit_note_no ? ` · CN ${b.credit_note_no}` : ''}</div> : null}
                  </td>
                  <td>{companyBadge(b.company)}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{b.uid_no || '-'}</td>
                  <td style={{ minWidth: 200, maxWidth: 320, whiteSpace: 'normal' }}>{b.client_name || '-'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>{inr(b.net_amount)}</td>
                  <td style={{ textAlign: 'right', color: '#16a34a', whiteSpace: 'nowrap' }}>{b.amount_received ? inr(b.amount_received) : '-'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: b.cancelled ? '#94a3b8' : b.due_amount > 0 ? '#dc2626' : '#16a34a', whiteSpace: 'nowrap' }}>{b.cancelled ? '-' : b.due_amount > 0 ? inr(b.due_amount) : 'Paid'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="icon-button" type="button" title="Print / PDF" onClick={() => setPrinting({ bill: b })}><Printer size={16} /></button>
                    <button className="icon-button" type="button" title="Edit / record payment" onClick={() => void openEdit(b.id)}><Pencil size={16} /></button>
                    {b.cancelled ? (
                      <button className="icon-button" type="button" title="Undo cancel" onClick={() => void restore(b)}><RotateCcw size={16} /></button>
                    ) : b.company === 'ncs' ? (
                      <button className="icon-button" type="button" title="Cancel invoice (moves to Credit Note)" onClick={() => setCancelling({ bill: b, cnOnly: false })}><Ban size={16} /></button>
                    ) : null}
                    <button className="icon-button" type="button" title="Delete" onClick={() => void remove(b)}><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </section>

      {choosing ? (
        <Modal title="Create Invoice" subtitle={choosing.uid ? `For UID ${choosing.uid}` : 'Which company is this invoice from?'} onClose={() => setChoosing(null)} size="sm" footer={null}>
          <div style={{ display: 'grid', gap: 12 }}>
            {(['ncs', 'ncrc'] as BillCompany[]).map((c) => (
              <button key={c} type="button" onClick={() => void startNew(c, choosing.uid)}
                style={{ textAlign: 'left', padding: '14px 16px', borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a' }}>{COMPANIES[c].short}</div>
                <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: 2 }}>
                  {COMPANIES[c].name} · {c === 'ncs' ? 'Tax invoice with GST' : 'Invoice without GST'}
                </div>
              </button>
            ))}
          </div>
        </Modal>
      ) : null}

      {printing ? <PrintChooser bill={printing.bill} cnOnly={printing.cnOnly} onClose={() => setPrinting(null)} /> : null}

      {cancelling ? (
        <CancelInvoice
          bill={cancelling.bill}
          cnOnly={cancelling.cnOnly}
          onClose={() => setCancelling(null)}
          onDone={(bill, madeCn) => {
            setCancelling(null)
            if (!isCn) setNotice(bill.company === 'ncs'
              ? `Invoice ${bill.invoice_no ?? ''} cancelled${madeCn ? ` — credit note ${bill.credit_note_no ?? ''} made` : ''}. It also shows under Credit Note.`
              : `Invoice ${bill.invoice_no ?? ''} cancelled.`)
            reload()
            if (madeCn) setEditing({ id: bill.id, form: creditNoteInput(bill), cn: cnMeta(bill) })
          }}
        />
      ) : null}
    </div>
  )
}

/** Credit notes exist only for NCS LLP: a cancelled LLP invoice moves to the Credit Note menu,
 *  a cancelled NCRC invoice stays in the Invoice list marked Cancelled */
const inCreditNotes = (b: Bill) => b.cancelled && b.company === 'ncs'

function CreditNoteTable({ rows, loading, empty, onPrint, onMakeCn, onEdit, onRestore }: {
  rows: Bill[]; loading: boolean; empty: boolean
  onPrint: (b: Bill) => void; onMakeCn: (b: Bill) => void; onEdit: (b: Bill) => void; onRestore: (b: Bill) => void
}) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="data-table" style={{ minWidth: 1000 }}>
        <thead>
          <tr>
            <th>CN Date</th><th>Credit Note No</th><th>Against Invoice</th><th>Company</th><th>UID</th><th>Client</th>
            <th style={{ textAlign: 'right' }}>Amount</th><th>Reason</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={9} className="empty-state">{loading ? 'Loading credit notes…' : empty ? 'No credit notes yet. Cancelling an invoice moves it here.' : 'No credit notes match the filters.'}</td></tr>
          ) : rows.map((b) => (
            <tr key={b.id}>
              <td style={{ whiteSpace: 'nowrap' }}>{dotDate(b.credit_note_date || b.cancelled_at) || '-'}</td>
              <td style={{ whiteSpace: 'nowrap', fontWeight: 700, color: b.credit_note_no ? '#dc2626' : '#94a3b8' }}>
                {b.credit_note_no || 'Not made yet'}
              </td>
              <td style={{ whiteSpace: 'nowrap' }}>
                <div style={{ fontWeight: 600 }}>{b.invoice_no || '-'}</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{dotDate(b.invoice_date)}</div>
              </td>
              <td>{companyBadge(b.company)}</td>
              <td style={{ whiteSpace: 'nowrap' }}>{b.uid_no || '-'}</td>
              <td style={{ minWidth: 180, maxWidth: 300, whiteSpace: 'normal' }}>{b.client_name || '-'}</td>
              <td style={{ textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>{inr(b.credit_amount)}</td>
              <td style={{ maxWidth: 220, whiteSpace: 'normal', fontSize: '0.82rem', color: '#475569' }}>{b.cancel_reason || '-'}</td>
              <td style={{ whiteSpace: 'nowrap' }}>
                <button className="icon-button" type="button" title="Print / PDF" onClick={() => onPrint(b)}><Printer size={16} /></button>
                {b.credit_note_no
                  ? <button className="icon-button" type="button" title="Edit credit note" onClick={() => onEdit(b)}><Pencil size={16} /></button>
                  : <button className="icon-button" type="button" title="Make credit note" onClick={() => onMakeCn(b)}><FileMinus size={16} /></button>}
                <button className="icon-button" type="button" title="Undo cancel (back to Invoice)" onClick={() => onRestore(b)}><RotateCcw size={16} /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const choiceBtn: React.CSSProperties = { flex: 1, padding: '12px 14px', borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }

/** One Print button → choose With Sign / Without Sign (and Credit Note / Invoice when a credit note exists) */
function PrintChooser({ bill, cnOnly = false, onClose }: { bill: Bill; cnOnly?: boolean; onClose: () => void }) {
  const cn: CreditNote | null = bill.company === 'ncs' && bill.credit_note_no ? { no: bill.credit_note_no, date: bill.credit_note_date ?? '' } : null
  const go = (withSeal: boolean, asCn: boolean) => {
    openBillPrint(asCn && cn ? creditNoteInput(bill) : billToInput(bill), withSeal, asCn && cn ? cn : undefined)
    onClose()
  }
  const row = (asCn: boolean) => (
    <div style={{ display: 'flex', gap: 10 }}>
      <button type="button" style={{ ...choiceBtn, borderColor: '#2563eb', color: '#1d4ed8' }} onClick={() => go(true, asCn)}><Stamp size={18} /> With Sign</button>
      <button type="button" style={choiceBtn} onClick={() => go(false, asCn)}><Printer size={18} /> Without Sign</button>
    </div>
  )
  const heading = (text: string, sub: string) => (
    <div style={{ margin: '0 0 8px', display: 'flex', alignItems: 'baseline', gap: 8 }}>
      <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>{text}</strong>
      <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{sub}</span>
    </div>
  )
  // Only the credit note (right after cancelling), or a choice between credit note and the original invoice
  const title = cn && cnOnly ? 'Print Credit Note' : cn ? 'Print / PDF' : 'Print Invoice'
  return (
    <Modal title={title} subtitle={`${COMPANIES[bill.company].short} · ${bill.client_name ?? ''}`} onClose={onClose} size="sm" footer={null}>
      {cn && cnOnly ? (
        <>{heading('Credit Note', `${cn.no} · against invoice ${bill.invoice_no ?? ''}`)}{row(true)}</>
      ) : cn ? (
        <div style={{ display: 'grid', gap: 18 }}>
          <div>{heading('Credit Note', cn.no)}{row(true)}</div>
          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 14 }}>{heading('Original Invoice (cancelled)', bill.invoice_no ?? '')}{row(false)}</div>
        </div>
      ) : (
        <>{heading('Invoice', bill.invoice_no ?? '')}{row(false)}</>
      )}
    </Modal>
  )
}

/** Cancel popup: asks whether to make a credit note and, if so, its number (typed by hand) */
function CancelInvoice({ bill, cnOnly, onClose, onDone }: { bill: Bill; cnOnly: boolean; onClose: () => void; onDone: (bill: Bill, madeCreditNote: boolean) => void }) {
  const [reason, setReason] = useState('')
  const [makeCn, setMakeCn] = useState(true)
  const [cnNo, setCnNo] = useState('')
  const [cnDate, setCnDate] = useState(today())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const fy = (bill.invoice_no ?? '').split('/')[0] || '2026-27'
  const canCn = bill.company === 'ncs'
  const withCn = canCn && (cnOnly || makeCn)

  const submit = async () => {
    if (withCn && !cnNo.trim()) { setError('Enter the credit note number.'); return }
    setSaving(true)
    setError('')
    try {
      const res = await billsApi.cancel(bill.id, { reason, credit_note: withCn, credit_note_no: withCn ? cnNo.trim() : undefined, credit_note_date: withCn ? cnDate : undefined })
      onDone(res.data, withCn)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not cancel the invoice')
      setSaving(false)
    }
  }

  return (
    <Modal
      title={cnOnly ? 'Make credit note' : 'Cancel invoice'}
      subtitle={`${COMPANIES[bill.company].short} · ${bill.invoice_no ?? ''} · ${bill.client_name ?? ''} · ${inr(bill.net_amount)}`}
      onClose={onClose}
      size="sm"
      onSave={() => void submit()}
      saving={saving}
      saveLabel={cnOnly ? 'Make credit note' : withCn ? 'Cancel & make credit note' : 'Cancel invoice'}
      cancelLabel="Close"
    >
      <div style={{ display: 'grid', gap: 12 }}>
        {!cnOnly ? (
          <>
            <label style={lbl}>Reason (optional)
              <textarea className="input" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} style={{ resize: 'vertical', fontFamily: 'inherit' }} />
            </label>
            {canCn ? (
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 600, cursor: 'pointer' }}>
                <input type="checkbox" checked={makeCn} onChange={(e) => setMakeCn(e.target.checked)} /> Make a credit note for this invoice
              </label>
            ) : null}
          </>
        ) : null}
        {withCn ? (
          <div style={grid}>
            <label style={lbl}>Credit Note No. *
              <input className="input" autoFocus value={cnNo} placeholder={`${fy}/CN-01`} onChange={(e) => setCnNo(e.target.value)} />
            </label>
            <label style={lbl}>Dated
              <input className="input" type="date" value={cnDate} onChange={(e) => setCnDate(e.target.value)} />
            </label>
          </div>
        ) : null}
        {error ? <p style={{ margin: 0, color: '#b91c1c', fontSize: '0.85rem' }}>{error}</p> : null}
      </div>
    </Modal>
  )
}

// ─── UID search ─────────────────────────────────────────────────────────

interface UidHit { uid_no: string; agency_name: string; name_of_work?: string }

/** UID box that searches registrations by UID / client / mobile as you type; picking one fills the client */
function UidSearch({ value, busy, onChange, onPick }: { value: string; busy: boolean; onChange: (v: string) => void; onPick: (uid: string) => void }) {
  const [hits, setHits] = useState<{ q: string; rows: UidHit[] }>({ q: '', rows: [] })
  const [open, setOpen] = useState(false)
  const q = value.trim()

  useEffect(() => {
    if (q.length < 2) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      request<{ data: UidHit[] }>(`/registrations/search-customers?q=${encodeURIComponent(q)}`)
        .then((res) => { if (!cancelled) setHits({ q, rows: res.data.filter((r) => r.uid_no) }) })
        .catch(() => { if (!cancelled) setHits({ q, rows: [] }) })
    }, 250)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [q])

  const rows = open && q.length >= 2 && hits.q === q ? hits.rows : []
  return (
    <div style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <Search size={15} style={{ position: 'absolute', left: 10, top: 11, color: '#82909a' }} />
        <input
          className="input"
          style={{ paddingLeft: 30 }}
          value={value}
          placeholder="Search UID or client…"
          onChange={(e) => { onChange(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => { if (e.key === 'Enter' && q) { e.preventDefault(); setOpen(false); onPick(q) } }}
        />
        {busy ? <span style={{ position: 'absolute', right: 10, top: 10, fontSize: '0.8rem', color: '#64748b' }}>…</span> : null}
      </div>
      {rows.length ? (
        <div style={{ position: 'absolute', zIndex: 20, top: '100%', left: 0, right: 0, marginTop: 4, maxHeight: 260, overflowY: 'auto', background: '#fff', border: '1px solid #cbd5e1', borderRadius: 8, boxShadow: '0 8px 24px rgba(15,23,42,0.12)' }}>
          {rows.map((r) => (
            <button
              key={r.uid_no}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); setOpen(false); onPick(r.uid_no) }}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', border: 0, borderBottom: '1px solid #f1f5f9', background: '#fff', cursor: 'pointer' }}
            >
              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1d4ed8' }}>{r.uid_no}</div>
              <div style={{ fontSize: '0.78rem', color: '#475569', fontWeight: 400 }}>{r.agency_name}{r.name_of_work ? ` · ${r.name_of_work}` : ''}</div>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

// ─── Editor ──────────────────────────────────────────────────────────────

function BillEditor({ id, initial, cn, onClose }: { id: number | null; initial: BillInput; cn?: CnMeta; onClose: (changed: boolean) => void }) {
  const [form, setForm] = useState<BillInput>(initial)
  // Credit note mode: its own number / date / reason; the rest is the credit note's own copy of the document
  const [cnNo, setCnNo] = useState(cn?.no ?? '')
  const [cnDate, setCnDate] = useState(cn?.date ?? '')
  const [reason, setReason] = useState(cn?.reason ?? '')
  const [savedId, setSavedId] = useState<number | null>(id)
  const [saving, setSaving] = useState(false)
  const [changed, setChanged] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [uidBusy, setUidBusy] = useState(false)
  /** Invoice no. typed by hand: stop replacing it with the suggestion */
  const manualNo = useRef(Boolean(id))
  const co = COMPANIES[form.company]
  const isNcs = form.company === 'ncs'
  const t = calcBill(form)

  const set = <K extends keyof BillInput>(key: K, value: BillInput[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    setDirty(true)
  }
  const setItem = (i: number, patch: Partial<BillItem>) => {
    setForm((f) => ({ ...f, items: f.items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) }))
    setDirty(true)
  }
  const numVal = (v: string): number | '' => (v === '' ? '' : Number(v))

  // Suggest the next number in the company's series for the bill date's financial year
  useEffect(() => {
    if (manualNo.current) return
    let cancelled = false
    billsApi.nextNumber(form.company, form.invoice_date || '')
      .then((res) => { if (!cancelled && !manualNo.current) setForm((f) => ({ ...f, invoice_no: res.data })) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [form.company, form.invoice_date])

  const fillFromUid = async (picked?: string) => {
    const uid = (picked ?? form.uid_no).trim()
    if (!uid) return
    setUidBusy(true)
    setError('')
    try {
      const { data } = await billsApi.fromRegistration(uid)
      setForm((f) => ({
        ...f,
        uid_date: data.uid_date ?? f.uid_date,
        client_name: data.client_name || f.client_name,
        client_address: data.client_address || f.client_address,
        client_gstin: data.client_gstin || f.client_gstin,
        work_order_no: f.work_order_no || data.work_order_no,
        report_no: f.report_no || data.report_no,
        advance: f.advance || data.advance || '',
        items: f.items.length === 1 && !f.items[0].description.trim() && data.name_of_work
          ? [{ ...f.items[0], description: data.name_of_work }] : f.items,
      }))
      setDirty(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No registration found for this UID.')
    } finally {
      setUidBusy(false)
    }
  }

  const save = async (): Promise<boolean> => {
    setSaving(true)
    setError('')
    try {
      if (cn && savedId) {
        if (!cnNo.trim()) { setError('Enter the credit note number.'); return false }
        const saved = await billsApi.saveCreditNote(savedId, { ...form, credit_note_no: cnNo.trim(), credit_note_date: cnDate, reason })
        setForm(creditNoteInput(saved.data))
        setChanged(true)
        setDirty(false)
        setNotice(`Saved credit note ${saved.data.credit_note_no ?? ''}.`)
        return true
      }
      const res = savedId ? await billsApi.update(savedId, form) : await billsApi.create(form)
      setSavedId(res.data.id)
      manualNo.current = true
      setForm(billToInput(res.data))
      setChanged(true)
      setDirty(false)
      setNotice(`Saved invoice ${res.data.invoice_no ?? ''}.`)
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : cn ? 'Could not save the credit note' : 'Could not save the invoice')
      return false
    } finally {
      setSaving(false)
    }
  }

  /** Print opens first (pop-up blockers allow it only straight from the click), then the bill is saved */
  const saveAndPrint = (withSeal: boolean) => {
    openBillPrint(form, withSeal, cn ? { no: cnNo.trim(), date: cnDate } : undefined)
    void save()
  }

  const close = () => {
    if (dirty && !window.confirm('Leave without saving the changes?')) return
    onClose(changed)
  }

  const dateField = (label: string, key: 'invoice_date' | 'uid_date' | 'work_order_date' | 'report_date' | 'received_date') => (
    <label style={lbl}>{label}<input className="input" type="date" value={form[key]} onChange={(e) => set(key, e.target.value)} /></label>
  )
  const textField = (label: string, key: 'work_order_no' | 'report_no' | 'sac_code' | 'client_gstin' | 'payment_mode', placeholder = '') => (
    <label style={lbl}>{label}<input className="input" value={form[key]} placeholder={placeholder} onChange={(e) => set(key, e.target.value)} /></label>
  )

  // Amount summary in the same order as the printed invoice
  const summaryRows: [string, number][] = [
    ['Total Amount', t.subtotal],
    ...(isNcs ? [['CGST @ 9%', t.cgst], ['SGST @ 9%', t.sgst], ['IGST @ 18%', t.igst]] as [string, number][] : []),
    ['Transportation Exp. & Other Exp.', t.transport],
    ['Total Amount', t.total],
    ...(cn ? [] : [['Advance Amount', t.advance]] as [string, number][]),
  ]

  return (
    <div style={{ maxWidth: 1150, margin: '0 auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 10, padding: '6px 0 24px' }}>
        <button type="button" onClick={close} style={{ justifySelf: 'start', display: 'inline-flex', alignItems: 'center', gap: 6, border: 0, background: 'none', padding: 0, color: '#475569', fontWeight: 600, cursor: 'pointer' }}><ArrowLeft size={16} /> Back</button>
        <h2 style={{ margin: 0, fontSize: '1.1rem', textAlign: 'center', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          {cn ? `Credit Note ${cnNo}` : savedId ? `Invoice ${form.invoice_no}` : 'New invoice'} {companyBadge(form.company)}
          {cn ? <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 500 }}>against invoice {cn.invoiceNo}</span> : null}
          {dirty ? <span style={{ fontSize: '0.75rem', color: '#b45309', fontWeight: 600 }}>● Unsaved</span> : null}
        </h2>
        <span />
      </div>
      {notice ? <p style={{ margin: '0 0 12px', padding: '8px 12px', borderRadius: 8, background: '#f0fdf4', color: '#166534', fontSize: '0.85rem' }}>{notice}</p> : null}
      {error ? <p style={{ margin: '0 0 12px', padding: '8px 12px', borderRadius: 8, background: '#fef2f2', color: '#b91c1c', fontSize: '0.85rem' }}>{error}</p> : null}

      {/* Company + references */}
      <div style={card}>
        <div style={grid}>
          {cn ? (
            <>
              <label style={lbl}>Credit Note No. *
                <input className="input" value={cnNo} placeholder="2026-27/CN-01" onChange={(e) => { setCnNo(e.target.value); setDirty(true) }} />
              </label>
              <label style={lbl}>Credit Note Dated
                <input className="input" type="date" value={cnDate} onChange={(e) => { setCnDate(e.target.value); setDirty(true) }} />
              </label>
              <label style={lbl}>Against Invoice<input className="input" value={cn.invoiceNo} readOnly style={{ background: '#f8fafc' }} /></label>
              <label style={lbl}>Invoice Dated<input className="input" value={dotDate(cn.invoiceDate)} readOnly style={{ background: '#f8fafc' }} /></label>
            </>
          ) : (
            <>
              <label style={lbl}>Invoice No.
                <input className="input" value={form.invoice_no} placeholder="2026-27/0001" onChange={(e) => { manualNo.current = true; set('invoice_no', e.target.value) }} />
              </label>
              {dateField('Dated', 'invoice_date')}
            </>
          )}
          {textField(co.orderLabel, 'work_order_no')}
          {dateField(`${co.orderLabel} Dated`, 'work_order_date')}
          {textField('Report No', 'report_no')}
          {dateField('Report Dated', 'report_date')}
          {/* NCRC bills (Excel 0001) have no UID and a fixed SAC code */}
          {isNcs ? (
            <>
              <label style={lbl}>UID No
                <UidSearch
                  value={form.uid_no}
                  busy={uidBusy}
                  onChange={(v) => set('uid_no', v)}
                  onPick={(uid) => { set('uid_no', uid); void fillFromUid(uid) }}
                />
              </label>
              {dateField('UID Dated', 'uid_date')}
            </>
          ) : null}
          <label style={lbl}>Terms of Delivery
            <input className="input" value={form.terms_of_delivery} onChange={(e) => set('terms_of_delivery', e.target.value)} />
          </label>
        </div>
        {cn ? (
          <label style={{ ...lbl, marginTop: 12 }}>Reason (kept with the credit note, not printed)
            <input className="input" value={reason} onChange={(e) => { setReason(e.target.value); setDirty(true) }} />
          </label>
        ) : null}
      </div>

      {/* Client box */}
      <div style={card}>
        <p className="section-label" style={{ marginTop: 0 }}>{cn ? 'Issued to' : 'Bill to (client box)'}</p>
        <div style={grid}>
          <label style={lbl}>Client / Agency name<input className="input" value={form.client_name} placeholder="PERPETUAL INFRA" onChange={(e) => set('client_name', e.target.value)} /></label>
          {textField('Client GSTIN', 'client_gstin', isNcs ? '08XXXXXXXXXXXXX' : 'Optional')}
        </div>
        <label style={{ ...lbl, marginTop: 12 }}>Address
          <textarea className="input" rows={3} value={form.client_address} placeholder="Plot No. 23, Kalyan Colony, Sikar House, Jaipur, Rajasthan, 302016" onChange={(e) => set('client_address', e.target.value)} style={{ resize: 'vertical', fontFamily: 'inherit' }} />
        </label>
      </div>

      {/* Items */}
      <div style={card}>
        <p className="section-label" style={{ marginTop: 0 }}>Particulars</p>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ minWidth: 820 }}>
            <thead>
              <tr>
                <th style={{ width: 40 }}>Sr.</th>
                <th>Particular</th>
                <th style={{ width: 80 }}>{isNcs ? 'Qty (Unit)' : 'Qty'}</th>
                <th style={{ width: 120 }}>Rate (Per Unit)</th>
                <th style={{ width: 80 }}>Dis. %</th>
                <th style={{ width: 120, textAlign: 'right' }}>Amount</th>
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {form.items.map((it, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td><textarea className="input" rows={2} value={it.description} onChange={(e) => setItem(i, { description: e.target.value })} style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit' }} /></td>
                  <td><input className="input" type="number" min={0} step="any" value={it.qty} onChange={(e) => setItem(i, { qty: numVal(e.target.value) })} /></td>
                  <td><input className="input" type="number" min={0} step="any" value={it.rate} onChange={(e) => setItem(i, { rate: numVal(e.target.value) })} /></td>
                  <td><input className="input" type="number" min={0} max={100} step="any" value={it.discount} onChange={(e) => setItem(i, { discount: numVal(e.target.value) })} /></td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{money2(itemAmount(it))}</td>
                  <td>
                    {form.items.length > 1 ? (
                      <button className="icon-button" type="button" title="Remove row" onClick={() => { setForm((f) => ({ ...f, items: f.items.filter((_, idx) => idx !== i) })); setDirty(true) }}><Trash2 size={15} /></button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="button" className="ghost-button" style={{ marginTop: 8 }} onClick={() => { setForm((f) => ({ ...f, items: [...f.items, emptyItem(f.company)] })); setDirty(true) }}><Plus size={14} /> Add row</button>
      </div>

      {/* Totals + payment */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
        <div style={card}>
          <p className="section-label" style={{ marginTop: 0 }}>Amounts</p>
          <div style={grid}>
            <label style={lbl}>Transportation &amp; Other Exp.<input className="input" type="number" min={0} step="any" value={form.transport} onChange={(e) => set('transport', numVal(e.target.value))} /></label>
            {!cn ? <label style={lbl}>Advance Amount<input className="input" type="number" min={0} step="any" value={form.advance} onChange={(e) => set('advance', numVal(e.target.value))} /></label> : null}
            {isNcs ? (
              <label style={lbl}>GST
                <select className="input" value={form.gst_type} onChange={(e) => set('gst_type', e.target.value as BillInput['gst_type'])}>
                  <option value="intra">CGST 9% + SGST 9% (Rajasthan)</option>
                  <option value="inter">IGST 18% (outside Rajasthan)</option>
                  <option value="none">No GST</option>
                </select>
              </label>
            ) : null}
          </div>
          {/* Plain rows (not a table: the app's table styles stretch it past the card) */}
          <div style={{ marginTop: 14, fontSize: '0.92rem', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
            {summaryRows.map(([k, v], i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '7px 12px', borderBottom: '1px solid #f1f5f9', background: k.includes('GST') ? '#fafbff' : '#fff' }}>
                <span style={{ color: '#475569' }}>{k}</span>
                <span style={{ fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap' }}>{money2(v)}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 12px', background: '#eff6ff' }}>
              <span style={{ fontWeight: 700 }}>{cn ? 'Total Credit' : isNcs ? 'Net Due Amount' : 'Net Due Amount (Round off)'}</span>
              <span style={{ fontWeight: 800, fontSize: '1.05rem', color: '#1d4ed8', whiteSpace: 'nowrap' }}>{inr(cn ? Math.round(t.total) : t.net)}</span>
            </div>
          </div>
        </div>

        {!cn ? <div style={card}>
          <p className="section-label" style={{ marginTop: 0 }}>Payment received</p>
          <div style={grid}>
            <label style={lbl}>Amount Received<input className="input" type="number" min={0} step="any" value={form.amount_received} onChange={(e) => set('amount_received', numVal(e.target.value))} /></label>
            {dateField('Received Date', 'received_date')}
            {textField('Mode', 'payment_mode', 'NEFT / Cheque / Cash / UPI')}
          </div>
          <label style={{ ...lbl, marginTop: 12 }}>Remark
            <textarea className="input" rows={2} value={form.remark} onChange={(e) => set('remark', e.target.value)} style={{ resize: 'vertical', fontFamily: 'inherit' }} />
          </label>
          <p style={{ margin: '12px 0 0', fontWeight: 700, color: t.due > 0 ? '#dc2626' : '#16a34a' }}>
            {t.due > 0 ? `Due: ${inr(t.due)}` : 'Fully paid'}
          </p>
        </div> : null}
      </div>

      {/* Save, then save & print with / without sign */}
      <div style={{ ...card, display: 'grid', gap: 12, borderColor: '#c7d2fe', background: '#fafbff' }}>
        <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void save()} style={{ justifyContent: 'center', width: '100%' }}>
          <Save size={16} /> {saving ? 'Saving…' : 'Save'}
        </button>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <strong style={{ flex: 1, minWidth: 200 }}>Save and print / PDF</strong>
          <button type="button" className="btn btn-outline" disabled={saving} onClick={() => saveAndPrint(true)}><Stamp size={16} /> With Sign</button>
          <button type="button" className="btn btn-outline" disabled={saving} onClick={() => saveAndPrint(false)}><Printer size={16} /> Without Sign</button>
        </div>
      </div>
    </div>
  )
}
