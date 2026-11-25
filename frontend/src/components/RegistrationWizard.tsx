import { useEffect, useState, useRef, type FormEvent } from 'react'
import {
  ClipboardList, ArrowLeft, ArrowRight, Save, Plus, X, Building2,
  FlaskConical, Paperclip, IndianRupee, Briefcase, Calculator,
  CheckCircle2, Clock, FileText, UserCheck, Eye, Trash2, Upload
} from 'lucide-react'
import type { RegistrationFormData } from '../lib/types'
import { api, request, resolveFileUrl } from '../lib/api'
import { FormField, DatePicker } from './ui'
import { SearchableSelect } from './SearchableSelect'
import { RATE_LIST } from '../data/rateList'
import { Select } from './Select'
import { MultiDropdown } from './MultiDropdown'

const WORK_TYPES = ['', 'Audit', 'SPT / Outsource', 'Lab', 'Consultancy', 'Survey', 'Field Test']
const NEW_BACK_OPTIONS = ['', 'new', 'back']
const REPORT_STATUS_OPTIONS = ['', 'Processing', 'lab process', 'Report Complete', 'Report Pending', 'Report Dispatched']
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
  sample_items: '',
  new_back: '', new_back_1: '', new_back_2: '', new_back_3: '', new_back_4: '',
  total_payment: '0', advance_payment: '0', balance_dues: '0', payment_followup: '', payment_received_date: '',
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
  is_draft: false,
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

/** One test line inside a sample: a sub-type from the rate list, or a custom test typed by the user. */
interface SubItem {
  name: string
  /** Custom tests only: their own qty and rate. List tests keep qty 1 and their list rate (used to fill the sample's Rate). */
  qty: string
  rate: string
  custom?: boolean
}

/**
 * One sample card: a category, the selected test sub-types, and ONE qty + rate for the
 * whole sample (rate defaults to the sum of the selected tests' list rates).
 * Custom tests are added on top with their own qty × rate. Saved as JSON in `sample_items`.
 */
interface SampleRow {
  category: string
  newBack: string
  qty: string
  rate: string
  items: SubItem[]
}

/** The legacy sample_details / qty columns are varchar(222). */
const LEGACY_TEXT_MAX = 222
const OTHER_CATEGORY = 'Other'

const emptySampleRow = (): SampleRow => ({ category: '', newBack: '', qty: '1', rate: '', items: [] })
const newCustomItem = (): SubItem => ({ name: '', qty: '1', rate: '', custom: true })

function itemAmount(item: SubItem): number {
  return (Number(item.qty) || 0) * (Number(item.rate) || 0)
}

/** Sum of the list rates of the selected (non-custom) tests: the default Rate for the sample. */
function listRateSum(items: SubItem[]): string {
  const list = items.filter((it) => !it.custom)
  return list.length ? String(list.reduce((s, it) => s + (Number(it.rate) || 0), 0)) : ''
}

/** Qty × Rate for the selected list tests (0 when none are selected). */
function listAmount(row: SampleRow): number {
  if (!row.items.some((it) => !it.custom)) return 0
  return (Number(row.qty) || 0) * (Number(row.rate) || 0)
}

function rowAmount(row: SampleRow): number {
  return listAmount(row) + row.items.filter((it) => it.custom).reduce((s, it) => s + itemAmount(it), 0)
}

function sampleTotal(rows: SampleRow[]): number {
  return rows.reduce((sum, row) => sum + rowAmount(row), 0)
}

function totalPatch(total: number, advance: string | number | undefined) {
  return { total_payment: String(total), balance_dues: String(Math.max(0, total - Number(advance || 0))) }
}

