import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Download, Pencil, Plus, Printer, Save, Search, Stamp, Trash2 } from 'lucide-react'
import { DateRangeFilter } from '../components/DateRangeFilter'
import { Modal } from '../components/Modal'
import { Req } from '../components/ui'
import { openPerformaPrint } from '../lib/billPrint'
import { COMPANIES, billsApi, calcBill, dotDate, emptyItem, itemAmount, money2, type BillInput, type BillItem } from '../lib/bills'
import { emptyPerforma, performaApi, performaToInput, type Performa } from '../lib/performa'
import { useTracking } from '../lib/useTracking'
import { UidSearch } from './BillingPage'

type Editing = { id: number | null; form: BillInput }

const card: React.CSSProperties = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16, marginBottom: 14 }
const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }
const lbl: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.8rem', fontWeight: 600, color: '#334155' }
const area: React.CSSProperties = { resize: 'vertical', fontFamily: 'inherit' }
const choiceBtn: React.CSSProperties = { flex: 1, padding: '12px 14px', borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }
const inr = (n: number) => `₹${money2(n)}`
const message = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback)

/** Performa invoices of NCS LLP */
export function PerformaPage() {
  useTracking('performa')
  const [list, setList] = useState<Performa[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [editing, setEditing] = useState<Editing | null>(null)
  const [printing, setPrinting] = useState<Performa | null>(null)
  const [version, setVersion] = useState(0)
  const reload = useCallback(() => setVersion((v) => v + 1), [])

  useEffect(() => {
    let cancelled = false
    performaApi.list()
      .then((res) => { if (!cancelled) { setList(res.data); setError('') } })
      .catch((e) => { if (!cancelled) setError(message(e, 'Could not load performa invoices')) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [version])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return list.filter((p) =>
      (!start || (p.invoice_date ?? '') >= start) && (!end || (p.invoice_date ?? '') <= end) &&
      (!q || [p.invoice_no, p.uid_no, p.client_name, p.client_address, p.work_order_no, p.report_no].some((v) => (v ?? '').toLowerCase().includes(q))))
  }, [list, search, start, end])

  const remove = async (p: Performa) => {
    if (!window.confirm(`Delete performa invoice ${p.invoice_no ?? ''} (${p.client_name ?? ''})?`)) return
    try {
      await performaApi.remove(p.id)
      reload()
    } catch (e) {
      window.alert(message(e, 'Could not delete'))
    }
  }

  const exportCsv = () => {
    const head = ['Date', 'Performa No', 'UID', 'Client', 'Total Amount', 'CGST', 'SGST', 'IGST', 'Transport & Other Exp.', 'Net Due Amount', 'Remark']
    const rows = filtered.map((p) => [dotDate(p.invoice_date), p.invoice_no, p.uid_no, p.client_name, p.subtotal, p.cgst, p.sgst, p.igst, p.transport, p.net_amount, p.remark])
    const csv = [head, ...rows].map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' }))
    a.download = `performa-invoices-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  if (editing) {
    return (
      <PerformaEditor
        key={editing.id ?? 'new'}
        id={editing.id}
        initial={editing.form}
        onClose={(changed) => { setEditing(null); if (changed) reload() }}
      />
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 260px' }}>
          <Search size={16} style={{ position: 'absolute', left: 10, top: 11, color: '#82909a' }} />
          <input className="input" style={{ paddingLeft: 32 }} aria-label="Search performa invoices" placeholder="Search performa no., UID, client, letter no., report no..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <DateRangeFilter start={start} end={end} onApply={(s, e) => { setStart(s); setEnd(e) }} onClear={() => { setStart(''); setEnd('') }} />
      </div>

      <section className="surface">
        <div className="surface-heading">
          <div><p className="section-label">Accounts</p><h2>Performa Invoices ({filtered.length})</h2></div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-outline" onClick={exportCsv} disabled={!filtered.length}><Download size={16} /> Export</button>
            <button type="button" className="btn btn-primary" onClick={() => setEditing({ id: null, form: emptyPerforma() })}><Plus size={16} /> Create Performa Invoice</button>
          </div>
        </div>
        {error ? <p style={{ color: '#b91c1c', margin: '0 0 12px' }}>{error} <button type="button" className="ghost-button" onClick={() => { setLoading(true); reload() }}>Retry</button></p> : null}
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ minWidth: 900 }}>
            <thead>
              <tr><th>Date</th><th>Performa No</th><th>UID</th><th>Client</th><th style={{ textAlign: 'right' }}>Total Amount</th><th style={{ textAlign: 'right' }}>GST</th><th style={{ textAlign: 'right' }}>Net Due Amount</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="empty-state">{loading ? 'Loading performa invoices…' : list.length === 0 ? 'No performa invoices yet. Click “Create Performa Invoice” to make the first one.' : 'No performa invoices match the filters.'}</td></tr>
              ) : filtered.map((p) => (
                <tr key={p.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{dotDate(p.invoice_date) || '-'}</td>
                  <td style={{ whiteSpace: 'nowrap', fontWeight: 700, color: '#2563eb' }}>{p.invoice_no}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{p.uid_no || '-'}</td>
                  <td style={{ minWidth: 200, maxWidth: 320, whiteSpace: 'normal' }}>{p.client_name || '-'}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{inr(p.subtotal)}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{inr(p.cgst + p.sgst + p.igst)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>{inr(p.net_amount)}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="icon-button" type="button" title="Print / PDF" onClick={() => setPrinting(p)}><Printer size={16} /></button>
                    <button className="icon-button" type="button" title="Edit" onClick={() => setEditing({ id: p.id, form: performaToInput(p) })}><Pencil size={16} /></button>
                    <button className="icon-button" type="button" title="Delete" onClick={() => void remove(p)}><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {printing ? (
        <Modal title="Print Performa Invoice" subtitle={`${printing.invoice_no ?? ''} · ${printing.client_name ?? ''}`} onClose={() => setPrinting(null)} size="sm" footer={null}>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" style={{ ...choiceBtn, borderColor: '#2563eb', color: '#1d4ed8' }} onClick={() => { openPerformaPrint(performaToInput(printing), true); setPrinting(null) }}><Stamp size={18} /> With Sign</button>
            <button type="button" style={choiceBtn} onClick={() => { openPerformaPrint(performaToInput(printing), false); setPrinting(null) }}><Printer size={18} /> Without Sign</button>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}

function PerformaEditor({ id, initial, onClose }: { id: number | null; initial: BillInput; onClose: (changed: boolean) => void }) {
  const [form, setForm] = useState<BillInput>(initial)
  const [savedId, setSavedId] = useState<number | null>(id)
  const [saving, setSaving] = useState(false)
  const [changed, setChanged] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [uidBusy, setUidBusy] = useState(false)
  /** Number typed by hand: stop replacing it with the suggestion */
  const manualNo = useRef(Boolean(id))
  const co = COMPANIES.ncs
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

  // Suggest the next number of the year of the date
  useEffect(() => {
    if (manualNo.current) return
    let cancelled = false
    performaApi.nextNumber(form.invoice_date)
      .then((res) => { if (!cancelled && !manualNo.current) setForm((f) => ({ ...f, invoice_no: res.data })) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [form.invoice_date])

  const showError = (text: string) => {
    setError(text)
    setNotice('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const fillFromUid = async (uid: string) => {
    if (!uid.trim()) return
    setUidBusy(true)
    setError('')
    try {
      const { data } = await billsApi.fromRegistration(uid.trim())
      setForm((f) => ({
        ...f,
        uid_date: data.uid_date ?? f.uid_date,
        client_name: data.client_name || f.client_name,
        client_address: data.client_address || f.client_address,
        client_gstin: data.client_gstin || f.client_gstin,
        work_order_no: f.work_order_no || data.work_order_no,
        report_no: f.report_no || data.report_no,
        items: f.items.length === 1 && !f.items[0].description.trim() && data.name_of_work
          ? [{ ...f.items[0], description: data.name_of_work }] : f.items,
      }))
      setDirty(true)
    } catch (e) {
      showError(message(e, 'No registration found for this UID.'))
    } finally {
      setUidBusy(false)
    }
  }

  const check = (): string => {
    if (!form.invoice_date) return 'Enter the date.'
    if (!form.client_name.trim()) return 'Enter the client name.'
    if (!form.items.some((it) => it.description.trim() || Number(it.rate))) return 'Enter at least one particular.'
    return ''
  }

  const save = async (): Promise<BillInput | null> => {
    const problem = check()
    if (problem) { showError(problem); return null }
    setSaving(true)
    setError('')
    try {
      // The suggested number may have been used meanwhile on another computer: the server then gives the next free one
      const payload = manualNo.current ? form : { ...form, invoice_no: '' }
      const { data } = savedId ? await performaApi.update(savedId, payload) : await performaApi.create(payload)
      const saved = performaToInput(data)
      setSavedId(data.id)
      manualNo.current = true
      setForm(saved)
      setChanged(true)
      setDirty(false)
      setNotice(`Saved performa invoice ${data.invoice_no ?? ''}.`)
      return saved
    } catch (e) {
      showError(message(e, 'Could not save the performa invoice'))
      return null
    } finally {
      setSaving(false)
    }
  }

  /** The window opens straight from the click (pop-up blockers) and is filled once it is saved */
  const saveAndPrint = async (withSign: boolean) => {
    const problem = check()
    if (problem) { showError(problem); return }
    const w = window.open('', '_blank')
    const saved = await save()
    if (saved) openPerformaPrint(saved, withSign, w)
    else w?.close()
  }

  const close = () => {
    if (dirty && !window.confirm('Leave without saving the changes?')) return
    onClose(changed)
  }

  const dateField = (label: string, key: 'uid_date' | 'work_order_date' | 'report_date') => (
    <label style={lbl}>{label}<input className="input" type="date" value={form[key]} onChange={(e) => set(key, e.target.value)} /></label>
  )
  const textField = (label: string, key: 'work_order_no' | 'report_no' | 'terms_of_delivery' | 'client_gstin', placeholder = '') => (
    <label style={lbl}>{label}<input className="input" value={form[key]} placeholder={placeholder} onChange={(e) => set(key, e.target.value)} /></label>
  )

  // Same order as the print
  const summaryRows: [string, number][] = [
    ['Total Amount', t.subtotal], ['CGST @ 9%', t.cgst], ['SGST @ 9%', t.sgst], ['IGST @ 18%', t.igst],
    ['Transportation Exp. & Other Exp.', t.transport],
  ]

  return (
    <div style={{ maxWidth: 1150, margin: '0 auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 10, padding: '6px 0 24px' }}>
        <button type="button" onClick={close} style={{ justifySelf: 'start', display: 'inline-flex', alignItems: 'center', gap: 6, border: 0, background: 'none', padding: 0, color: '#475569', fontWeight: 600, cursor: 'pointer' }}><ArrowLeft size={16} /> Back</button>
        <h2 style={{ margin: 0, fontSize: '1.1rem', textAlign: 'center' }}>
          {savedId ? `Performa Invoice ${form.invoice_no}` : 'New performa invoice'}
          <span style={{ marginLeft: 8, fontSize: '0.8rem', color: '#64748b', fontWeight: 500 }}>{co.short}</span>
          {dirty ? <span style={{ marginLeft: 8, fontSize: '0.75rem', color: '#b45309', fontWeight: 600 }}>● Unsaved</span> : null}
        </h2>
        <span />
      </div>
      {notice ? <p style={{ margin: '0 0 12px', padding: '8px 12px', borderRadius: 8, background: '#f0fdf4', color: '#166534', fontSize: '0.85rem' }}>{notice}</p> : null}
      {error ? <p role="alert" style={{ margin: '0 0 12px', padding: '8px 12px', borderRadius: 8, background: '#fef2f2', color: '#b91c1c', fontSize: '0.85rem' }}>{error}</p> : null}

      <div style={card}>
        <div style={grid}>
          <label style={lbl}>Performa Invoice No.
            <input className="input" value={form.invoice_no} placeholder="PI/2026/0001" onChange={(e) => { manualNo.current = true; set('invoice_no', e.target.value) }} />
          </label>
          <label style={lbl}><span>Dated<Req /></span><input className="input" type="date" value={form.invoice_date} onChange={(e) => set('invoice_date', e.target.value)} /></label>
          {textField(co.orderLabel, 'work_order_no')}
          {dateField(`${co.orderLabel} Dated`, 'work_order_date')}
          {textField('Report No', 'report_no')}
          {dateField('Report Dated', 'report_date')}
          <label style={lbl}>UID No
            <UidSearch value={form.uid_no} busy={uidBusy} onChange={(v) => set('uid_no', v)} onPick={(uid) => { set('uid_no', uid); void fillFromUid(uid) }} />
          </label>
          {dateField('UID Dated', 'uid_date')}
          {textField('Terms of Delivery', 'terms_of_delivery')}
        </div>
      </div>

      <div style={card}>
        <p className="section-label" style={{ marginTop: 0 }}>Bill to (client box)</p>
        <div style={grid}>
          <label style={lbl}><span>Client / Agency name<Req /></span><input className="input" value={form.client_name} placeholder="PTI POWER SOLUTION" onChange={(e) => set('client_name', e.target.value)} /></label>
          {textField('Client GSTIN', 'client_gstin', '08XXXXXXXXXXXXX')}
        </div>
        <label style={{ ...lbl, marginTop: 12 }}>Address
          <textarea className="input" rows={3} value={form.client_address} onChange={(e) => set('client_address', e.target.value)} style={area} />
        </label>
      </div>

      <div style={card}>
        <p className="section-label" style={{ marginTop: 0 }}>Particulars</p>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ minWidth: 820 }}>
            <thead>
              <tr>
                <th style={{ width: 40 }}>Sr.</th><th>Particular<Req /></th><th style={{ width: 110 }}>Quantity (Unit)</th><th style={{ width: 130 }}>Rate (Per Unit)</th>
                <th style={{ width: 90 }}>Dis. %</th><th style={{ width: 120, textAlign: 'right' }}>Amount</th><th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {form.items.map((it, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td><textarea className="input" rows={2} value={it.description} aria-label={`Particular ${i + 1}`} onChange={(e) => setItem(i, { description: e.target.value })} style={{ ...area, width: '100%' }} /></td>
                  <td><input className="input" type="number" min={0} step="any" value={it.qty} aria-label={`Quantity ${i + 1}`} onChange={(e) => setItem(i, { qty: numVal(e.target.value) })} /></td>
                  <td><input className="input" type="number" min={0} step="any" value={it.rate} aria-label={`Rate ${i + 1}`} onChange={(e) => setItem(i, { rate: numVal(e.target.value) })} /></td>
                  <td><input className="input" type="number" min={0} max={100} step="any" value={it.discount} aria-label={`Discount ${i + 1}`} onChange={(e) => setItem(i, { discount: numVal(e.target.value) })} /></td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{money2(itemAmount(it))}</td>
                  <td>{form.items.length > 1 ? <button className="icon-button" type="button" title="Remove row" onClick={() => { setForm((f) => ({ ...f, items: f.items.filter((_, idx) => idx !== i) })); setDirty(true) }}><Trash2 size={15} /></button> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="button" className="ghost-button" style={{ marginTop: 8 }} onClick={() => { setForm((f) => ({ ...f, items: [...f.items, emptyItem('ncs')] })); setDirty(true) }}><Plus size={14} /> Add row</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
        <div style={card}>
          <p className="section-label" style={{ marginTop: 0 }}>Amounts</p>
          <div style={grid}>
            <label style={lbl}>Transportation &amp; Other Exp.<input className="input" type="number" min={0} step="any" value={form.transport} onChange={(e) => set('transport', numVal(e.target.value))} /></label>
            <label style={lbl}>GST 18%
              <select className="input" value={form.gst_type} onChange={(e) => set('gst_type', e.target.value as BillInput['gst_type'])}>
                <option value="intra">CGST 9% + SGST 9% (Rajasthan)</option>
                <option value="inter">IGST 18% (outside Rajasthan)</option>
              </select>
            </label>
          </div>
          <div style={{ marginTop: 14, fontSize: '0.92rem', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
            {summaryRows.map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '7px 12px', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: '#475569' }}>{k}</span><span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{money2(v)}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 12px', background: '#eff6ff' }}>
              <span style={{ fontWeight: 700 }}>Net Due Amount</span>
              <span style={{ fontWeight: 800, fontSize: '1.05rem', color: '#1d4ed8', whiteSpace: 'nowrap' }}>{inr(Math.round(t.total))}</span>
            </div>
          </div>
        </div>
        <div style={card}>
          <label style={lbl}>Remark (for the office, not printed)
            <textarea className="input" rows={4} value={form.remark} onChange={(e) => set('remark', e.target.value)} style={area} />
          </label>
        </div>
      </div>

      <div style={{ ...card, display: 'grid', gap: 12, borderColor: '#c7d2fe', background: '#fafbff' }}>
        <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void save()} style={{ justifyContent: 'center', width: '100%' }}>
          <Save size={16} /> {saving ? 'Saving…' : 'Save'}
        </button>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <strong style={{ flex: 1, minWidth: 200 }}>Save and print / PDF</strong>
          <button type="button" className="btn btn-outline" disabled={saving} onClick={() => void saveAndPrint(true)}><Stamp size={16} /> With Sign</button>
          <button type="button" className="btn btn-outline" disabled={saving} onClick={() => void saveAndPrint(false)}><Printer size={16} /> Without Sign</button>
        </div>
      </div>
    </div>
  )
}
