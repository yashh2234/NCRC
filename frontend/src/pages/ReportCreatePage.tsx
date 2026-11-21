import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowLeft, Search } from 'lucide-react'
import { api } from '../lib/api'
import { DateInput } from '../components/DateInput'
import { SearchableSelect } from '../components/SearchableSelect'
import { EXCEL_TEMPLATE_OPTIONS, ExcelLabReportEditor } from '../components/ExcelLabReportEditor'
import { cubeSetsFromGrid } from '../lib/labFormats'

/**
 * Create Report.
 *  1. Only UID + "Get Details" (old software flow). The report type is the test chosen on the list.
 *  2. Get Details reveals the same screen as the Final Reports / Lab Reports edit screen:
 *     the orange UID banner, label + box rows, and that report type's TEST RESULTS table.
 *  3. Create Report saves it as Pending.
 */

interface ReportTypeOption { key: string; label: string; is_template?: boolean }

const CUBE_MATERIALS = ['Cube Sample (01 Set)', 'Cube Sample (02 Set)', 'Cube Sample (03 Set)', 'Cube Sample (04 Set)', 'Cube Sample (05 Set)']
/** Final-report format → the report type it is saved as. Formats without their own type are kept under MES. */
const FORMAT_TYPE: Record<string, string> = {
  cc_cube: 'cc_cube', cc_core: 'cc_core', clay_bricks: 'bricks', interlocking_60mm: 'interlocking',
  fcdc_ferro_cover: 'ferro_cover', main_hole_cover_hd20: 'mainhole_cover', sand: 'sand', water: 'water',
  bitumen_sample_dbm_bc: 'bitumen_loose', dbm_bc_density: 'bitumen_core',
}
const GENERAL_TYPE = 'mes'

const FORMAT_OPTIONS = EXCEL_TEMPLATE_OPTIONS.map(([value, label]) => ({ value, label }))

/** Lab Reports list selection → default format on the Create page. */
function defaultFormat(listType: string): string {
  if (listType.startsWith('template:')) return listType.slice('template:'.length)
  const match = Object.entries(FORMAT_TYPE).find(([, type]) => type === listType)
  return match ? match[0] : 'cc_cube'
}

const SAMPLED_BY = ['Sample Supplied By Customer', 'Sample Collected By Ncs']
const DEFAULT_ENVIRONMENT = 'As Per the Prescribed test Method'