function sameText(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

function findRateCategory(name: string) {
  return name ? RATE_LIST.find((c) => sameText(c.category, name)) : undefined
}

/** Text written to the old sample_details column, e.g. "Bricks - Efflorescence, Water Absorption". */
function sampleLabel(row: SampleRow): string {
  const names = row.items.map((it) => it.name.trim()).filter(Boolean)
  const category = row.category && row.category !== OTHER_CATEGORY ? row.category : ''
  if (names.length === 0) return category
  return category ? `${category} - ${names.join(', ')}` : names.join(', ')
}

/** Text written to the old qty column: the sample qty, or the custom tests' qty when there are no list tests. */
function sampleQtyText(row: SampleRow): string {
  if (row.items.some((it) => !it.custom)) return row.qty
  const custom = row.items.filter((it) => it.custom)
  return custom.length ? String(custom.reduce((s, it) => s + (Number(it.qty) || 0), 0)) : ''
}

function clipLegacy(text: string): string {
  return text.length > LEGACY_TEXT_MAX ? `${text.slice(0, LEGACY_TEXT_MAX - 3)}...` : text
}

/** Reads the saved JSON in `sample_items`; null when missing or unreadable. */
function parseSampleItems(json?: string | null): SampleRow[] | null {
  if (!json) return null
  try {
    const data = JSON.parse(json)
    if (!Array.isArray(data) || data.length === 0) return null
    return data.map((r) => {
      const items: SubItem[] = Array.isArray(r?.items)
        ? r.items.map((it: Partial<SubItem>) => ({
            name: String(it?.name ?? ''),
            qty: String(it?.qty ?? '1'),
            rate: String(it?.rate ?? ''),
            custom: Boolean(it?.custom),
          }))
        : []
      return {
        category: String(r?.category ?? ''),
        newBack: String(r?.newBack ?? ''),
        qty: r?.qty !== undefined && r?.qty !== null ? String(r.qty) : '1',
        rate: r?.rate !== undefined && r?.rate !== null ? String(r.rate) : listRateSum(items),
        items,
      }
    })
  } catch {
    return null
  }
}

/** Turns an old free-text sample ("Bricks - Efflorescence") into a card. Old quantities reset to 1. */
function legacySampleRow(text?: string, newBack?: string): SampleRow | null {
  const raw = (text ?? '').trim()
  if (!raw && !newBack) return null
  const base = { newBack: newBack ?? '', qty: '1' }
  if (!raw) return { ...base, category: '', rate: '', items: [] }

  const dash = raw.match(/^(.+?)\s*[-—–]\s*(.+)$/)
  let category = dash ? findRateCategory(dash[1]) : undefined
  let rest = dash && category ? dash[2].trim() : raw

  if (!category) {
    const wholeCategory = findRateCategory(raw)
    if (wholeCategory) return { ...base, category: wholeCategory.category, rate: '', items: [] }
    category = RATE_LIST.find((c) => c.items.some((it) => sameText(it.name, raw)))
    rest = raw
  }
  if (!category) {
    return { ...base, category: OTHER_CATEGORY, rate: '', items: [{ name: raw, qty: '1', rate: '', custom: true }] }
  }

  const findItem = (name: string) => category?.items.find((it) => sameText(it.name, name))
  const parts = findItem(rest) || !rest.includes(',') ? [rest] : rest.split(/\s*,\s*/).filter(Boolean)
  const items: SubItem[] = parts.map((part) => {
    const item = findItem(part)
    return item
      ? { name: item.name, qty: '1', rate: item.rate !== undefined ? String(item.rate) : '' }
      : { name: part, qty: '1', rate: '', custom: true }
  })
  return { ...base, category: category.category, rate: listRateSum(items), items }
}

/** Multi-select dropdown (checkboxes) of a category's test sub-types. */
function SubTypeMultiSelect({ options, selected, onToggle, disabled }: {
  options: Array<{ name: string; rate?: number }>
  selected: string[]
  onToggle: (name: string) => void
  disabled?: boolean
}) {
  return (
    <MultiDropdown disabled={disabled} placeholder={disabled ? 'Choose a category first' : 'Select tests...'} emptyText="No tests in this category"
      options={options.map((o) => ({ value: o.name, note: o.rate !== undefined ? `(₹${o.rate})` : undefined }))}
      isChosen={(name) => selected.some((x) => sameText(x, name))} onToggle={onToggle} />
  )
}

export function RegistrationWizard({
  editingId,
  initial,
  onSaved,
  onCancel,
  onGenerateUid
}: Props) {
  const [tab, setTab] = useState(0)
  const [form, setForm] = useState<RegistrationFormData>(() => {
    if (editingId) return initial
    const draft = loadDraft()
    // Never reuse a UID from an earlier unsaved form: someone may have taken that number since.
    // A fresh UID is generated on open (see the effect below).
    return { ...emptyForm, ...draft, uid_no: '', received_date: new Date().toISOString().slice(0, 10) }
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
  const [uploadProgress, setUploadProgress] = useState(0)
  // Show enough slots for the highest attachment already saved (in steps of 3, max 10).
  const [visibleScanSlots, setVisibleScanSlots] = useState(() => {
    let last = -1
    for (let i = 0; i < 10; i++) {
      if (form[(i === 0 ? 'scan_copy' : `scan_copy_${i}`) as keyof RegistrationFormData]) last = i
    }
    return Math.min(10, Math.max(3, Math.ceil((last + 1) / 3) * 3))
  })
  const [uploadMsg, setUploadMsg] = useState('')
  const [pendingFiles, setPendingFiles] = useState<Record<string, File>>({})

  const handleUploadScan = async (idx: number, file?: File) => {
    if (!file) return
    const MAX_UPLOAD_MB = 15
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      setLocalError(`"${file.name}" is ${(file.size / 1024 / 1024).toFixed(1)} MB. Files must be ${MAX_UPLOAD_MB} MB or smaller.`)
      return
    }
    setLocalError('')
    const field = idx === 0 ? 'scan_copy' : `scan_copy_${idx}`

    if (editingId) {
      setUploadingSlot(idx)
      setUploadProgress(0)
      setUploadMsg('')
      try {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('field', field)
        fd.append('registration_id', String(editingId))
        const res = await api.uploadRegistrationScan(fd, setUploadProgress)
        update({ [field]: res.path })
        setUploadMsg(`Scan Document #${idx + 1} uploaded & saved!`)
        setTimeout(() => setUploadMsg(''), 4000)
      } catch (err) {
        setLocalError(err instanceof Error ? err.message : 'Failed to upload document')
      } finally {
        setUploadingSlot(null)
        setUploadProgress(0)
      }
    } else {
      setPendingFiles((prev) => ({ ...prev, [field]: file }))
      update({ [field]: file.name })
      setUploadMsg(`Document #${idx + 1} ready to attach on save`)
      setTimeout(() => setUploadMsg(''), 4000)
    }
  }

  const handleRemoveScan = async (idx: number) => {
    const field = idx === 0 ? 'scan_copy' : `scan_copy_${idx}`
    // A file already saved on the server is deleted there too (also removes it from the Document Repository).
    if (editingId && !pendingFiles[field] && form[field as keyof RegistrationFormData]) {
      if (!window.confirm(`Delete Scan Copy #${idx + 1}? It will also be removed from the document repository.`)) return
      try {
        await api.removeRegistrationAttachment(editingId, field)
      } catch (err) {
        setLocalError(err instanceof Error ? err.message : 'Failed to delete document')
        return
      }
    }
    setPendingFiles((prev) => {
      const next = { ...prev }
      delete next[field]
      return next
    })
    update({ [field]: '' })
  }

  useEffect(() => {
    api.assignableUsers().then((res) => {
      setUsersList(res.data || [])
    }).catch((err) => {
      setLocalError(`Could not load staff list for "Currently With": ${err instanceof Error ? err.message : 'unknown error'}`)
    })
  }, [])

  const makeSampleRows = (f: RegistrationFormData): SampleRow[] => {
    const saved = parseSampleItems(f.sample_items)
    if (saved) return saved

    // Older registrations only have the free-text columns
    const rows: SampleRow[] = []
    const pairs: Array<[string | undefined, string | undefined]> = [
      [f.sample_details, f.new_back],
      [f.sample_details_1, f.new_back_1],
      [f.sample_details_2, f.new_back_2],
      [f.sample_details_3, f.new_back_3],
    ]
    const overflow = (f.sample_details_4 ?? '').split('\n').filter(Boolean)
    const overflowNewBack = (f.new_back_4 ?? '').split('\n').filter(Boolean)
    overflow.forEach((text, i) => pairs.push([text, overflowNewBack[i]]))

    for (const [text, newBack] of pairs) {
      const row = legacySampleRow(text, newBack)
      if (row) rows.push(row)
    }
    if (rows.length === 0) rows.push(emptySampleRow())
    return rows
  }

  const [sampleRows, setSampleRows] = useState<SampleRow[]>(() => makeSampleRows(form))
  // Once the user types their own Total Payment, sample changes stop overwriting it.
  const [totalTouched, setTotalTouched] = useState(false)

  const syncSampleRows = (rows: SampleRow[]) => {
    const totals = totalTouched ? {} : totalPatch(sampleTotal(rows), form.advance_payment)
    const overflowRows = rows.slice(4)
    const field = (i: number) => ({
      details: clipLegacy(rows[i] ? sampleLabel(rows[i]) : ''),
      qty: rows[i] ? sampleQtyText(rows[i]) : '',
      newBack: rows[i]?.newBack ?? '',
    })
    const [r0, r1, r2, r3] = [field(0), field(1), field(2), field(3)]

    update({
      sample_details: r0.details, qty: r0.qty, new_back: r0.newBack,
      sample_details_1: r1.details, qty_1: r1.qty, new_back_1: r1.newBack,
      sample_details_2: r2.details, qty_2: r2.qty, new_back_2: r2.newBack,
      sample_details_3: r3.details, qty_3: r3.qty, new_back_3: r3.newBack,
      sample_details_4: clipLegacy(overflowRows.map(sampleLabel).filter(Boolean).join('\n')),
      qty_4: clipLegacy(overflowRows.map(sampleQtyText).filter(Boolean).join('\n')),
      new_back_4: clipLegacy(overflowRows.map((r) => r.newBack).filter(Boolean).join('\n')),
      sample_items: JSON.stringify(rows),
      ...totals,
    })
  }

  const changeRow = (index: number, change: (row: SampleRow) => SampleRow) => {
    const next = sampleRows.map((r, i) => (i === index ? change(r) : r))
    setSampleRows(next)
    syncSampleRows(next)
  }

  const handleCategoryChange = (index: number, category: string) => {
    changeRow(index, (r) => ({
      ...r,
      category,
      qty: '1',
      rate: '',
      // "Other / Custom" category starts with one blank custom test line
      items: category === OTHER_CATEGORY ? [newCustomItem()] : [],
    }))
  }

  const toggleSubType = (index: number, name: string) => {
    changeRow(index, (r) => {
      let items: SubItem[]
      if (r.items.some((it) => !it.custom && sameText(it.name, name))) {
        items = r.items.filter((it) => it.custom || !sameText(it.name, name))
      } else {
        const item = findRateCategory(r.category)?.items.find((it) => sameText(it.name, name))
        items = [...r.items, { name: item?.name ?? name, qty: '1', rate: item?.rate !== undefined ? String(item.rate) : '' }]
      }
      // Rate follows the selected tests' list prices (it can still be edited afterwards)
      return { ...r, items, rate: listRateSum(items) }
    })
  }

  const addCustomItem = (index: number) => {
    changeRow(index, (r) => ({ ...r, items: [...r.items, newCustomItem()] }))
  }

  const updateItem = (index: number, itemIndex: number, field: 'name' | 'qty' | 'rate', value: string) => {
    changeRow(index, (r) => ({ ...r, items: r.items.map((it, j) => (j === itemIndex ? { ...it, [field]: value } : it)) }))
  }

  const removeItem = (index: number, itemIndex: number) => {
    changeRow(index, (r) => ({ ...r, items: r.items.filter((_, j) => j !== itemIndex) }))
  }

  const updateRowField = (index: number, field: 'qty' | 'rate', value: string) => {
    changeRow(index, (r) => ({ ...r, [field]: value }))
  }

  const updateNewBack = (index: number, newBack: string) => {
    changeRow(index, (r) => ({ ...r, newBack }))
  }

  const addSampleRow = () => {
    const next = [...sampleRows, emptySampleRow()]
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
    setTotalTouched(false)
    update(totalPatch(sampleTotal(sampleRows), form.advance_payment))
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
    if (!form.is_draft && (!form.currently_with || form.currently_with.trim() === '')) {
      setCurrentlyWithError('Please assign a staff member in "Currently With"')
      setLocalError('Currently With (Assigned User) is mandatory. Please select a user in the Handover tab.')
      setTab(6) // Switch to Handover tab
      setSaving(false)
      return
    }

    // Sample #1 needs at least one named test (this fills Sample Details)
    if (!sampleRows[0]?.items.some((it) => it.name.trim())) {
      setLocalError('Sample #1 needs a Test Category and at least one Test Sub-Type (or a named custom test).')
      setTab(2) // Switch to Samples tab
      setSaving(false)
      return
    }

    try {
      const payload = {
        ...form,
        total_payment: Number(form.total_payment || 0),
        advance_payment: Number(form.advance_payment || 0),
        balance_dues: Number(form.balance_dues || 0),
        current_stage: form.current_stage === 'Draft' ? '1. Registered' : form.current_stage,
        is_draft: false,
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

  const handleDelete = async () => {
    if (!editingId) return
    const label = form.uid_no || `registration #${editingId}`
    const ok = window.confirm(
      `Delete ${label}${form.agency_name ? ` (${form.agency_name})` : ''}?\n\n` +
      'Its lab reports and billing records with this UID will also be deleted ' +
      '(unless another registration uses the same UID). This cannot be undone.'
    )
    if (!ok) return
    setSaving(true)
    setLocalError('')
    try {
      await request(`/registrations/${editingId}`, { method: 'DELETE' })
      onSaved()
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveDraft = async () => {
    setSaving(true)
    setLocalError('')
    try {
      const payload = {
        ...form,
        total_payment: Number(form.total_payment || 0),
        advance_payment: Number(form.advance_payment || 0),
        balance_dues: Number(form.balance_dues || 0),
        is_draft: true,
      }
      if (editingId) {
        await request(`/registrations/${editingId}`, { method: 'PUT', body: JSON.stringify(payload) })
      } else {
        await request('/registrations', { method: 'POST', body: JSON.stringify(payload) })
      }
      clearDraft()
      onSaved()
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'Draft save failed')
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
                    className="mono"
                    style={{ fontWeight: 700, color: 'var(--color-primary)' }}
                  />
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
                <Select value={form.work ?? ''} onChange={(e) => update({ work: e.target.value })}>
                  {WORK_TYPES.map((w) => <option key={w} value={w}>{w || 'Select Work Category'}</option>)}
                </Select>
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
                  <div className="dd-sugg">
                    {searchResults.map((r) => (
                      <div
                        key={r.iClientId}
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
                  onChange={(e) => update({ mobile_no: e.target.value.replace(/\D/g, '') })}
                  inputMode="numeric"
                  placeholder="Mobile number (digits only)"
                />
              </FormField>
            </div>

            <FormField label="Reporting Address / Department Details" required>
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
              const currentCatObj = findRateCategory(row.category)
              const subOptions = currentCatObj?.items ?? []
              const isOther = row.category === OTHER_CATEGORY
              const label = sampleLabel(row)
              const listItems = row.items.filter((it) => !it.custom)
              const customItems = row.items.filter((it) => it.custom)

              return (
                <div key={i} className="sample-row-card">
                  <div className="sample-row-card__header">
                    <strong style={{ fontSize: '0.82rem', color: 'var(--gray-900)' }}>
                      Sample #{i + 1} {label ? `— ${label}` : ''}
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
                      <Select value={row.newBack} onChange={(e) => updateNewBack(i, e.target.value)}>
                        {NEW_BACK_OPTIONS.map((v) => <option key={v} value={v}>{v || 'New'}</option>)}
                      </Select>
                    </FormField>

                    <FormField label="Test Category" required={i === 0}>
                      <SearchableSelect
                        value={row.category ?? ''}
                        onChange={(v) => handleCategoryChange(i, v)}
                        placeholder="-- Choose Category --"
                        options={[
                          ...RATE_LIST.map((c) => ({ value: c.category, label: c.category })),
                          { value: OTHER_CATEGORY, label: 'Other / Custom' },
                        ]}
                      />
                    </FormField>
                  </div>

                  <FormField label="Test Sub-Types" required={i === 0}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'stretch', minWidth: 0 }}>
                      {isOther ? null : (
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <SubTypeMultiSelect
                            options={subOptions}
                            selected={listItems.map((it) => it.name)}
                            onToggle={(name) => toggleSubType(i, name)}
                            disabled={!row.category}
                          />
                        </div>
                      )}
                      <button
                        type="button"
                        className="btn btn-outline"
                        onClick={() => addCustomItem(i)}
                        disabled={!row.category}
                        title={row.category ? 'Add a custom test with its own name, qty and rate' : 'Choose a Test Category first'}
                        style={{ whiteSpace: 'nowrap', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      >
                        <Plus size={14} /> Other / Custom
                      </button>
                    </div>
                  </FormField>

                  {listItems.length > 0 ? (
                    <div className="field-row" style={{ marginTop: 8, marginBottom: 4 }}>
                      <FormField label="Quantity">
                        <input type="number" min="0" step="any" value={row.qty} onChange={(e) => updateRowField(i, 'qty', e.target.value)} />
                      </FormField>
                      <FormField label="Rate (₹)">
                        <input type="number" min="0" step="any" value={row.rate} onChange={(e) => updateRowField(i, 'rate', e.target.value)} placeholder="0" />
                      </FormField>
                    </div>
                  ) : null}

                  {customItems.length > 0 ? (
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden', marginTop: 6 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 70px 95px 90px 30px', gap: 8, padding: '7px 10px', background: '#f8fafc', fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                        <span>Custom test</span><span>Qty</span><span>Rate (₹)</span><span style={{ textAlign: 'right' }}>Amount</span><span />
                      </div>
                      {row.items.map((item, j) => item.custom ? (
                        <div key={j} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 70px 95px 90px 30px', gap: 8, padding: '7px 10px', alignItems: 'center', borderTop: '1px solid #f1f5f9' }}>
                          <input value={item.name} onChange={(e) => updateItem(i, j, 'name', e.target.value)} placeholder="Name of test sub-type" style={{ width: '100%', padding: '6px 8px', fontSize: '0.84rem' }} />
                          <input type="number" min="0" step="any" value={item.qty} onChange={(e) => updateItem(i, j, 'qty', e.target.value)} aria-label="Quantity" style={{ width: '100%', padding: '6px 8px', fontSize: '0.84rem' }} />
                          <input type="number" min="0" step="any" value={item.rate} onChange={(e) => updateItem(i, j, 'rate', e.target.value)} aria-label="Rate" placeholder="0" style={{ width: '100%', padding: '6px 8px', fontSize: '0.84rem' }} />
                          <span style={{ textAlign: 'right', fontWeight: 700, fontSize: '0.84rem', color: '#0f172a' }}>₹{itemAmount(item)}</span>
                          <button type="button" className="icon-btn text-danger" onClick={() => removeItem(i, j)} title="Remove test">
                            <X size={14} />
                          </button>
                        </div>
                      ) : null)}
                    </div>
                  ) : null}
                </div>
              )
            })}

            <div className="rate-summary-pill">
              <span className="rate-summary-pill__label">Total Sample Amount (qty × rate)</span>
              <span className="rate-summary-pill__value">
                ₹{sampleTotal(sampleRows)}
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
              <FormField label="Report Status">
                <Select value={form.report_status ?? ''} onChange={(e) => update({ report_status: e.target.value })}>
                  {REPORT_STATUS_OPTIONS.map((v) => <option key={v} value={v}>{v || 'Select Report Status'}</option>)}
                </Select>
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
                    setTotalTouched(true)
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
              <DatePicker
                value={form.payment_received_date ?? ''}
                onChange={(v) => update({ payment_received_date: v })}
                label="Payment Received Date"
              />

              <FormField label="Mode of Payment">
                <Select value={form.mode_of_payment ?? ''} onChange={(e) => update({ mode_of_payment: e.target.value })}>
                  {PAYMENT_MODES.map((v) => <option key={v} value={v}>{v ? v.toUpperCase() : 'Select Mode'}</option>)}
                </Select>
              </FormField>
            </div>

            <div className="field-row">
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
              {Array.from({ length: visibleScanSlots }, (_, idx) => idx).map((idx) => {
                const field = idx === 0 ? 'scan_copy' : (`scan_copy_${idx}` as keyof RegistrationFormData)
                const filePath = form[field] as string | undefined
                const isUploading = uploadingSlot === idx
                const pendingFile = pendingFiles[field as string]
                const hasFile = Boolean(filePath || pendingFile)
                const fileName = pendingFile ? pendingFile.name : (filePath ? filePath.split('/').pop() : '')
                const fileUrl = filePath ? resolveFileUrl(filePath) : ''

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
                        <Upload size={13} /> {isUploading ? `Uploading ${uploadProgress}%` : hasFile ? 'Replace' : 'Upload Document'}
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
                          onClick={() => void handleRemoveScan(idx)}
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
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 14 }}>
              {visibleScanSlots < 10 ? (
                <button type="button" className="btn btn-outline btn-sm"
                  onClick={() => setVisibleScanSlots((count) => Math.min(10, count + 3))}>
                  + Add more document options
                </button>
              ) : null}
              {visibleScanSlots > 3 ? (
                <button type="button" className="btn btn-outline btn-sm"
                  onClick={() => setVisibleScanSlots((count) => Math.max(3, count - 3))}>
                  Show fewer
                </button>
              ) : null}
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
                <Select
                  value={form.current_stage ?? '1. Registered'}
                  onChange={(e) => update({ current_stage: e.target.value })}
                  style={{ fontWeight: 600 }}
                >
                  {WORKFLOW_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                </Select>
              </FormField>

              <FormField
                label="Currently With (Assigned User)"
                required
                error={currentlyWithError}
              >
                <Select
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
                </Select>
              </FormField>
            </div>

            <div className="field-row">
              <FormField label="Priority Level">
                <Select
                  value={form.priority ?? 'Medium'}
                  onChange={(e) => update({ priority: e.target.value })}
                >
                  {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                </Select>
              </FormField>

              <DatePicker
                value={form.target_date ?? ''}
                onChange={(v) => update({ target_date: v })}
                label="Target SLA Completion Date"
              />
            </div>

            <div className="field-row">
              <FormField label="Payment Status">
                <Select
                  value={form.payment_status ?? 'Not Invoiced'}
                  onChange={(e) => update({ payment_status: e.target.value })}
                >
                  {PAYMENT_STATUS_OPTIONS.map((ps) => <option key={ps} value={ps}>{ps}</option>)}
                </Select>
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
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
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
          {editingId ? (
            <button
              className="btn btn-outline btn-sm"
              onClick={() => { void handleDelete() }}
              type="button"
              disabled={saving}
              style={{ color: '#b91c1c', borderColor: '#fca5a5' }}
              title="Delete this registration"
            >
              <Trash2 size={14} /> Delete
            </button>
          ) : null}
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {!editingId ? (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => { void handleSaveDraft() }}
            >
              <Save size={14} /> Save Draft
            </button>
          ) : null}

          {editingId && tab < TABS.length - 1 ? (
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={saving}
            >
              <Save size={14} /> {saving ? 'Saving...' : 'Save Changes'}
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
              <Save size={14} /> {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Complete Registration'}
            </button>
          )}
        </div>
      </div>
    </form>
  )
}
