import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowLeft, ArrowUp, Mail, Plus, Printer, Save, Stamp, Trash2, X } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { COMPANIES, money2 } from '../lib/bills'
import { openMailWindow, quotationMailUrl } from '../lib/mailTab'
import { openPrintWindow, printQuotation } from '../lib/quotationPrint'
import {
  SECTION_TITLES, UNITS, calcQuotation, companyGst, emptyHeading, emptyQuotationItem, emptySection, itemNumbers, itemUsed, oneMonthAfter, quotationItemAmount, quotationLines, quotationToInput, quotationsApi,
  type ItemPart, type Quotation, type QuotationApproval, type QuotationInput, type QuotationItem, type QuotationSection, type SectionStyle,
} from '../lib/quotations'
import { canUserAccess } from '../lib/roleConfig'
import { Req } from './ui'
import { Select } from './Select'
import { ComboInput } from './ComboInput'

const card: React.CSSProperties = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16, marginBottom: 14 }
const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }
const lbl: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.8rem', fontWeight: 600, color: '#334155' }
const area: React.CSSProperties = { width: '100%', resize: 'vertical', fontFamily: 'inherit' }

const SECTION_STYLES: { key: SectionStyle; label: string }[] = [
  { key: 'numbers', label: 'Numbered points' },
  { key: 'bullets', label: 'Bullet points' },
  { key: 'text', label: 'Paragraph' },
]

const OTHER = '__other'
/** A unit that is not in the list is typed */
const otherUnit = (it: QuotationItem) => Boolean(it.unitOther) || !UNITS.includes(it.unit)

/** Moves the entry at `i` one place up (-1) or down (+1) */
function moved<T>(rows: T[], i: number, by: -1 | 1): T[] {
  const next = [...rows]
  next.splice(i + by, 0, ...next.splice(i, 1))
  return next
}

type TextKey = 'client_name' | 'client_gstin' | 'contact_person' | 'mobile_no' | 'email' | 'location' | 'ref_no' | 'prepared_by' | 'signatory_name' | 'signatory_designation'

interface QuotationEditorProps {
  id: number | null
  initial: QuotationInput
  /** null for a new one */
  approval: QuotationApproval | null
  approvalRemark?: string | null
  /** All quotations, to copy sections from */
  others: Quotation[]
  onClose: (changed: boolean) => void
}

