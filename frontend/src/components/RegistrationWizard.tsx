import { useEffect, useState, useRef, type FormEvent } from 'react'
import {
  ClipboardList, ArrowLeft, ArrowRight, Save, Plus, X, Building2,
  FlaskConical, Paperclip, IndianRupee, Briefcase, Calculator,
  Sparkles, CheckCircle2, Clock, FileText, UserCheck, Eye, Trash2, Upload
} from 'lucide-react'
import type { RegistrationFormData } from '../lib/types'
import { API_ORIGIN, api, request } from '../lib/api'
import { FormField, DatePicker } from './ui'
import { RATE_LIST } from '../data/rateList'

const WORK_TYPES = ['', 'Audit', 'SPT / Outsource', 'Lab', 'Consultancy', 'Survey', 'Field Test']
const NEW_BACK_OPTIONS = ['', 'new', 'back']
const ASSIGN_OPTIONS = ['lab', 'admin']
const REPORT_STATUS_OPTIONS = ['', 'lab process', 'Report Complete', 'Report Pending', 'Report Dispatched']
const PAYMENT_MODES = ['', 'upi', 'cash', 'online banking', 'cheque']

export const WORKFLOW_STAGES = [
  '1. Registered',
  '2. Field/Site Work',
  '3. Lab Testing',
  '4. Report Drafting',
  '5. Report Review',
  '6. Report Dispatched',
  '7. Payment Pending',
  '8. Closed'
]

export const PRIORITY_OPTIONS = ['High', 'Medium', 'Low']
export const PAYMENT_STATUS_OPTIONS = ['Not Invoiced', 'Invoiced', 'Partial Received', 'Fully Received']

const TABS = [
  { key: 'general', label: 'General', icon: ClipboardList },
  { key: 'client', label: 'Client', icon: Building2 },
  { key: 'sample', label: 'Samples', icon: FlaskConical },
  { key: 'office', label: 'Office', icon: Briefcase },
  { key: 'financial', label: 'Financial', icon: IndianRupee },
  { key: 'attachments', label: 'Files', icon: Paperclip },
  { key: 'handover', label: 'Handover', icon: UserCheck },
]

const emptyForm: RegistrationFormData = {
  uid_no: '', received_date: new Date().toISOString().slice(0, 10),
  agency_name: '', reporting_address: '', mobile_no: '',
  name_of_work: '', work_order_no: '', reference: '', work: '', report_status: '',
  sample_details: '', sample_details_1: '', sample_details_2: '', sample_details_3: '', sample_details_4: '',
  new_back: '', new_back_1: '', new_back_2: '', new_back_3: '', new_back_4: '',
  total_payment: '0', advance_payment: '0', balance_dues: '0', payment_followup: '',
  financial_remark: '', mode_of_payment: '', gst_no: '', sample_nos: '',
  remark: '', qty: '', qty_1: '', qty_2: '', qty_3: '', qty_4: '',
  witness: '', sample_test: '', sample_remark: '',
  report_no: '', field_person_name: '', prepared_date: '', dispatch_date: '',
  assign_to: 'lab',
  current_stage: '1. Registered',
  currently_with: '',
  priority: 'Medium',
  target_date: '',
  payment_status: 'Not Invoiced',
  handover_note: '',
}

const DRAFT_KEY = 'reg_draft'

function loadDraft(): Partial<RegistrationFormData> {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) ?? '{}') }
  catch { return {} }
}
function saveDraft(data: Partial<RegistrationFormData>) { localStorage.setItem(DRAFT_KEY, JSON.stringify(data)) }
function clearDraft() { localStorage.removeItem(DRAFT_KEY) }

interface Props {
  editingId: number | null
  initial: RegistrationFormData
  onSaved: () => void
  onCancel: () => void
  onGenerateUid: () => Promise<string>
  generatingUid: boolean
}

interface SampleRow {
  category?: string
  subOption?: string
  sampleType: string
  qty: string
  rate?: number | string
  newBack: string
}

