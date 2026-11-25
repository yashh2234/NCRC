import { useCallback, useEffect, useMemo, useState } from 'react'
import { ClipboardCheck, Download, Mail, Pencil, Plus, Printer, Search, Stamp, Trash2 } from 'lucide-react'
import { DateRangeFilter } from '../components/DateRangeFilter'
import { Modal } from '../components/Modal'
import { QuotationEditor } from '../components/QuotationEditor'
import { QuotationReview } from '../components/QuotationReview'
import { COMPANIES, dotDate, money2, type BillCompany } from '../lib/bills'
import { useAuth } from '../lib/auth'
import { openMailWindow, quotationMailUrl } from '../lib/mailTab'
import { openPrintWindow, printQuotation } from '../lib/quotationPrint'
import { canUserAccess } from '../lib/roleConfig'
import {
  QUOTATION_COMPANY_KEYS, QUOTATION_STATUSES, emptyQuotation, quotationToInput, quotationsApi,
  type Quotation, type QuotationApproval, type QuotationInput, type QuotationStatus,
} from '../lib/quotations'
import { useTracking } from '../lib/useTracking'

type Editing = { id: number | null; form: QuotationInput; approval: QuotationApproval | null; remark?: string | null }

const message = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback)

/** The actions stay in view when the table is wider than the screen */
const stickyRight: React.CSSProperties = { position: 'sticky', right: 0, background: '#fff' }

const companyBadge = (c: BillCompany) => (
  <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 700, whiteSpace: 'nowrap', background: c === 'ncrc' ? '#ede9fe' : '#e0f2fe', color: c === 'ncrc' ? '#6d28d9' : '#0369a1' }}>
    {COMPANIES[c].short}
  </span>
)