function nowStamp() {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()}, ${p(d.getHours())}:${p(d.getMinutes())}`
}

const rowStyle = { display: 'grid', gridTemplateColumns: 'minmax(150px, 250px) 1fr', alignItems: 'center', gap: 8 } as const
const labelStyle = { fontWeight: 500, fontSize: '0.9rem' } as const

export function ReportCreatePage({ types, defaultType, onBack, onCreated }: {
  types: ReportTypeOption[]
  defaultType: string
  onBack: () => void
  onCreated: () => void
}) {
  // Report format decides the results table and the report type it is saved as
  const [format, setFormat] = useState(() => defaultFormat(defaultType || 'cc_cube'))
  const reportType = FORMAT_TYPE[format] ?? GENERAL_TYPE
  const formatLabel = EXCEL_TEMPLATE_OPTIONS.find(([k]) => k === format)?.[1] ?? format
  const isCube = reportType === 'cc_cube'
  void types
  const [stamp] = useState(nowStamp)

  // Step 1: UID
  const [uid, setUid] = useState('')
  const [suggestions, setSuggestions] = useState<Array<{ uid_no: string; agency_name: string; name_of_work: string }>>([])
  const pickedRef = useRef('')
  const [looking, setLooking] = useState(false)
  const [loadedUid, setLoadedUid] = useState('')

  // Step 2: same fields as the edit screen
  const [linkedUlrs, setLinkedUlrs] = useState<string[]>([])
  const [form, setForm] = useState({
    ulr_no: '', customer_details: '', agency_name: '', reference_no: '', material_details: '',
    source_location: '', work_order_no: '', sample_date: '', sample_tested_date: '',
    sampled_by: SAMPLED_BY[0], environment_condition: DEFAULT_ENVIRONMENT, dispatch_date: '',
  })
  const [labData, setLabData] = useState<Record<string, string>>({})

  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)
  const [saving, setSaving] = useState(false)

  const update = (field: keyof typeof form, value: string) => setForm((f) => ({ ...f, [field]: value }))
  const templateKey = format

  // UID suggestions while typing
  useEffect(() => {
    const q = uid.trim()
    if (q.length < 2 || uid === pickedRef.current) { setSuggestions([]); return }
    const t = window.setTimeout(async () => {
      try { setSuggestions((await api.searchRegistrationUids(q)).data) } catch { setSuggestions([]) }
    }, 250)
    return () => window.clearTimeout(t)
  }, [uid])

  // CC Cube: "Cube Sample (0N Set)" gives N cube sets in the results table
  const setCount = isCube ? Math.max(1, CUBE_MATERIALS.indexOf(form.material_details) + 1) : 0
  useEffect(() => {
    if (isCube) setLabData((prev) => (prev.n_sets === String(setCount) ? prev : { ...prev, n_sets: String(setCount) }))
  }, [isCube, setCount])

  const changeFormat = (next: string) => {
    const wasCube = isCube
    setFormat(next)
    setLabData({})
    // CC Cube uses "Cube Sample (0N Set)"; other formats use free text
    if (wasCube !== ((FORMAT_TYPE[next] ?? GENERAL_TYPE) === 'cc_cube')) update('material_details', '')
  }

  // Our own searchable dropdown (type to filter, short scrolling list) instead of the browser's long list
  const formatSelect = (
    <SearchableSelect
      value={format}
      options={FORMAT_OPTIONS}
      onChange={(v) => { if (v && v !== format) changeFormat(v) }}
      placeholder="Select report format"
    />
  )

  const getDetails = async (value = uid) => {
    const id = value.trim()
    if (!id) { setMessage({ type: 'error', text: 'Please enter UID No.' }); return }
    setLooking(true)
    setMessage(null)
    try {
      const [res, links] = await Promise.all([
        api.ulrClientDetails(id),
        api.ulrLinksFiltered({ uid_no: id }).catch(() => ({ data: [] })),
      ])
      const reg = res.data
      if (!reg) {
        setLoadedUid('')
        setMessage({ type: 'error', text: 'UID No. Not Found!' })
        return
      }
      setForm((f) => ({
        ...f,
        customer_details: reg.reporting_address || '',
        agency_name: reg.agency_name || '',
        source_location: reg.name_of_work || '',
        work_order_no: reg.work_order_no || '',
      }))
      const same = links.data.filter((l) => l.uid_no.trim().toLowerCase() === id.toLowerCase()).map((l) => l.ulr_no)
      setLinkedUlrs([...new Set(same)])
      const found = reg.uid_no || id
      pickedRef.current = found
      setUid(found)
      setLoadedUid(found)
    } catch {
      setMessage({ type: 'error', text: 'Could not load the UID details' })
    } finally {
      setLooking(false)
    }
  }

  const pick = (value: string) => {
    pickedRef.current = value
    setUid(value)
    setSuggestions([])
    void getDetails(value)
  }

  const updateDetail = () => {}
  const updateLabData = (field: string, value: string) => setLabData((prev) => ({ ...prev, [field]: value }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const missing: string[] = []
    if (isCube && !form.ulr_no.trim()) missing.push('ULR No.')
    if (!form.customer_details.trim()) missing.push('Name & Address of Customer')
    if (!form.agency_name.trim()) missing.push('Name of Agency')
    if (!form.material_details.trim()) missing.push('Material Identification Details')
    if (!form.sample_date) missing.push('Date of Sample Receipt')
    if (!form.sample_tested_date) missing.push('Date of Sample Tested')
    if (missing.length) { setMessage({ type: 'error', text: `Please fill: ${missing.join(', ')}` }); return }

    setSaving(true)
    setMessage(null)
    try {
      const payload = {
        ...form,
        uid_no: loadedUid,
        dispatch_date: form.dispatch_date || undefined,
        lab_data: { ...labData, _template: templateKey },
        // Lab Reports list shows the cube dates from these rows
        ...(isCube ? { sets: cubeSetsFromGrid(labData) } : {}),
      }
      if (isCube) await api.createCubeReport(payload)
      else await api.createLabReport(reportType, payload)
      onCreated()
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error && err.message ? err.message : 'Unable to create lab report' })
    } finally {
      setSaving(false)
    }
  }

  const row = (label: string, node: React.ReactNode, required = false) => (
    <div style={rowStyle}>
      <span style={labelStyle}>{label}{required ? <span style={{ color: '#dc2626' }}> *</span> : null}</span>
      {node}
    </div>
  )

  return (
    <form onSubmit={submit} className="surface" style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <p className="section-label">Laboratory · {formatLabel}</p>
          <h2 style={{ margin: 0 }}>Create Report</h2>
          <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--gray-500, #64748b)' }}>Date: {stamp}</p>
        </div>
        <button type="button" className="btn btn-outline btn-sm" onClick={onBack}><ArrowLeft size={14} /> Back</button>
      </div>

      {message ? (
        <div className={message.type === 'error' ? 'error-banner' : 'success-banner'} style={{ marginBottom: 14 }}>{message.text}</div>
      ) : null}

      {/* Step 1: UID + Get Details */}
      {!loadedUid ? (
        <div style={{ display: 'grid', gap: 12, maxWidth: 760 }}>
        <div style={rowStyle}>
          <span style={labelStyle}>Report format<span style={{ color: '#dc2626' }}> *</span></span>
          {formatSelect}
        </div>
        <div style={{ ...rowStyle, position: 'relative' }}>
          <span style={labelStyle}>UID No.<span style={{ color: '#dc2626' }}> *</span></span>
          <div style={{ position: 'relative', display: 'flex', gap: 8 }}>
            <input
              className="input"
              autoComplete="off"
              autoFocus
              placeholder="Type to search UID"
              value={uid}
              onChange={(e) => setUid(e.target.value)}
              onBlur={() => setSuggestions([])}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); setSuggestions([]); void getDetails() } }}
              style={{ flex: 1, minWidth: 0 }}
            />
            <button type="button" className="btn btn-primary" onClick={() => { setSuggestions([]); void getDetails() }} disabled={looking} style={{ whiteSpace: 'nowrap' }}>
              <Search size={14} /> {looking ? 'Loading…' : 'Get Details'}
            </button>
            {suggestions.length > 0 && (
              <div style={{ position: 'absolute', zIndex: 20, top: '100%', left: 0, right: 130, marginTop: 4, maxHeight: 260, overflowY: 'auto', background: 'var(--color-surface, #fff)', border: '1px solid #cbd5e1', borderRadius: 6, boxShadow: '0 8px 20px rgba(15,23,42,0.18)' }}>
                {suggestions.map((s) => (
                  <button
                    key={s.uid_no}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); pick(s.uid_no) }}
                    style={{ display: 'block', width: '100%', padding: '8px 10px', border: 0, borderBottom: '1px solid #f1f5f9', background: 'transparent', textAlign: 'left', cursor: 'pointer', color: 'inherit' }}
                  >
                    <strong>{s.uid_no}</strong>
                    <span style={{ display: 'block', marginTop: 2, fontSize: '0.75rem', color: '#64748b' }}>{s.agency_name || s.name_of_work || 'Registration'}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        </div>
      ) : (
        <>
          {/* Same layout as the Final Reports / Lab Reports edit screen */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
            <h2 style={{ background: '#ff6600', padding: '8px 24px', color: '#fff', fontSize: '1.25rem', opacity: 0.8, borderRadius: 4, margin: 0 }}>
              UID No.- {loadedUid}
            </h2>
            <button type="button" className="ghost-button" onClick={() => { setLoadedUid(''); setUid(''); pickedRef.current = '' }}>Change UID</button>
          </div>

          <div style={{ display: 'grid', gap: 12, marginBottom: 32 }}>
            {row('Report format', formatSelect, true)}
            {row('ULR No.', (
              <>
                <input className="input" list="create-report-ulrs" autoComplete="off" value={form.ulr_no} onChange={(e) => update('ulr_no', e.target.value)}
                  placeholder={linkedUlrs.length ? 'Pick a linked ULR or type' : 'Enter ULR No.'} />
                <datalist id="create-report-ulrs">{linkedUlrs.map((u) => <option key={u} value={u} />)}</datalist>
              </>
            ), isCube)}
            {row('Name & Address of Customer', <input className="input" value={form.customer_details} onChange={(e) => update('customer_details', e.target.value)} />, true)}
            {row('Name Of Agency', <input className="input" value={form.agency_name} onChange={(e) => update('agency_name', e.target.value)} />, true)}
            {row('Reference No.', <input className="input" value={form.reference_no} onChange={(e) => update('reference_no', e.target.value)} />)}
            {row('Material Identification Details.', isCube ? (
              <select className="input" value={form.material_details} onChange={(e) => update('material_details', e.target.value)}>
                <option value="">Select Cube Sample</option>
                {CUBE_MATERIALS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            ) : (
              <input className="input" value={form.material_details} onChange={(e) => update('material_details', e.target.value)} />
            ), true)}
            {row('Name Of Work', <input className="input" value={form.source_location} onChange={(e) => update('source_location', e.target.value)} />)}
            {row('Work Order No.', <input className="input" value={form.work_order_no} onChange={(e) => update('work_order_no', e.target.value)} />)}
            {row('Date Of Sample Receipt', <DateInput value={form.sample_date} onChange={(v) => update('sample_date', v)} ariaLabel="Date of Sample Receipt" style={{ width: '100%', flex: 'none' }} />, true)}
            {row('Date Of Sample Tested', <DateInput value={form.sample_tested_date} onChange={(v) => update('sample_tested_date', v)} ariaLabel="Date of Sample Tested" style={{ width: '100%', flex: 'none' }} />, true)}
            {row('Sampled By /Condition Of Sample', (
              <select className="input" value={form.sampled_by} onChange={(e) => update('sampled_by', e.target.value)}>
                {SAMPLED_BY.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            ))}
            {row('Environment Condition.', <input className="input" value={form.environment_condition} onChange={(e) => update('environment_condition', e.target.value)} />)}
            {row('Dispatch Date', <DateInput value={form.dispatch_date} onChange={(v) => update('dispatch_date', v)} ariaLabel="Dispatch Date" style={{ width: '100%', flex: 'none' }} />)}
          </div>

          {/* Same TEST RESULTS table the edit screen uses for this report type */}
          <ExcelLabReportEditor
            reportType={reportType}
            material={form.material_details}
            details={[]}
            labData={labData}
            templateKey={templateKey}
            updateDetail={updateDetail}
            updateLabData={updateLabData}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24, paddingTop: 16, borderTop: '1px solid #e2e8f0' }}>
            <button type="button" className="btn btn-outline" onClick={onBack}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Creating…' : 'Create Report'}</button>
          </div>
        </>
      )}
    </form>
  )
}