export function RegistrationWizard({
  editingId,
  initial,
  onSaved,
  onCancel,
  onGenerateUid,
  generatingUid
}: Props) {
  const [tab, setTab] = useState(0)
  const [form, setForm] = useState<RegistrationFormData>(() => {
    if (editingId) return initial
    const draft = loadDraft()
    return { ...emptyForm, ...draft, received_date: new Date().toISOString().slice(0, 10) }
  })
  const [usersList, setUsersList] = useState<Array<{ id: number; name: string; firstname?: string; lastname?: string; tracker_role?: string }>>([])
  const [saving, setSaving] = useState(false)
  const [localError, setLocalError] = useState('')
  const [currentlyWithError, setCurrentlyWithError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Array<{ iClientId: number; uid_no: string; agency_name: string; reporting_address: string; mobile_no: string; name_of_work: string }>>([])
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Document scan state
  const [uploadingSlot, setUploadingSlot] = useState<number | null>(null)
  const [uploadMsg, setUploadMsg] = useState('')
  const [pendingFiles, setPendingFiles] = useState<Record<string, File>>({})

  const handleUploadScan = async (idx: number, file?: File) => {
    if (!file) return
    const field = idx === 0 ? 'scan_copy' : `scan_copy_${idx}`

    if (editingId) {
      setUploadingSlot(idx)
      setUploadMsg('')
      try {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('field', field)
        fd.append('registration_id', String(editingId))
        const res = await api.uploadRegistrationScan(fd)
        update({ [field]: res.path })
        setUploadMsg(`Scan Document #${idx + 1} uploaded & saved!`)
        setTimeout(() => setUploadMsg(''), 4000)
      } catch (err) {
        setLocalError(err instanceof Error ? err.message : 'Failed to upload document')
      } finally {
        setUploadingSlot(null)
      }
    } else {
      setPendingFiles((prev) => ({ ...prev, [field]: file }))
      update({ [field]: file.name })
      setUploadMsg(`Document #${idx + 1} ready to attach on save`)
      setTimeout(() => setUploadMsg(''), 4000)
    }
  }

  const handleRemoveScan = (idx: number) => {
    const field = idx === 0 ? 'scan_copy' : `scan_copy_${idx}`
    setPendingFiles((prev) => {
      const next = { ...prev }
      delete next[field]
      return next
    })
    update({ [field]: '' })
  }

  useEffect(() => {
    api.users().then((res) => {
      setUsersList(res.data || [])
    }).catch(() => {})
  }, [])

  const makeSampleRows = (f: RegistrationFormData): SampleRow[] => {
    const rows: SampleRow[] = []
    const createRowObj = (st?: string, q?: string, nb?: string): SampleRow | null => {
      if (!st && !q && !nb) return null
      let category = ''
      let subOption = ''
      const rawStr = (st ?? '').trim()

      const dashMatch = rawStr.match(/^(.+?)\s*[\-\—\–]\s*(.+)$/)
      if (dashMatch) {
        category = dashMatch[1].trim()
        subOption = dashMatch[2].trim()
      } else if (rawStr) {
        const matchedCat = RATE_LIST.find(
          (c) => c.category.toLowerCase() === rawStr.toLowerCase() || c.items.some((it) => it.name.toLowerCase() === rawStr.toLowerCase())
        )
        if (matchedCat) {
          category = matchedCat.category
          const matchedItem = matchedCat.items.find((it) => it.name.toLowerCase() === rawStr.toLowerCase())
          if (matchedItem) subOption = matchedItem.name
        } else {
          category = rawStr
        }
      }

      let rate: number | string = ''
      if (category && subOption) {
        const catObj = RATE_LIST.find((c) => c.category.toLowerCase() === category.toLowerCase())
        const itemObj = catObj?.items.find((it) => it.name.toLowerCase() === subOption.toLowerCase())
        if (itemObj?.rate !== undefined) rate = itemObj.rate
      }

      return { category, subOption, sampleType: rawStr, qty: q ?? '', rate, newBack: nb ?? '' }
    }

    const r0 = createRowObj(f.sample_details, f.qty, f.new_back)
    if (r0) rows.push(r0)
    const r1 = createRowObj(f.sample_details_1, f.qty_1, f.new_back_1)
    if (r1) rows.push(r1)
    const r2 = createRowObj(f.sample_details_2, f.qty_2, f.new_back_2)
    if (r2) rows.push(r2)
    const r3 = createRowObj(f.sample_details_3, f.qty_3, f.new_back_3)
    if (r3) rows.push(r3)

    if (f.sample_details_4 || f.qty_4 || f.new_back_4) {
      const detailsArr = (f.sample_details_4 ?? '').split('\n').filter(Boolean)
      const qtyArr = (f.qty_4 ?? '').split('\n').filter(Boolean)
      const newBackArr = (f.new_back_4 ?? '').split('\n').filter(Boolean)

      if (detailsArr.length > 1 || qtyArr.length > 1 || newBackArr.length > 1) {
        const maxLen = Math.max(detailsArr.length, qtyArr.length, newBackArr.length)
        for (let i = 0; i < maxLen; i++) {
          const item = createRowObj(detailsArr[i], qtyArr[i], newBackArr[i])
          if (item) rows.push(item)
        }
      } else {
        const item = createRowObj(f.sample_details_4, f.qty_4, f.new_back_4)
        if (item) rows.push(item)
      }
    }

    if (rows.length === 0) rows.push({ category: '', subOption: '', sampleType: '', qty: '', rate: '', newBack: '' })
    return rows
  }

  const [sampleRows, setSampleRows] = useState<SampleRow[]>(() => makeSampleRows(form))

  const syncSampleRows = (rows: SampleRow[]) => {
    const overflowRows = rows.slice(4)
    const details4 = overflowRows.map((r) => r.sampleType).filter(Boolean).join('\n')
    const qty4 = overflowRows.map((r) => r.qty).filter(Boolean).join('\n')
    const newBack4 = overflowRows.map((r) => r.newBack).filter(Boolean).join('\n')

    update({
      sample_details: rows[0]?.sampleType ?? '', qty: rows[0]?.qty ?? '', new_back: rows[0]?.newBack ?? '',
      sample_details_1: rows[1]?.sampleType ?? '', qty_1: rows[1]?.qty ?? '', new_back_1: rows[1]?.newBack ?? '',
      sample_details_2: rows[2]?.sampleType ?? '', qty_2: rows[2]?.qty ?? '', new_back_2: rows[2]?.newBack ?? '',
      sample_details_3: rows[3]?.sampleType ?? '', qty_3: rows[3]?.qty ?? '', new_back_3: rows[3]?.newBack ?? '',
      sample_details_4: details4, qty_4: qty4, new_back_4: newBack4,
    })
  }

  const updateSampleRow = (index: number, field: keyof SampleRow, value: string | number) => {
    const next = sampleRows.map((r, i) => (i === index ? { ...r, [field]: value } : r))
    setSampleRows(next)
    syncSampleRows(next)
  }

  const handleCategoryChange = (index: number, category: string) => {
    const next = sampleRows.map((r, i) => {
      if (i !== index) return r
      return {
        ...r,
        category,
        subOption: '',
        sampleType: category ? category : r.sampleType,
      }
    })
    setSampleRows(next)
    syncSampleRows(next)
  }

  const handleSubOptionChange = (index: number, subOption: string) => {
    const next = sampleRows.map((r, i) => {
      if (i !== index) return r
      const catObj = RATE_LIST.find((c) => c.category === r.category)
      const item = catObj?.items.find((it) => it.name === subOption)
      const formattedDetail = (r.category && subOption ? `${r.category} - ${subOption}` : subOption || r.sampleType) || ''
      return {
        ...r,
        subOption,
        sampleType: formattedDetail,
        qty: item?.qty ? item.qty : r.qty,
        rate: item?.rate !== undefined ? item.rate : r.rate,
      }
    })
    setSampleRows(next)
    syncSampleRows(next)

    const totalRates = next.reduce((sum, row) => sum + (Number(row.rate) || 0), 0)
    if (totalRates > 0 && (form.total_payment === '0' || form.total_payment === '')) {
      update({ total_payment: String(totalRates) })
    }
  }

  const addSampleRow = () => {
    const next = [...sampleRows, { category: '', subOption: '', sampleType: '', qty: '', rate: '', newBack: '' }]
    setSampleRows(next)
    syncSampleRows(next)
  }

  const removeSampleRow = (index: number) => {
    if (sampleRows.length <= 1) return
    const next = sampleRows.filter((_, i) => i !== index)
    setSampleRows(next)
    syncSampleRows(next)
  }

  const autoCalculateTotal = () => {
    const total = sampleRows.reduce((sum, row) => sum + (Number(row.rate) || 0), 0)
    update({ total_payment: String(total) })
  }

  useEffect(() => {
    if (!editingId && !form.uid_no) {
      onGenerateUid().then((uid) => setForm((c) => ({ ...c, uid_no: uid }))).catch(() => { })
    }
  }, [editingId, form.uid_no, onGenerateUid])

  useEffect(() => {
    if (!editingId) {
      const timer = setTimeout(() => saveDraft(form), 500)
      return () => clearTimeout(timer)
    }
  }, [form, editingId])

  const update = (patch: Partial<RegistrationFormData>) => {
    if (patch.currently_with !== undefined && patch.currently_with.trim() !== '') {
      setCurrentlyWithError('')
    }
    setForm((c) => ({ ...c, ...patch }))
  }

  const balanceDuePreview = Math.max(0, Number(form.total_payment || 0) - Number(form.advance_payment || 0))

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setLocalError('')

    // Validate Currently With (Mandatory)
    if (!form.currently_with || form.currently_with.trim() === '') {
      setCurrentlyWithError('Please assign a staff member in "Currently With"')
      setLocalError('Currently With (Assigned User) is mandatory. Please select a user in the Handover tab.')
      setTab(6) // Switch to Handover tab
      setSaving(false)
      return
    }

    try {
      const payload = {
        ...form,
        total_payment: Number(form.total_payment || 0),
        advance_payment: Number(form.advance_payment || 0),
        balance_dues: Number(form.balance_dues || 0)
      }
      let savedId = editingId
      if (editingId) {
        await request(`/registrations/${editingId}`, { method: 'PUT', body: JSON.stringify(payload) })
      } else {
        const createRes = await request<{ registration?: { id?: number; iClientId?: number }; id?: number; iClientId?: number }>('/registrations', { method: 'POST', body: JSON.stringify(payload) })
        savedId = createRes?.registration?.id ?? createRes?.registration?.iClientId ?? createRes?.id ?? createRes?.iClientId ?? null
        clearDraft()
      }

      // Auto-upload any pending files
      if (savedId && Object.keys(pendingFiles).length > 0) {
        for (const [field, file] of Object.entries(pendingFiles)) {
          try {
            const fd = new FormData()
            fd.append('file', file)
            fd.append('field', field)
            fd.append('registration_id', String(savedId))
            await api.uploadRegistrationScan(fd)
          } catch {}
        }
      }

      setForm(emptyForm)
      setPendingFiles({})
      setTab(0)
      onSaved()
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="user-form" onSubmit={handleSubmit} style={{ minWidth: 0 }}>
      {/* Header bar */}
      <div className="wizard-header-bar">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <span className="section-label" style={{ margin: 0 }}>
              {editingId ? 'Registration Management' : 'New Client Registration'}
            </span>
            {form.uid_no ? (
              <span className="uid-link" style={{ fontSize: '0.82rem', padding: '2px 8px', background: 'var(--color-primary-tint)', borderRadius: 6 }}>
                {form.uid_no}
              </span>
            ) : null}
          </div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800 }}>
            {editingId ? `Edit Job #${form.uid_no || editingId}` : 'Register New Intake Job'}
          </h2>
        </div>
      </div>

      {/* Stepper Tabs */}
      <div className="wizard-stepper">
        {TABS.map((t, i) => {
          const Icon = t.icon
          const isActive = i === tab
          const isPassed = i < tab
          return (
            <button
              key={t.key}
              type="button"
              className={`wizard-step-btn${isActive ? ' active' : ''}${isPassed ? ' completed' : ''}`}
              onClick={() => setTab(i)}
            >
              <Icon size={14} />
              <span>{t.label}</span>
            </button>
          )
        })}
      </div>

      {localError ? <div className="error-banner" style={{ marginBottom: 16 }}>{localError}</div> : null}

      <div style={{ minHeight: 380 }}>
        {/* TAB 0: GENERAL DETAILS */}
        {tab === 0 ? (
          <div className="apple-section-card">
            <div className="apple-section-card__title">
              <ClipboardList size={16} style={{ color: 'var(--color-primary)' }} />
              General Job Information
            </div>

            <div className="field-row">
              <FormField label="UID Number" required>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    value={form.uid_no}
                    onChange={(e) => update({ uid_no: e.target.value })}
                    readOnly={!editingId}
                    className="mono"
                    style={{ fontWeight: 700, color: 'var(--color-primary)' }}
                  />
                  {!editingId ? (
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => {
                        onGenerateUid().then((uid) => update({ uid_no: uid })).catch(() => {})
                      }}
                      disabled={generatingUid}
                      title="Generate UID"
                    >
                      <Sparkles size={14} /> Auto
                    </button>
                  ) : null}
                </div>
              </FormField>

              <DatePicker
                value={form.received_date}
                onChange={(v) => update({ received_date: v })}
                label="Intake Received Date"
                required
              />
            </div>

            <FormField label="Name of Work / Project" required description="Brief description of project or testing scope">
              <input
                value={form.name_of_work}
                onChange={(e) => update({ name_of_work: e.target.value })}
                placeholder="e.g. Construction of Commercial Complex at Sector 14"
              />
            </FormField>

            <div className="field-row">
              <FormField label="Work Order Number">
                <input
                  value={form.work_order_no ?? ''}
                  onChange={(e) => update({ work_order_no: e.target.value })}
                  placeholder="e.g. WO-2026-88"
                />
              </FormField>
              <FormField label="Reference Of / Client Ref">
                <input
                  value={form.reference ?? ''}
                  onChange={(e) => update({ reference: e.target.value })}
                  placeholder="e.g. Letter no. 452"
                />
              </FormField>
            </div>

            <div className="field-row">
              <FormField label="Work Category">
                <select value={form.work ?? ''} onChange={(e) => update({ work: e.target.value })}>
                  {WORK_TYPES.map((w) => <option key={w} value={w}>{w || 'Select Work Category'}</option>)}
                </select>
              </FormField>

              <FormField label="Report Status / Remarks">
                <input
                  value={form.report_status ?? ''}
                  onChange={(e) => update({ report_status: e.target.value })}
                  placeholder="e.g. In lab testing / Urgent report needed"
                />
              </FormField>
            </div>
          </div>
        ) : null}

        {/* TAB 1: CLIENT INFORMATION */}
        {tab === 1 ? (
          <div className="apple-section-card">
            <div className="apple-section-card__title">
              <Building2 size={16} style={{ color: 'var(--color-primary)' }} />
              Client & Agency Contact Details
            </div>

            {/* Quick search existing */}
            <FormField label="Search Existing Client / Agency" description="Quickly auto-fill from previous registrations">
              <div style={{ position: 'relative' }}>
                <input
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    if (searchTimer.current) clearTimeout(searchTimer.current)
                    const q = e.target.value
                    if (q.length < 2) { setSearchResults([]); return }
                    searchTimer.current = setTimeout(async () => {
                      try { const res = await api.searchCustomers(q); setSearchResults(res.data) } catch {}
                    }, 300)
                  }}
                  placeholder="Type agency name, contact number, or previous UID..."
                />
                {searchResults.length > 0 ? (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20,
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)',
                    boxShadow: 'var(--shadow-lg)',
                    maxHeight: 220, overflowY: 'auto', marginTop: 4,
                  }}>
                    {searchResults.map((r) => (
                      <div
                        key={r.iClientId}
                        style={{
                          padding: '10px 14px', cursor: 'pointer',
                          borderBottom: '1px solid var(--color-border-light)',
                          fontSize: '0.84rem',
                        }}
                        onClick={() => {
                          update({
                            agency_name: r.agency_name,
                            reporting_address: r.reporting_address,
                            mobile_no: r.mobile_no,
                            name_of_work: r.name_of_work || form.name_of_work
                          })
                          setSearchQuery('')
                          setSearchResults([])
                        }}
                      >
                        <strong style={{ color: 'var(--gray-900)' }}>{r.agency_name}</strong> &middot; <span style={{ color: 'var(--color-primary)' }}>{r.mobile_no}</span>
                        <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)', marginTop: 2 }}>{r.uid_no} &bull; {r.reporting_address}</div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </FormField>

            <div className="field-row">
              <FormField label="Agency / Company Name" required>
                <input
                  value={form.agency_name}
                  onChange={(e) => update({ agency_name: e.target.value })}
                  placeholder="e.g. ABC Infrastructure Pvt Ltd"
                />
              </FormField>

              <FormField label="Mobile Number" required>
                <input
                  value={form.mobile_no}
                  onChange={(e) => update({ mobile_no: e.target.value })}
                  placeholder="10-digit mobile number"
                />
              </FormField>
            </div>

            <FormField label="Reporting Address / Department Details">
              <textarea
                rows={2}
                value={form.reporting_address}
                onChange={(e) => update({ reporting_address: e.target.value })}
                placeholder="Full reporting address, department name, contact person..."
              />
            </FormField>
          </div>
        ) : null}

        {/* TAB 2: SAMPLES & TESTS */}
        {tab === 2 ? (
          <div className="apple-section-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div className="apple-section-card__title" style={{ margin: 0 }}>
                <FlaskConical size={16} style={{ color: 'var(--color-primary)' }} />
                Sample Items ({sampleRows.length})
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn btn-outline btn-sm" onClick={autoCalculateTotal}>
                  <Calculator size={13} /> Auto-Sum Rates
                </button>
                <button type="button" className="btn btn-primary btn-sm" onClick={addSampleRow}>
                  <Plus size={13} /> Add Sample
                </button>
              </div>
            </div>

            {sampleRows.map((row, i) => {
              const currentCatObj = RATE_LIST.find((c) => c.category === row.category)
              const subOptions = currentCatObj?.items ?? []
              const selectedItem = subOptions.find((it) => it.name === row.subOption)

              return (
                <div key={i} className="sample-row-card">
                  <div className="sample-row-card__header">
                    <strong style={{ fontSize: '0.82rem', color: 'var(--gray-900)' }}>
                      Sample #{i + 1} {row.sampleType ? `— ${row.sampleType}` : ''}
                    </strong>
                    {sampleRows.length > 1 ? (
                      <button
                        type="button"
                        className="icon-btn text-danger"
                        onClick={() => removeSampleRow(i)}
                        title="Remove Sample"
                      >
                        <X size={14} />
                      </button>
                    ) : null}
                  </div>

                  <div className="field-row" style={{ marginBottom: 8 }}>
                    <FormField label="Type">
                      <select value={row.newBack} onChange={(e) => updateSampleRow(i, 'newBack', e.target.value)}>
                        {NEW_BACK_OPTIONS.map((v) => <option key={v} value={v}>{v || 'New'}</option>)}
                      </select>
                    </FormField>

                    <FormField label="Rate List Category">
                      <select value={row.category ?? ''} onChange={(e) => handleCategoryChange(i, e.target.value)}>
                        <option value="">-- Choose Category --</option>
                        {RATE_LIST.map((c) => <option key={c.category} value={c.category}>{c.category}</option>)}
                        <option value="Other">Other / Custom</option>
                      </select>
                    </FormField>

                    <FormField label="Test Sub-Type">
                      {row.category === 'Other' || subOptions.length === 0 ? (
                        <input
                          value={row.subOption ?? ''}
                          onChange={(e) => {
                            const customSub = e.target.value
                            const next = sampleRows.map((r, idx) => {
                              if (idx !== i) return r
                              const formatted = (r.category && customSub ? `${r.category} - ${customSub}` : customSub || r.category) || ''
                              return { ...r, subOption: customSub, sampleType: formatted }
                            })
                            setSampleRows(next)
                            syncSampleRows(next)
                          }}
                          placeholder="Type test name"
                        />
                      ) : (
                        <select
                          value={row.subOption ?? ''}
                          onChange={(e) => handleSubOptionChange(i, e.target.value)}
                          disabled={!row.category}
                        >
                          <option value="">Select test...</option>
                          {subOptions.map((it) => (
                            <option key={it.name} value={it.name}>
                              {it.name} {it.rate ? `(₹${it.rate})` : ''}
                            </option>
                          ))}
                        </select>
                      )}
                    </FormField>
                  </div>

                  <div className="field-row" style={{ marginBottom: 4 }}>
                    <FormField label="Sample Details (Full Name)">
                      <input
                        value={row.sampleType}
                        onChange={(e) => updateSampleRow(i, 'sampleType', e.target.value)}
                        placeholder="e.g. Concrete Cube 150mm"
                      />
                    </FormField>

                    <FormField label="Quantity">
                      <input
                        value={row.qty}
                        onChange={(e) => updateSampleRow(i, 'qty', e.target.value)}
                        placeholder="e.g. 3 Nos, 10 Kg"
                      />
                    </FormField>

                    <FormField label="Standard Rate (₹)">
                      <input
                        type="number"
                        value={row.rate ?? ''}
                        onChange={(e) => updateSampleRow(i, 'rate', e.target.value)}
                        placeholder="Rate"
                      />
                    </FormField>
                  </div>

                  {selectedItem ? (
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-green-text)', marginTop: 4, display: 'flex', gap: 14 }}>
                      {selectedItem.time ? <span>⏱ Time: <strong>{selectedItem.time}</strong></span> : null}
                      {selectedItem.qty ? <span>📦 Req Qty: <strong>{selectedItem.qty}</strong></span> : null}
                      {selectedItem.rate !== undefined ? <span>💰 Standard Rate: <strong>₹{selectedItem.rate}</strong></span> : null}
                    </div>
                  ) : null}
                </div>
              )
            })}

            <div className="rate-summary-pill">
              <span className="rate-summary-pill__label">Sum of Sample Estimated Rates</span>
              <span className="rate-summary-pill__value">
                ₹{sampleRows.reduce((sum, r) => sum + (Number(r.rate) || 0), 0)}
              </span>
            </div>
          </div>
        ) : null}

        {/* TAB 3: OFFICE WORK */}
        {tab === 3 ? (
          <div className="apple-section-card">
            <div className="apple-section-card__title">
              <Briefcase size={16} style={{ color: 'var(--color-primary)' }} />
              Office Processing & Report Workflow
            </div>

            <div className="field-row">
              <FormField label="Report Number">
                <input
                  value={form.report_no ?? ''}
                  onChange={(e) => update({ report_no: e.target.value })}
                  placeholder="e.g. REP-2026-001"
                />
              </FormField>

              <FormField label="Field Person Name">
                <input
                  value={form.field_person_name ?? ''}
                  onChange={(e) => update({ field_person_name: e.target.value })}
                  placeholder="Field engineer or sample collector"
                />
              </FormField>
            </div>

            <div className="field-row">
              <DatePicker
                value={form.prepared_date ?? ''}
                onChange={(v) => update({ prepared_date: v })}
                label="Report Prepared Date"
              />
              <DatePicker
                value={form.dispatch_date ?? ''}
                onChange={(v) => update({ dispatch_date: v })}
                label="Report Dispatch Date"
              />
            </div>

            <div className="field-row">
              <FormField label="Assign Role">
                <select value={form.assign_to} onChange={(e) => update({ assign_to: e.target.value })}>
                  {ASSIGN_OPTIONS.map((v) => <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>)}
                </select>
              </FormField>

              <FormField label="Report Status">
                <select value={form.report_status ?? ''} onChange={(e) => update({ report_status: e.target.value })}>
                  {REPORT_STATUS_OPTIONS.map((v) => <option key={v} value={v}>{v || 'Select Report Status'}</option>)}
                </select>
              </FormField>
            </div>
          </div>
        ) : null}

        {/* TAB 4: FINANCIAL DETAILS */}
        {tab === 4 ? (
          <div className="apple-section-card">
            <div className="apple-section-card__title">
              <IndianRupee size={16} style={{ color: 'var(--color-primary)' }} />
              Financial & Payment Status
            </div>

            <div className="field-row">
              <FormField label="Total Payment (₹)" required>
                <input
                  type="number"
                  value={form.total_payment}
                  onChange={(e) => {
                    const total = Number(e.target.value || 0)
                    const adv = Number(form.advance_payment || 0)
                    update({
                      total_payment: e.target.value,
                      balance_dues: String(Math.max(0, total - adv))
                    })
                  }}
                />
              </FormField>

              <FormField label="Advance Received (₹)">
                <input
                  type="number"
                  value={form.advance_payment}
                  onChange={(e) => {
                    const adv = Number(e.target.value || 0)
                    const total = Number(form.total_payment || 0)
                    update({
                      advance_payment: e.target.value,
                      balance_dues: String(Math.max(0, total - adv))
                    })
                  }}
                />
              </FormField>
            </div>

            <div className="field-row">
              <FormField label="Balance Dues (₹)">
                <input
                  type="number"
                  value={form.balance_dues}
                  onChange={(e) => update({ balance_dues: e.target.value })}
                />
              </FormField>

              <FormField label="Auto Balance Preview">
                <input
                  value={`₹${balanceDuePreview}`}
                  readOnly
                  className="mono"
                  style={{ fontWeight: 700, color: balanceDuePreview > 0 ? 'var(--color-red-text)' : 'var(--color-green-text)' }}
                />
              </FormField>
            </div>

            <div className="field-row">
              <FormField label="Mode of Payment">
                <select value={form.mode_of_payment ?? ''} onChange={(e) => update({ mode_of_payment: e.target.value })}>
                  {PAYMENT_MODES.map((v) => <option key={v} value={v}>{v ? v.toUpperCase() : 'Select Mode'}</option>)}
                </select>
              </FormField>

              <FormField label="Payment Follow-up Note">
                <input
                  value={form.payment_followup}
                  onChange={(e) => update({ payment_followup: e.target.value })}
                  placeholder="e.g. Call after dispatch"
                />
              </FormField>
            </div>

            <div className="field-row">
              <FormField label="GST Number">
                <input
                  value={form.gst_no ?? ''}
                  onChange={(e) => update({ gst_no: e.target.value })}
                  placeholder="GSTIN"
                />
              </FormField>

              <FormField label="Financial Remark">
                <input
                  value={form.financial_remark ?? ''}
                  onChange={(e) => update({ financial_remark: e.target.value })}
                  placeholder="Invoice remarks"
                />
              </FormField>
            </div>

            <FormField label="General Job Remarks">
              <textarea
                rows={2}
                value={form.remark ?? ''}
                onChange={(e) => update({ remark: e.target.value })}
                placeholder="Special instructions or remarks..."
              />
            </FormField>
          </div>
        ) : null}

        {/* TAB 5: ATTACHMENTS & DOCUMENT ARCHIVES */}
        {tab === 5 ? (
          <div className="apple-section-card">
            <div className="apple-section-card__title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Paperclip size={16} style={{ color: 'var(--color-primary)' }} />
                <span>Scans & Document Attachments</span>
              </div>
              {uploadMsg ? (
                <span style={{ fontSize: '0.78rem', color: 'var(--color-green-text)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <CheckCircle2 size={14} /> {uploadMsg}
                </span>
              ) : null}
            </div>

            <p style={{ color: 'var(--gray-500)', fontSize: '0.82rem', marginBottom: 16 }}>
              Upload scan copies, test requests, or client work orders. Files are saved and automatically archived into the Document Library.
            </p>

            <div style={{ display: 'grid', gap: 12 }}>
              {[0, 1, 2, 3, 4].map((idx) => {
                const field = idx === 0 ? 'scan_copy' : (`scan_copy_${idx}` as keyof RegistrationFormData)
                const filePath = form[field] as string | undefined
                const isUploading = uploadingSlot === idx
                const pendingFile = pendingFiles[field as string]
                const hasFile = Boolean(filePath || pendingFile)
                const fileName = pendingFile ? pendingFile.name : (filePath ? filePath.split('/').pop() : '')
                const fileUrl = filePath ? (filePath.startsWith('http') ? filePath : `${API_ORIGIN}/storage/${filePath}`) : ''

                return (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      borderRadius: 'var(--radius-sm)',
                      background: hasFile ? 'rgba(0, 113, 227, 0.03)' : 'var(--gray-50)',
                      border: `1px solid ${hasFile ? 'rgba(0, 113, 227, 0.2)' : 'var(--color-border)'}`,
                      gap: 12,
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 220 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 8,
                        background: hasFile ? 'var(--color-primary-tint)' : 'var(--gray-200)',
                        color: hasFile ? 'var(--color-primary)' : 'var(--gray-500)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        <FileText size={18} />
                      </div>
                      <div>
                        <strong style={{ fontSize: '0.84rem', color: 'var(--gray-900)', display: 'block' }}>
                          Scan Copy #{idx + 1}
                        </strong>
                        {hasFile ? (
                          <div style={{ fontSize: '0.74rem', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                            <span style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileName}</span>
                            <span style={{ color: 'var(--color-green-text)', fontWeight: 600 }}>&bull; Attached</span>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.74rem', color: 'var(--gray-400)' }}>No document uploaded</span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {hasFile && fileUrl ? (
                        <a
                          href={fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-outline btn-xs"
                          title="Open attached document in new tab"
                        >
                          <Eye size={13} /> View File
                        </a>
                      ) : null}

                      <label
                        className={`btn ${hasFile ? 'btn-outline' : 'btn-primary'} btn-xs`}
                        style={{ cursor: isUploading ? 'not-allowed' : 'pointer', margin: 0, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      >
                        <Upload size={13} /> {isUploading ? 'Uploading...' : hasFile ? 'Replace' : 'Upload Document'}
                        <input
                          type="file"
                          hidden
                          disabled={isUploading}
                          accept=".jpg,.jpeg,.png,.pdf,.docx,.xlsx,.csv"
                          onChange={(e) => handleUploadScan(idx, e.target.files?.[0])}
                        />
                      </label>

                      {hasFile ? (
                        <button
                          type="button"
                          className="icon-btn text-danger"
                          onClick={() => handleRemoveScan(idx)}
                          title="Remove attachment"
                        >
                          <Trash2 size={14} />
                        </button>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : null}

        {/* TAB 6: STAGE & HANDOVER (SEPARATE TAB) */}
        {tab === 6 ? (
          <div className="apple-section-card">
            <div className="apple-section-card__title">
              <UserCheck size={16} style={{ color: 'var(--color-primary)' }} />
              Stage Workflow & Handover Assignment
            </div>

            <div className="field-row">
              <FormField label="Current Stage" required>
                <select
                  value={form.current_stage ?? '1. Registered'}
                  onChange={(e) => update({ current_stage: e.target.value })}
                  style={{ fontWeight: 600 }}
                >
                  {WORKFLOW_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </FormField>

              <FormField
                label="Currently With (Assigned User)"
                required
                error={currentlyWithError}
              >
                <select
                  value={form.currently_with ?? ''}
                  onChange={(e) => update({ currently_with: e.target.value })}
                  style={{
                    borderColor: currentlyWithError ? '#ef4444' : undefined,
                    fontWeight: 600,
                  }}
                >
                  <option value="">-- Select Assigned Staff (Mandatory) --</option>
                  {usersList.map((u) => {
                    const fullName = u.name || `${u.firstname ?? ''} ${u.lastname ?? ''}`.trim() || `User #${u.id}`
                    const roleLabel = u.tracker_role ? ` (${u.tracker_role})` : ''
                    return (
                      <option key={u.id} value={fullName}>
                        {fullName}{roleLabel}
                      </option>
                    )
                  })}
                </select>
              </FormField>
            </div>

            <div className="field-row">
              <FormField label="Priority Level">
                <select
                  value={form.priority ?? 'Medium'}
                  onChange={(e) => update({ priority: e.target.value })}
                >
                  {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </FormField>

              <DatePicker
                value={form.target_date ?? ''}
                onChange={(v) => update({ target_date: v })}
                label="Target SLA Completion Date"
              />
            </div>

            <div className="field-row">
              <FormField label="Payment Status">
                <select
                  value={form.payment_status ?? 'Not Invoiced'}
                  onChange={(e) => update({ payment_status: e.target.value })}
                >
                  {PAYMENT_STATUS_OPTIONS.map((ps) => <option key={ps} value={ps}>{ps}</option>)}
                </select>
              </FormField>

              <FormField label="Handover Note / Remarks" description="Optional reason for stage handover">
                <input
                  value={form.handover_note ?? ''}
                  onChange={(e) => update({ handover_note: e.target.value })}
                  placeholder="e.g. Field work completed, sample delivered to lab"
                />
              </FormField>
            </div>

            {/* Handover History (Audit Trail) */}
            {initial.stage_logs && initial.stage_logs.length > 0 ? (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--color-border-light)' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--gray-700)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                  <Clock size={13} /> Previous Handover History ({initial.stage_logs.length})
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 180, overflowY: 'auto' }}>
                  {initial.stage_logs.map((log) => (
                    <div key={log.id} style={{ padding: '8px 12px', background: 'var(--gray-50)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', fontSize: '0.78rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--gray-900)', fontWeight: 600 }}>
                        <span>{log.stage_set}</span>
                        <span style={{ color: 'var(--gray-400)', fontSize: '0.72rem', fontFamily: 'var(--font-data)' }}>
                          {log.created_at ? new Date(log.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}
                        </span>
                      </div>
                      {log.from_person || log.to_person ? (
                        <div style={{ color: 'var(--gray-600)', marginTop: 2 }}>
                          {log.from_person ? <span>From: <strong>{log.from_person}</strong> ➔ </span> : null}
                          {log.to_person ? <span>To: <strong>{log.to_person}</strong></span> : null}
                        </div>
                      ) : null}
                      {log.note ? <div style={{ color: 'var(--gray-500)', fontStyle: 'italic', marginTop: 2 }}>"{log.note}"</div> : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Footer Navigation Bar */}
      <div className="wizard-footer-actions">
        <div>
          {tab > 0 ? (
            <button
              className="btn btn-outline btn-sm"
              onClick={() => setTab((s) => s - 1)}
              type="button"
            >
              <ArrowLeft size={14} /> Back
            </button>
          ) : (
            <button
              className="btn btn-outline btn-sm"
              onClick={onCancel}
              type="button"
            >
              Cancel
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {!editingId ? (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => { saveDraft(form); setLocalError('Draft saved to storage') }}
            >
              <Save size={14} /> Save Draft
            </button>
          ) : null}

          {tab < TABS.length - 1 ? (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setTab((s) => s + 1)}
            >
              Next <ArrowRight size={14} />
            </button>
          ) : (
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={saving}
            >
              <Save size={14} /> {saving ? 'Saving...' : editingId ? 'Update Registration' : 'Complete Registration'}
            </button>
          )}
        </div>
      </div>
    </form>
  )
}
