import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowLeft, ArrowUp, Plus, Printer, Save, Stamp, Trash2 } from 'lucide-react'
import { money2 } from '../lib/bills'
import { openPrintWindow, printQuotation } from '../lib/quotationPrint'
import {
  GST_OPTIONS, SECTION_TITLES, UNITS, calcQuotation, emptyQuotationItem, emptySection, oneMonthAfter, quotationItemAmount, quotationToInput, quotationsApi,
  type GstMode, type Quotation, type QuotationInput, type QuotationItem, type QuotationSection, type SectionStyle,
} from '../lib/quotations'
import { Req } from './ui'

const card: React.CSSProperties = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16, marginBottom: 14 }
const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }
const lbl: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.8rem', fontWeight: 600, color: '#334155' }
const area: React.CSSProperties = { width: '100%', resize: 'vertical', fontFamily: 'inherit' }

const SECTION_STYLES: { key: SectionStyle; label: string }[] = [
  { key: 'numbers', label: 'Numbered points' },
  { key: 'bullets', label: 'Bullet points' },
  { key: 'text', label: 'Paragraph' },
]

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
  /** All quotations, to copy sections from */
  others: Quotation[]
  onClose: (changed: boolean) => void
}

export function QuotationEditor({ id, initial, others, onClose }: QuotationEditorProps) {
  const [form, setForm] = useState<QuotationInput>(initial)
  const [savedId, setSavedId] = useState<number | null>(id)
  const [saving, setSaving] = useState(false)
  const [changed, setChanged] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  /** Typed by hand: stop replacing with the suggestion */
  const manualNo = useRef(Boolean(id))
  const manualValid = useRef(Boolean(id))
  const t = calcQuotation(form)

  const patch = (changes: Partial<QuotationInput>) => {
    setForm((f) => ({ ...f, ...changes }))
    setDirty(true)
  }
  const setItem = (i: number, changes: Partial<QuotationItem>) => patch({ items: form.items.map((it, idx) => (idx === i ? { ...it, ...changes } : it)) })
  const setSection = (i: number, changes: Partial<QuotationSection>) => patch({ sections: form.sections.map((s, idx) => (idx === i ? { ...s, ...changes } : s)) })
  const numVal = (v: string): number | '' => (v === '' ? '' : Number(v))

  // Suggest the next number; its year follows the quotation date
  useEffect(() => {
    if (manualNo.current) return
    let cancelled = false
    quotationsApi.nextNumber(form.date)
      .then((res) => { if (!cancelled && !manualNo.current) setForm((f) => ({ ...f, quotation_no: res.data })) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [form.date])

  const showError = (text: string) => {
    setError(text)
    setNotice('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const check = (): string => {
    if (!form.client_name.trim()) return 'Enter the client name.'
    if (!form.date) return 'Enter the quotation date.'
    const used = form.items.filter((it) => it.description.trim() || it.details.trim() || Number(it.rate))
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
      setSavedId(data.id)
      manualNo.current = true
      manualValid.current = true
      setForm(saved)
      setChanged(true)
      setDirty(false)
      setNotice(`Saved quotation ${data.quotation_no}.`)
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
    const saved = await save()
    if (!w) return
    if (saved) printQuotation(w, saved, withSign)
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

  // Amount summary in the same order as the print
  const summaryRows: [string, string][] = [['Sub Total', money2(t.subtotal)]]
  if (t.discount) summaryRows.push(['Discount', `− ${money2(t.discount)}`], ['Total after Discount', money2(t.taxable)])
  if (form.gst_mode === 'add') summaryRows.push(['GST @ 18%', money2(t.gst)])
  if (form.gst_mode === 'extra') summaryRows.push(['GST', 'Extra, as applicable'])
  if (t.transport) summaryRows.push(['Transportation incl. Toll', money2(t.transport)])
  if (t.roundOff) summaryRows.push(['Round Off', `${t.roundOff > 0 ? '' : '− '}${money2(Math.abs(t.roundOff))}`])
  const withSections = others.filter((q) => q.sections.length && q.id !== savedId)

  return (
    <div style={{ maxWidth: 1150, margin: '0 auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 10, padding: '6px 0 24px' }}>
        <button type="button" onClick={close} style={{ justifySelf: 'start', display: 'inline-flex', alignItems: 'center', gap: 6, border: 0, background: 'none', padding: 0, color: '#475569', fontWeight: 600, cursor: 'pointer' }}><ArrowLeft size={16} /> Back</button>
        <h2 style={{ margin: 0, fontSize: '1.1rem', textAlign: 'center' }}>
          {savedId ? `Quotation ${form.quotation_no}` : 'New quotation'}
          {dirty ? <span style={{ marginLeft: 8, fontSize: '0.75rem', color: '#b45309', fontWeight: 600 }}>● Unsaved</span> : null}
        </h2>
        <span />
      </div>
      {notice ? <p style={{ margin: '0 0 12px', padding: '8px 12px', borderRadius: 8, background: '#f0fdf4', color: '#166534', fontSize: '0.85rem' }}>{notice}</p> : null}
      {error ? <p role="alert" style={{ margin: '0 0 12px', padding: '8px 12px', borderRadius: 8, background: '#fef2f2', color: '#b91c1c', fontSize: '0.85rem' }}>{error}</p> : null}

      <datalist id="quotation-units">{UNITS.map((u) => <option key={u} value={u} />)}</datalist>
      <datalist id="quotation-sections">{SECTION_TITLES.map((s) => <option key={s} value={s} />)}</datalist>

      <div style={card}>
        <p className="section-label" style={{ marginTop: 0 }}>Quotation</p>
        <div style={grid}>
          <label style={lbl}>Quotation No.
            <input className="input" value={form.quotation_no} placeholder="NCS/2026/1058" onChange={(e) => { manualNo.current = true; patch({ quotation_no: e.target.value }) }} />
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
              {form.items.map((it, i) => (
                <tr key={i} style={{ verticalAlign: 'top' }}>
                  <td>{i + 1}</td>
                  <td style={{ minWidth: 260 }}>
                    <input className="input" value={it.description} aria-label={`Item ${i + 1} title`} placeholder="Title (bold)" onChange={(e) => setItem(i, { description: e.target.value })} style={{ width: '100%', fontWeight: 600, marginBottom: 6 }} />
                    <textarea className="input" rows={2} value={it.details} aria-label={`Item ${i + 1} details`} placeholder="Details (small grey text, optional)" onChange={(e) => setItem(i, { details: e.target.value })} style={area} />
                  </td>
                  <td><input className="input" list="quotation-units" value={it.unit} aria-label={`Item ${i + 1} unit`} onChange={(e) => setItem(i, { unit: e.target.value })} /></td>
                  <td><input className="input" type="number" min={0} step="any" value={it.quantity} aria-label={`Item ${i + 1} quantity`} onChange={(e) => setItem(i, { quantity: numVal(e.target.value) })} /></td>
                  <td><input className="input" type="number" min={0} step="any" value={it.included ? '' : it.rate} disabled={it.included} aria-label={`Item ${i + 1} rate`} onChange={(e) => setItem(i, { rate: numVal(e.target.value) })} /></td>
                  <td style={{ textAlign: 'center' }}><input type="checkbox" checked={it.included} aria-label={`Item ${i + 1} included, no charge`} title="Prints “Included” instead of a rate" onChange={(e) => setItem(i, { included: e.target.checked })} /></td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{it.included ? <i style={{ color: '#64748b', fontWeight: 500 }}>Included</i> : money2(quotationItemAmount(it))}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="icon-button" type="button" title="Move up" disabled={i === 0} onClick={() => patch({ items: moved(form.items, i, -1) })}><ArrowUp size={14} /></button>
                    <button className="icon-button" type="button" title="Move down" disabled={i === form.items.length - 1} onClick={() => patch({ items: moved(form.items, i, 1) })}><ArrowDown size={14} /></button>
                    {form.items.length > 1 ? <button className="icon-button" type="button" title="Remove item" onClick={() => patch({ items: form.items.filter((_, idx) => idx !== i) })}><Trash2 size={14} /></button> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="button" className="ghost-button" style={{ marginTop: 8 }} onClick={() => patch({ items: [...form.items, emptyQuotationItem()] })}><Plus size={14} /> Add item</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
        <div style={card}>
          <p className="section-label" style={{ marginTop: 0 }}>Amounts</p>
          <div style={grid}>
            <label style={lbl}>Discount (₹)<input className="input" type="number" min={0} step="any" value={form.discount} onChange={(e) => patch({ discount: numVal(e.target.value) })} /></label>
            <label style={lbl}>Transportation incl. Toll<input className="input" type="number" min={0} step="any" value={form.transport} onChange={(e) => patch({ transport: numVal(e.target.value) })} /></label>
            <label style={lbl}>GST
              <select className="input" value={form.gst_mode} onChange={(e) => patch({ gst_mode: e.target.value as GstMode })}>
                {GST_OPTIONS.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
              </select>
            </label>
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
          <div style={{ ...grid, marginTop: 12 }}>
            {text('Signatory Name', 'signatory_name')}
            {text('Designation', 'signatory_designation')}
          </div>
          <label style={{ ...lbl, marginTop: 12 }}>Remark (for the office, not printed)
            <textarea className="input" rows={2} value={form.notes} onChange={(e) => patch({ notes: e.target.value })} style={area} />
          </label>
        </div>
      </div>

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
          <p className="section-label" style={{ margin: 0 }}>Scope, deliverables, exclusions, terms (optional)</p>
          {withSections.length ? (
            <select className="input" style={{ width: 'auto', maxWidth: 340 }} aria-label="Copy sections from an old quotation" value="" onChange={(e) => copySections(e.target.value)}>
              <option value="">Copy sections from an old quotation…</option>
              {withSections.map((q) => <option key={q.id} value={q.id}>{q.quotation_no} · {q.client_name}</option>)}
            </select>
          ) : null}
        </div>
        {form.sections.map((s, i) => (
          <div key={i} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, marginBottom: 10 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
              <input className="input" list="quotation-sections" style={{ flex: '1 1 220px', width: 'auto', fontWeight: 600 }} placeholder="Heading, e.g. Deliverables" aria-label={`Section ${i + 1} heading`} value={s.title} onChange={(e) => setSection(i, { title: e.target.value })} />
              <select className="input" style={{ width: 170 }} aria-label={`Section ${i + 1} style`} value={s.style} onChange={(e) => setSection(i, { style: e.target.value as SectionStyle })}>
                {SECTION_STYLES.map((st) => <option key={st.key} value={st.key}>{st.label}</option>)}
              </select>
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