export function QuotationEditor({ id, initial, approval: initialApproval, approvalRemark, others, onClose }: QuotationEditorProps) {
  const [form, setForm] = useState<QuotationInput>(() => ({ ...initial, gst_mode: companyGst(initial.company) }))
  const [savedId, setSavedId] = useState<number | null>(id)
  const idRef = useRef(id)
  const [saving, setSaving] = useState(false)
  const [changed, setChanged] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  /** Typed by hand: stop replacing with the suggestion */
  const manualNo = useRef(Boolean(id))
  const manualValid = useRef(Boolean(id))
  const { user } = useAuth()
  const canMail = canUserAccess(user, 'mail')
  const canApprove = canUserAccess(user, 'quotation_approve')
  const [approval, setApproval] = useState(initialApproval)
  const isNcs = form.company === 'ncs'
  /** Made before GST was fixed at 18%: opening it shows the new total, so say so before it is saved */
  const [gstChanged, setGstChanged] = useState(Boolean(id) && initial.gst_mode !== companyGst(initial.company))
  const t = calcQuotation(form)

  const patch = (changes: Partial<QuotationInput>) => {
    setForm((f) => ({ ...f, ...changes }))
    setDirty(true)
  }
  const setItem = (i: number, changes: Partial<QuotationItem>) => patch({ items: form.items.map((it, idx) => (idx === i ? { ...it, ...changes } : it)) })
  const setPart = (i: number, p: number, changes: Partial<ItemPart>) => setItem(i, { extra: form.items[i].extra.map((part, idx) => (idx === p ? { ...part, ...changes } : part)) })
  const addRow = (row: QuotationItem) => patch({ items: [...form.items, row] })
  const numbers = itemNumbers(form.items)
  const setSection = (i: number, changes: Partial<QuotationSection>) => patch({ sections: form.sections.map((s, idx) => (idx === i ? { ...s, ...changes } : s)) })
  const numVal = (v: string): number | '' => (v === '' ? '' : Number(v))

  // Suggest the next number; its year follows the quotation date
  useEffect(() => {
    if (manualNo.current) return
    let cancelled = false
    quotationsApi.nextNumber(form.company, form.date)
      .then((res) => { if (!cancelled && !manualNo.current) setForm((f) => ({ ...f, quotation_no: res.data })) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [form.company, form.date])

  const showError = (text: string) => {
    setError(text)
    setNotice('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const check = (): string => {
    if (!form.client_name.trim()) return 'Enter the client name.'
    if (!form.date) return 'Enter the quotation date.'
    const used = form.items.filter((it) => it.kind === 'item' && itemUsed(it))
    if (!used.length) return 'Add at least one item.'
    if (used.some((it) => !it.description.trim())) return 'Enter the description of work for every item.'
    if (t.discount > t.subtotal) return 'Discount cannot be more than the sub total.'
    return ''
  }

  const save = async (): Promise<QuotationInput | null> => {
    const problem = check()
    if (problem) { showError(problem); return null }
    setSaving(true)
    setError('')
    setNotice('')
    try {
      // The suggested number may have been used meanwhile on another computer: the server then gives the next free one
      const payload = manualNo.current ? form : { ...form, quotation_no: '' }
      const { data } = savedId ? await quotationsApi.update(savedId, payload) : await quotationsApi.create(payload)
      const saved = quotationToInput(data)
      setApproval(data.approval)
      setSavedId(data.id)
      idRef.current = data.id
      manualNo.current = true
      manualValid.current = true
      setForm(saved)
      setChanged(true)
      setDirty(false)
      setGstChanged(false)
      setNotice(data.approval === 'pending' ? `Saved quotation ${data.quotation_no}. It waits for approval; after that it can be printed and mailed.` : `Saved quotation ${data.quotation_no}.`)
      return saved
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Could not save the quotation')
      return null
    } finally {
      setSaving(false)
    }
  }

  /** The window opens straight from the click (pop-up blockers) and is filled once the quotation is saved */
  const saveAndPrint = async (withSign: boolean) => {
    const problem = check()
    if (problem) { showError(problem); return }
    const w = openPrintWindow()
    // Others only get here with an approved quotation they did not change
    const saved = canApprove ? await save() : form
    if (!w) return
    if (saved) printQuotation(w, saved, withSign)
    else w.close()
  }

  /** The mail is written in a tab of its own: opened from the click, filled once the quotation is saved */
  const saveAndMail = async (withSign: boolean) => {
    const problem = check()
    if (problem) { showError(problem); return }
    const w = openMailWindow()
    const saved = canApprove ? await save() : form
    if (!w) return
    if (saved && idRef.current) w.location.href = quotationMailUrl(idRef.current, withSign)
    else w.close()
  }

  const copySections = (fromId: string) => {
    const from = others.find((q) => String(q.id) === fromId)
    if (from) patch({ sections: [...form.sections, ...from.sections.map((s) => ({ ...s }))] })
  }

  const close = () => {
    if (dirty && !window.confirm('Leave without saving the changes?')) return
    onClose(changed)
  }

  const text = (label: React.ReactNode, key: TextKey, placeholder = '') => (
    <label style={lbl}><span>{label}</span><input className="input" type={key === 'email' ? 'email' : 'text'} value={form[key]} placeholder={placeholder} onChange={(e) => patch({ [key]: e.target.value })} /></label>
  )

  const rowButtons = (i: number, removeTitle: string) => (
    <>
      <button className="icon-button" type="button" title="Move up" disabled={i === 0} onClick={() => patch({ items: moved(form.items, i, -1) })}><ArrowUp size={14} /></button>
      <button className="icon-button" type="button" title="Move down" disabled={i === form.items.length - 1} onClick={() => patch({ items: moved(form.items, i, 1) })}><ArrowDown size={14} /></button>
      {form.items.length > 1 ? <button className="icon-button" type="button" title={removeTitle} onClick={() => patch({ items: form.items.filter((_, idx) => idx !== i) })}><Trash2 size={14} /></button> : null}
    </>
  )

  // Amount summary in the same order as the print
  const summaryRows: [string, string][] = [['Sub Total', money2(t.subtotal)], ...quotationLines(form, money2).map(([k, v]): [string, string] => [k, v])]
  /** What an approver saves is approved; the others print and mail only what is approved and saved */
  const locked = !canApprove && (approval !== 'approved' || dirty || gstChanged)
  const withSections = others.filter((q) => q.sections.length && q.id !== savedId)

  return (
    <div style={{ maxWidth: 1150, margin: '0 auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 10, padding: '6px 0 24px' }}>
        <button type="button" onClick={close} style={{ justifySelf: 'start', display: 'inline-flex', alignItems: 'center', gap: 6, border: 0, background: 'none', padding: 0, color: '#475569', fontWeight: 600, cursor: 'pointer' }}><ArrowLeft size={16} /> Back</button>
        <h2 style={{ margin: 0, fontSize: '1.1rem', textAlign: 'center' }}>
          {savedId ? `Quotation ${form.quotation_no}` : 'New quotation'}
          <span style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 700, background: isNcs ? '#e0f2fe' : '#ede9fe', color: isNcs ? '#0369a1' : '#6d28d9' }}>{COMPANIES[form.company].short}</span>
          {dirty ? <span style={{ marginLeft: 8, fontSize: '0.75rem', color: '#b45309', fontWeight: 600 }}>● Unsaved</span> : null}
        </h2>
        <span />
      </div>
      {notice ? <p style={{ margin: '0 0 12px', padding: '8px 12px', borderRadius: 8, background: '#f0fdf4', color: '#166534', fontSize: '0.85rem' }}>{notice}</p> : null}
      {error ? <p role="alert" style={{ margin: '0 0 12px', padding: '8px 12px', borderRadius: 8, background: '#fef2f2', color: '#b91c1c', fontSize: '0.85rem' }}>{error}</p> : null}

      {approval === 'pending' && !canApprove ? <p style={{ margin: '0 0 12px', padding: '8px 12px', borderRadius: 8, background: '#fffbeb', color: '#92400e', fontSize: '0.85rem' }}>Waiting for approval. It can be printed and mailed after that.</p> : null}
      {approval === 'returned' ? <p style={{ margin: '0 0 12px', padding: '8px 12px', borderRadius: 8, background: '#fef2f2', color: '#b91c1c', fontSize: '0.85rem' }}>Sent back: <strong>{approvalRemark || 'please correct it'}</strong>{canApprove ? '' : '. Correct it and save; it then goes for approval again.'}</p> : null}
      {approval !== null && approval !== 'approved' && canApprove ? <p style={{ margin: '0 0 12px', padding: '8px 12px', borderRadius: 8, background: '#eff6ff', color: '#1e40af', fontSize: '0.85rem' }}>This quotation is not approved yet. Saving it approves it.</p> : null}
      {gstChanged ? <p style={{ margin: '0 0 12px', padding: '8px 12px', borderRadius: 8, background: '#fffbeb', color: '#92400e', fontSize: '0.85rem' }}>This quotation was saved without 18% GST. The total below includes it, and saving will change the quotation. Go back without saving to keep it as it was.</p> : null}


      <div style={card}>
        <p className="section-label" style={{ marginTop: 0 }}>Quotation</p>
        <div style={grid}>
          <label style={lbl}>Quotation No.
            <input className="input" value={form.quotation_no} placeholder={isNcs ? 'NCS/2026/1058' : 'NCRC/2026/0001'} onChange={(e) => { manualNo.current = true; patch({ quotation_no: e.target.value }) }} />
          </label>
          <label style={lbl}><span>Date<Req /></span>
            <input className="input" type="date" value={form.date} onChange={(e) => patch({ date: e.target.value, ...(manualValid.current ? {} : { valid_until: oneMonthAfter(e.target.value) }) })} />
          </label>
          <label style={lbl}>Valid Till
            <input className="input" type="date" value={form.valid_until} onChange={(e) => { manualValid.current = true; patch({ valid_until: e.target.value }) }} />
          </label>
          {text('Site / Location', 'location', 'Chauhtan, Barmer (Rajasthan)')}
          {text('Client Ref. / Enquiry No.', 'ref_no')}
          <label style={lbl}>Ref. Dated<input className="input" type="date" value={form.ref_date} onChange={(e) => patch({ ref_date: e.target.value })} /></label>
          {text('Prepared By', 'prepared_by')}
        </div>
      </div>

      <div style={card}>
        <p className="section-label" style={{ marginTop: 0 }}>Quotation to</p>
        <div style={grid}>
          {text(<>Client Name<Req /></>, 'client_name')}
          {text('Contact Person', 'contact_person')}
          {text('Phone', 'mobile_no')}
          {text('Email', 'email')}
          {text('Client GSTIN', 'client_gstin')}
        </div>
        <label style={{ ...lbl, marginTop: 12 }}>Address
          <textarea className="input" rows={2} value={form.client_address} onChange={(e) => patch({ client_address: e.target.value })} style={area} />
        </label>
      </div>

      <div style={card}>
        <label style={lbl}>Subject
          <input className="input" value={form.subject} placeholder="Soil Investigation" onChange={(e) => patch({ subject: e.target.value })} />
        </label>
        <label style={{ ...lbl, marginTop: 12 }}>Introduction (optional, printed above the items)
          <textarea className="input" rows={2} value={form.intro} onChange={(e) => patch({ intro: e.target.value })} style={area} />
        </label>
      </div>

      <div style={card}>
        <p className="section-label" style={{ marginTop: 0 }}>Description of work</p>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ minWidth: 1060 }}>
            <thead>
              <tr>
                <th style={{ width: 40 }}>Sr.</th><th>Description<Req /></th><th style={{ width: 125 }}>UOM</th><th style={{ width: 125 }}>Qty</th>
                <th style={{ width: 150 }}>Rate</th><th style={{ width: 85 }}>Included</th><th style={{ width: 120, textAlign: 'right' }}>Amount</th><th style={{ width: 110 }}></th>
              </tr>
            </thead>
            <tbody>
              {form.items.map((it, i) => it.kind !== 'item' ? (
                <tr key={i} style={{ background: it.kind === 'heading' ? '#eef2ff' : '#f8fafc' }}>
                  <td style={{ fontWeight: 700, color: '#1d4ed8' }}>{numbers[i]}</td>
                  <td colSpan={6}>
                    <input className="input" value={it.description} aria-label={it.kind === 'heading' ? 'Heading' : 'Sub-heading'} placeholder={it.kind === 'heading' ? 'Heading, e.g. FIELD WORK' : 'Sub-heading, e.g. Survey'}
                      onChange={(e) => setItem(i, { description: e.target.value })} style={{ width: '100%', fontWeight: 700, fontSize: it.kind === 'heading' ? '0.95rem' : '0.875rem' }} />
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>{rowButtons(i, it.kind === 'heading' ? 'Remove heading' : 'Remove sub-heading')}</td>
                </tr>
              ) : (
                <tr key={i} style={{ verticalAlign: 'top' }}>
                  <td>{numbers[i]}</td>
                  <td style={{ minWidth: 260 }}>
                    <input className="input" value={it.description} aria-label={`Item ${i + 1} title`} placeholder="Title (bold)" onChange={(e) => setItem(i, { description: e.target.value })} style={{ width: '100%', fontWeight: 600, marginBottom: 6 }} />
                    <textarea className="input" rows={2} value={it.details} aria-label={`Item ${i + 1} details`} placeholder="Details (small grey text, optional)" onChange={(e) => setItem(i, { details: e.target.value })} style={area} />
                    {it.extra.map((part, p) => (
                      <div key={p} style={{ marginTop: 8, paddingLeft: 10, borderLeft: '3px solid #c7d2fe' }}>
                        <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                          <input className="input" value={part.title} aria-label={`Item ${numbers[i]} heading ${p + 2}`} placeholder="Heading (bold)" onChange={(e) => setPart(i, p, { title: e.target.value })} style={{ flex: 1, minWidth: 0, fontWeight: 600 }} />
                          <button className="icon-button" type="button" title="Remove this heading" onClick={() => setItem(i, { extra: it.extra.filter((_, idx) => idx !== p) })}><X size={14} /></button>
                        </div>
                        <textarea className="input" rows={2} value={part.details} aria-label={`Item ${numbers[i]} text ${p + 2}`} placeholder="Text under the heading (optional)" onChange={(e) => setPart(i, p, { details: e.target.value })} style={area} />
                      </div>
                    ))}
                    <button type="button" onClick={() => setItem(i, { extra: [...it.extra, { title: '', details: '' }] })} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6, padding: 0, border: 0, background: 'none', color: '#2563eb', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}><Plus size={13} /> Add heading in this item</button>
                  </td>
                  <td>
                    <Select className="input" value={otherUnit(it) ? OTHER : it.unit} aria-label={`Item ${i + 1} unit`}
                      onChange={(e) => setItem(i, e.target.value === OTHER ? { unit: '', unitOther: true } : { unit: e.target.value, unitOther: false })}>
                      {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                      <option value={OTHER}>Other…</option>
                    </Select>
                    {otherUnit(it) ? <input className="input" value={it.unit} maxLength={50} autoFocus={it.unitOther && !it.unit} aria-label={`Item ${i + 1} other unit`} placeholder="Type unit" onChange={(e) => setItem(i, { unit: e.target.value, unitOther: true })} style={{ marginTop: 6 }} /> : null}
                  </td>
                  <td><input className="input" type="number" min={0} step="any" value={it.quantity} aria-label={`Item ${i + 1} quantity`} onChange={(e) => setItem(i, { quantity: numVal(e.target.value) })} /></td>
                  <td><input className="input" type="number" min={0} step="any" value={it.included ? '' : it.rate} disabled={it.included} aria-label={`Item ${i + 1} rate`} onChange={(e) => setItem(i, { rate: numVal(e.target.value) })} /></td>
                  <td style={{ textAlign: 'center' }}><input type="checkbox" checked={it.included} aria-label={`Item ${i + 1} included, no charge`} title="Prints “Included” instead of a rate" onChange={(e) => setItem(i, { included: e.target.checked })} /></td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{it.included ? <i style={{ color: '#64748b', fontWeight: 500 }}>Included</i> : money2(quotationItemAmount(it))}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {rowButtons(i, 'Remove item')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          <button type="button" className="ghost-button" onClick={() => addRow(emptyQuotationItem())}><Plus size={14} /> Add item</button>
          <button type="button" className="ghost-button" onClick={() => addRow(emptyHeading('heading'))}><Plus size={14} /> Add heading</button>
          <button type="button" className="ghost-button" onClick={() => addRow(emptyHeading('subheading'))}><Plus size={14} /> Add sub-heading</button>
        </div>
        <p style={{ margin: '8px 0 0', fontSize: '0.78rem', color: '#64748b' }}>New rows come at the end; move them with the arrows.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
        <div style={card}>
          <p className="section-label" style={{ marginTop: 0 }}>Amounts</p>
          <div style={grid}>
            <label style={lbl}>Discount (₹)<input className="input" type="number" min={0} step="any" value={form.discount} onChange={(e) => patch({ discount: numVal(e.target.value) })} /></label>
            <label style={lbl}>Transportation incl. Toll<input className="input" type="number" min={0} step="any" value={form.transport} onChange={(e) => patch({ transport: numVal(e.target.value) })} /></label>
            {isNcs ? (
              <label style={lbl}>GST on transportation
                <Select className="input" value={form.transport_gst ? 'yes' : 'no'} onChange={(e) => patch({ transport_gst: e.target.value === 'yes' })}>
                  <option value="no">No (added after GST)</option>
                  <option value="yes">Yes (added before GST)</option>
                </Select>
              </label>
            ) : null}
          </div>
          <div style={{ marginTop: 14, fontSize: '0.92rem', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
            {summaryRows.map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '7px 12px', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: '#475569' }}>{k}</span><span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{v}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 12px', background: '#eff6ff' }}>
              <span style={{ fontWeight: 700 }}>{t.grandLabel}</span>
              <span style={{ fontWeight: 800, fontSize: '1.05rem', color: '#1d4ed8', whiteSpace: 'nowrap' }}>₹{money2(t.grand)}</span>
            </div>
          </div>
          <p style={{ margin: '8px 0 0', fontSize: '0.8rem', color: '#64748b' }}>{t.words}</p>
        </div>

        <div style={card}>
          <p className="section-label" style={{ marginTop: 0 }}>Payment terms and signature</p>
          <label style={lbl}>Payment Terms
            <textarea className="input" rows={3} value={form.payment_terms} onChange={(e) => patch({ payment_terms: e.target.value })} style={area} />
          </label>
          {isNcs ? (
            <div style={{ ...grid, marginTop: 12 }}>
              {text('Signatory Name', 'signatory_name')}
              {text('Designation', 'signatory_designation')}
            </div>
          ) : null}
          <label style={{ ...lbl, marginTop: 12 }}>Remark (for the office, not printed)
            <textarea className="input" rows={2} value={form.notes} onChange={(e) => patch({ notes: e.target.value })} style={area} />
          </label>
        </div>
      </div>

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
          <p className="section-label" style={{ margin: 0 }}>Scope, deliverables, exclusions, terms (optional)</p>
          {withSections.length ? (
            <Select className="input" style={{ width: 'auto', maxWidth: 340 }} aria-label="Copy sections from an old quotation" value="" onChange={(e) => copySections(e.target.value)}>
              <option value="">Copy sections from an old quotation…</option>
              {withSections.map((q) => <option key={q.id} value={q.id}>{q.quotation_no} · {q.client_name}</option>)}
            </Select>
          ) : null}
        </div>
        {form.sections.map((s, i) => (
          <div key={i} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, marginBottom: 10 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
              <ComboInput other={false} options={SECTION_TITLES} style={{ flex: '1 1 220px', width: 'auto' }} inputStyle={{ fontWeight: 600 }} placeholder="Heading, e.g. Deliverables" ariaLabel={`Section ${i + 1} heading`} value={s.title} onChange={(title) => setSection(i, { title })} />
              <Select className="input" style={{ width: 170 }} aria-label={`Section ${i + 1} style`} value={s.style} onChange={(e) => setSection(i, { style: e.target.value as SectionStyle })}>
                {SECTION_STYLES.map((st) => <option key={st.key} value={st.key}>{st.label}</option>)}
              </Select>
              <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: '0.82rem', color: '#334155' }} title="Two half-width sections one after the other print side by side">
                <input type="checkbox" checked={s.half} onChange={(e) => setSection(i, { half: e.target.checked })} /> Half width
              </label>
              <span style={{ whiteSpace: 'nowrap' }}>
                <button className="icon-button" type="button" title="Move up" disabled={i === 0} onClick={() => patch({ sections: moved(form.sections, i, -1) })}><ArrowUp size={14} /></button>
                <button className="icon-button" type="button" title="Move down" disabled={i === form.sections.length - 1} onClick={() => patch({ sections: moved(form.sections, i, 1) })}><ArrowDown size={14} /></button>
                <button className="icon-button" type="button" title="Remove section" onClick={() => patch({ sections: form.sections.filter((_, idx) => idx !== i) })}><Trash2 size={14} /></button>
              </span>
            </div>
            <textarea className="input" rows={4} aria-label={`Section ${i + 1} text`} placeholder={s.style === 'text' ? 'Text' : 'One point per line'} value={s.body} onChange={(e) => setSection(i, { body: e.target.value })} style={area} />
          </div>
        ))}
        <button type="button" className="ghost-button" onClick={() => patch({ sections: [...form.sections, emptySection()] })}><Plus size={14} /> Add section</button>
      </div>

      <div style={{ ...card, display: 'grid', gap: 12, borderColor: '#c7d2fe', background: '#fafbff' }}>
        <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void save()} style={{ justifyContent: 'center', width: '100%' }}>
          <Save size={16} /> {saving ? 'Saving…' : canApprove ? (approval !== null && approval !== 'approved' ? 'Save and approve' : 'Save') : 'Save and send for approval'}
        </button>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <strong style={{ flex: 1, minWidth: 200 }}>{canApprove ? 'Save and print / PDF' : 'Print / PDF'}</strong>
          {COMPANIES[form.company].seal ? <button type="button" className="btn btn-outline" disabled={saving || locked} onClick={() => void saveAndPrint(true)}><Stamp size={16} /> With Sign</button> : null}
          <button type="button" className="btn btn-outline" disabled={saving || locked} onClick={() => void saveAndPrint(false)}><Printer size={16} /> {COMPANIES[form.company].seal ? 'Without Sign' : 'Print'}</button>
        </div>
        {locked ? <p style={{ margin: 0, fontSize: '0.8rem', color: '#92400e' }}>{approval === 'approved' ? 'Save the changes first. After approval it can be printed and mailed.' : 'It can be printed and mailed after approval.'}</p> : null}
        {canMail ? (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <strong style={{ flex: 1, minWidth: 200 }}>{canApprove ? 'Save and mail the PDF' : 'Mail the PDF'}</strong>
            {COMPANIES[form.company].seal ? <button type="button" className="btn btn-outline" disabled={saving || locked} onClick={() => void saveAndMail(true)}><Stamp size={16} /> Mail With Sign</button> : null}
            <button type="button" className="btn btn-outline" disabled={saving || locked} onClick={() => void saveAndMail(false)}><Mail size={16} /> {COMPANIES[form.company].seal ? 'Mail Without Sign' : 'Mail'}</button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