export default function QuotationsPage() {
  useTracking('quotations')
  const [list, setList] = useState<Quotation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'' | QuotationStatus>('')
  const [company, setCompany] = useState<'' | BillCompany>('')
  const [choosing, setChoosing] = useState(false)
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [editing, setEditing] = useState<Editing | null>(null)
  const [printing, setPrinting] = useState<{ quotation: Quotation; mail: boolean } | null>(null)
  const { user } = useAuth()
  const canMail = canUserAccess(user, 'mail')
  const canApprove = canUserAccess(user, 'quotation_approve')
  const [onlyWaiting, setOnlyWaiting] = useState(false)
  const [reviewing, setReviewing] = useState<Quotation | null>(null)
  const [version, setVersion] = useState(0)
  const reload = useCallback(() => setVersion((v) => v + 1), [])

  useEffect(() => {
    let cancelled = false
    quotationsApi.list()
      .then((res) => { if (!cancelled) { setList(res.data); setError('') } })
      .catch((e) => { if (!cancelled) setError(message(e, 'Could not load quotations')) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [version])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return list.filter((r) =>
      (!company || r.company === company) &&
      (!onlyWaiting || r.approval !== 'approved') &&
      (!status || r.status === status) &&
      (!start || r.date >= start) && (!end || r.date <= end) &&
      (!q || [r.quotation_no, r.client_name, r.subject, r.location, r.mobile_no].some((v) => (v ?? '').toLowerCase().includes(q))))
  }, [list, search, company, status, start, end, onlyWaiting])
  const waiting = list.filter((r) => r.approval !== 'approved').length
  const openEditor = (r: Quotation) => setEditing({ id: r.id, form: quotationToInput(r), approval: r.approval, remark: r.approval_remark })

  const changeStatus = async (row: Quotation, next: QuotationStatus) => {
    try {
      const { data } = await quotationsApi.setStatus(row.id, next)
      setList((rows) => rows.map((r) => (r.id === data.id ? data : r)))
    } catch (e) {
      window.alert(message(e, 'Could not change the status'))
    }
  }

  const remove = async (row: Quotation) => {
    if (!window.confirm(`Delete quotation ${row.quotation_no} (${row.client_name})?`)) return
    try {
      await quotationsApi.remove(row.id)
      reload()
    } catch (e) {
      window.alert(message(e, 'Could not delete'))
    }
  }

  /** With / without sign is asked only when the company has a seal */
  const print = (row: Quotation) => {
    if (COMPANIES[row.company].seal) { setPrinting({ quotation: row, mail: false }); return }
    const w = openPrintWindow()
    if (w) printQuotation(w, quotationToInput(row), false)
  }

  const mail = (row: Quotation) => {
    if (COMPANIES[row.company].seal) setPrinting({ quotation: row, mail: true })
    else openMailWindow(quotationMailUrl(row.id, false))
  }

  // Back from the mail tab: a mailed draft is Sent now
  useEffect(() => {
    window.addEventListener('focus', reload)
    return () => window.removeEventListener('focus', reload)
  }, [reload])

  const exportCsv = () => {
    const head = ['Date', 'Quotation No', 'Company', 'Client', 'Subject', 'Site / Location', 'Sub Total', 'Discount', 'GST', 'Transport', 'Total', 'Valid Till', 'Status']
    const rows = filtered.map((r) => [dotDate(r.date), r.quotation_no, COMPANIES[r.company].short, r.client_name, r.subject, r.location, r.total_amount, r.discount, r.tax_amount, r.transport, r.net_amount, dotDate(r.valid_until), r.status])
    const csv = [head, ...rows].map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' }))
    a.download = `quotations-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  if (editing) {
    return (
      <QuotationEditor
        key={editing.id ?? 'new'}
        id={editing.id}
        initial={editing.form}
        approval={editing.approval}
        approvalRemark={editing.remark}
        others={list}
        onClose={(changed) => { setEditing(null); if (changed) reload() }}
      />
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 260px' }}>
          <Search size={16} style={{ position: 'absolute', left: 10, top: 11, color: '#82909a' }} />
          <input className="input" style={{ paddingLeft: 32 }} aria-label="Search quotations" placeholder="Search quotation no., client, subject, location, mobile..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input" style={{ width: 160 }} aria-label="Filter by company" value={company} onChange={(e) => setCompany(e.target.value as '' | BillCompany)}>
          <option value="">All companies</option>
          {QUOTATION_COMPANY_KEYS.map((c) => <option key={c} value={c}>{COMPANIES[c].short}</option>)}
        </select>
        <select className="input" style={{ width: 150 }} aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value as '' | QuotationStatus)}>
          <option value="">All status</option>
          {QUOTATION_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <DateRangeFilter start={start} end={end} onApply={(s, e) => { setStart(s); setEnd(e) }} onClear={() => { setStart(''); setEnd('') }} />
      </div>

      <section className="surface">
        <div className="surface-heading">
          <div><p className="section-label">Clients</p><h2>Quotations ({filtered.length})</h2></div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {waiting || onlyWaiting ? <button type="button" className={`btn ${onlyWaiting ? 'btn-primary' : 'btn-outline'}`} onClick={() => setOnlyWaiting((v) => !v)}><ClipboardCheck size={16} /> Not approved ({waiting})</button> : null}
            <button type="button" className="btn btn-outline" onClick={exportCsv} disabled={!filtered.length}><Download size={16} /> Export</button>
            <button type="button" className="btn btn-primary" onClick={() => setChoosing(true)}><Plus size={16} /> Create Quotation</button>
          </div>
        </div>
        {error ? <p style={{ color: '#b91c1c', margin: '0 0 12px' }}>{error} <button type="button" className="ghost-button" onClick={() => { setLoading(true); reload() }}>Retry</button></p> : null}
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table data-table--tight" style={{ minWidth: 1000 }}>
            <thead>
              <tr><th>Date</th><th>Quotation No</th><th>Company</th><th>Client</th><th>Subject</th><th style={{ textAlign: 'right' }}>Total</th><th>Valid Till</th><th>Status</th><th style={stickyRight}>Actions</th></tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9} className="empty-state">{loading ? 'Loading quotations…' : list.length === 0 ? 'No quotations yet. Click “Create Quotation” to make the first one.' : 'No quotations match the filters.'}</td></tr>
              ) : filtered.map((r) => (
                <tr key={r.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{dotDate(r.date)}</td>
                  <td style={{ whiteSpace: 'nowrap', fontWeight: 700, color: '#2563eb' }}>
                    {r.quotation_no}
                    {r.approval !== 'approved' ? (
                      <div title={r.approval_remark ?? ''} style={{ maxWidth: 190, overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.72rem', fontWeight: 600, color: r.approval === 'returned' ? '#b91c1c' : '#92400e' }}>
                        {r.approval === 'returned' ? `Sent back: ${r.approval_remark ?? ''}` : `Waiting for approval${r.approval_requested_by_name ? ` · ${r.approval_requested_by_name}` : ''}`}
                      </div>
                    ) : null}
                  </td>
                  <td>{companyBadge(r.company)}</td>
                  <td style={{ minWidth: 120, maxWidth: 260, whiteSpace: 'normal' }}>{r.client_name}</td>
                  <td style={{ minWidth: 120, maxWidth: 320, whiteSpace: 'normal' }}>{r.subject || '-'}{r.location ? <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{r.location}</div> : null}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>₹{money2(r.net_amount)}{r.gst_mode === 'extra' ? <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 500 }}>+ GST</div> : null}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{dotDate(r.valid_until) || '-'}</td>
                  <td>
                    <select className="input" aria-label={`Status of ${r.quotation_no}`} value={r.status} onChange={(e) => void changeStatus(r, e.target.value as QuotationStatus)}
                      style={{ width: 118, minHeight: 32, padding: '2px 8px', fontSize: '0.8rem', fontWeight: 600, background: '#fff', color: '#0f172a' }}>
                      {QUOTATION_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                    </select>
                  </td>
                  <td style={{ ...stickyRight, whiteSpace: 'nowrap' }}>
                    {canApprove && r.approval !== 'approved' ? <button className="icon-button" type="button" title="Check and approve" onClick={() => setReviewing(r)} style={{ color: '#15803d', borderColor: '#bbf7d0', background: '#f0fdf4' }}><ClipboardCheck size={16} /></button> : null}
                    <button className="icon-button" type="button" title={r.approval === 'approved' ? 'Print / PDF' : 'Can be printed after approval'} disabled={r.approval !== 'approved'} onClick={() => print(r)}><Printer size={16} /></button>
                    {canMail ? <button className="icon-button" type="button" title={r.approval === 'approved' ? 'Mail the PDF' : 'Can be mailed after approval'} disabled={r.approval !== 'approved'} onClick={() => mail(r)}><Mail size={16} /></button> : null}
                    <button className="icon-button" type="button" title="Edit" onClick={() => openEditor(r)}><Pencil size={16} /></button>
                    <button className="icon-button" type="button" title="Delete" onClick={() => void remove(r)}><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {choosing ? (
        <Modal title="Create Quotation" subtitle="Which company is this quotation from?" onClose={() => setChoosing(false)} size="sm" footer={null}>
          <div style={{ display: 'grid', gap: 12 }}>
            {QUOTATION_COMPANY_KEYS.map((c) => (
              <button key={c} type="button" onClick={() => { setChoosing(false); setEditing({ id: null, form: emptyQuotation(c), approval: null }) }}
                style={{ textAlign: 'left', padding: '14px 16px', borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a' }}>{COMPANIES[c].short}</div>
                <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: 2 }}>{COMPANIES[c].name} · {c === 'ncs' ? 'GST @ 18%' : 'Without GST'}</div>
              </button>
            ))}
          </div>
        </Modal>
      ) : null}

      {reviewing ? (
        <QuotationReview
          quotation={reviewing}
          onClose={() => setReviewing(null)}
          onEdit={() => { openEditor(reviewing); setReviewing(null) }}
          onDone={(q) => { setList((rows) => rows.map((r) => (r.id === q.id ? q : r))); setReviewing(null) }}
        />
      ) : null}

      {printing ? <PrintChooser quotation={printing.quotation} mail={printing.mail} onClose={() => setPrinting(null)} /> : null}
    </div>
  )
}

const choiceBtn: React.CSSProperties = { flex: 1, padding: '12px 14px', borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }

function PrintChooser({ quotation, mail, onClose }: { quotation: Quotation; mail: boolean; onClose: () => void }) {
  const go = (withSign: boolean) => {
    if (mail) openMailWindow(quotationMailUrl(quotation.id, withSign))
    else {
      const w = openPrintWindow()
      if (w) printQuotation(w, quotationToInput(quotation), withSign)
    }
    onClose()
  }
  return (
    <Modal title={mail ? 'Mail Quotation' : 'Print Quotation'} subtitle={`${quotation.quotation_no} · ${quotation.client_name}`} onClose={onClose} size="sm" footer={null}>
      <div style={{ display: 'flex', gap: 10 }}>
        <button type="button" style={{ ...choiceBtn, borderColor: '#2563eb', color: '#1d4ed8' }} onClick={() => go(true)}><Stamp size={18} /> With Sign</button>
        <button type="button" style={choiceBtn} onClick={() => go(false)}>{mail ? <Mail size={18} /> : <Printer size={18} />} Without Sign</button>
      </div>
    </Modal>
  )
}
