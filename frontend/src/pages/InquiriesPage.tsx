import { useEffect, useMemo, useState } from 'react'
import { CalendarClock, Plus, Search, Trash2, Pencil, PhoneCall, History } from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { Req } from '../components/ui'
import { Dropdown } from '../components/Dropdown'
import { MultiDropdown } from '../components/MultiDropdown'
import { Modal } from '../components/Modal'
import {
  type Inquiry, type InquiryInput, type InquiryCallInput, type InquiryStatus,
  INQUIRY_STATUSES, CLOSED_STATUSES, WORK_CATEGORIES, ENQUIRY_SOURCES, SOURCE_DETAIL,
  statusInfo, followUpState, formatDate, formatDateTime,
} from '../lib/inquiries'
import { HistoryButton } from '../components/History'
import { showSaved } from '../lib/toast'
import { NoLink } from '../components/NoLink'

interface UserOption { id: number; name: string }

const emptyInquiry: InquiryInput = {
  client_name: '', mobile_no: '', email: '', source: '', source_detail: '', location: '', budget: '', work_categories: [], notes: '',
  assigned_to: null, status: 'new', next_follow_up: null,
}

const FOLLOW_UP_STYLES = {
  overdue: { background: '#fef2f2', color: '#b91c1c', border: '#fecaca' },
  today: { background: '#fffbeb', color: '#b45309', border: '#fde68a' },
}

function StatusBadge({ status }: { status: string }) {
  const info = statusInfo(status)
  return <span style={{ background: info.background, color: info.color, display: 'inline-block', padding: '3px 10px', borderRadius: 999, fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap' }}>{info.label}</span>
}

function CategoryChips({ categories }: { categories: string[] }) {
  if (categories.length === 0) return <>-</>
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {categories.map((c) => <span key={c} style={{ background: '#f1f5f9', color: '#334155', padding: '2px 8px', borderRadius: 6, fontSize: '0.74rem', fontWeight: 600, whiteSpace: 'nowrap' }}>{c}</span>)}
    </div>
  )
}

function UserSelect({ users, value, onChange, placeholder = '— Not handed over —' }: { users: UserOption[]; value: number | null; onChange: (id: number | null) => void; placeholder?: string }) {
  return (
    <Dropdown ariaLabel="Handover to" value={value === null ? '' : String(value)} placeholder={placeholder} onChange={(v) => onChange(v ? Number(v) : null)}
      options={[{ value: '', label: placeholder }, ...users.map((u) => ({ value: String(u.id), label: u.name }))]} />
  )
}

const asOption = (x: string) => ({ value: x, label: x })

export function InquiriesPage() {
  const { user } = useAuth()
  const myId = user?.id ?? null

  const [inquiries, setInquiries] = useState<Inquiry[]>([])
  const [users, setUsers] = useState<UserOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [handoverFilter, setHandoverFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [dueOnly, setDueOnly] = useState(false)

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<InquiryInput>(emptyInquiry)
  const [saving, setSaving] = useState(false)

  const [detail, setDetail] = useState<Inquiry | null>(null)
  const [call, setCall] = useState<InquiryCallInput>({ status: 'no_answer', remark: '', next_follow_up: null, assigned_to: null })

  const reload = () => api.inquiries()
    .then(({ data }) => { setInquiries(data); setError('') })
    .catch((e: Error) => setError(e.message || 'Could not load enquiries'))
    .finally(() => setLoading(false))

  useEffect(() => {
    void reload()
    api.assignableUsers().then(({ data }) => setUsers(data)).catch(() => setUsers([]))
  }, [])

  const filtered = useMemo(() => inquiries.filter((inq) => {
    if (statusFilter === 'open' ? CLOSED_STATUSES.includes(inq.status) : statusFilter && inq.status !== statusFilter) return false
    if (sourceFilter === 'none' ? inq.source : sourceFilter && inq.source !== sourceFilter) return false
    if (categoryFilter && !inq.work_categories.includes(categoryFilter)) return false
    if (handoverFilter === 'me' ? inq.assigned_to !== myId : handoverFilter === 'none' ? inq.assigned_to !== null : handoverFilter && String(inq.assigned_to) !== handoverFilter) return false
    if (dueOnly && !followUpState(inq)) return false
    if (search) {
      const text = `${inq.inquiry_no} ${inq.client_name} ${inq.mobile_no} ${inq.email} ${inq.source} ${inq.source_detail} ${inq.location} ${inq.budget} ${inq.notes} ${inq.assigned_to_name ?? ''}`.toLowerCase()
      if (!text.includes(search.toLowerCase())) return false
    }
    return true
  }), [inquiries, statusFilter, categoryFilter, sourceFilter, handoverFilter, dueOnly, search, myId])

  const dueCount = inquiries.filter((i) => followUpState(i)).length
  const wonCount = inquiries.filter((i) => i.status === 'won').length
  const lostCount = inquiries.filter((i) => i.status === 'lost').length
  // Converted out of all closed enquiries (converted + not interested)
  const conversion = wonCount + lostCount > 0 ? Math.round((wonCount / (wonCount + lostCount)) * 100) : null
  const metricCards: Array<{ label: string; value: number; onClick: () => void; tone?: 'overdue'; note?: string }> = [
    { label: 'Total enquiries', value: inquiries.length, onClick: () => { setStatusFilter(''); setDueOnly(false) } },
    { label: 'New (not called)', value: inquiries.filter((i) => i.status === 'new').length, onClick: () => { setStatusFilter('new'); setDueOnly(false) } },
    { label: 'Follow-ups due', value: dueCount, tone: 'overdue', onClick: () => { setStatusFilter(''); setDueOnly(true) } },
    { label: 'Handed over to me', value: inquiries.filter((i) => i.assigned_to === myId && !CLOSED_STATUSES.includes(i.status)).length, onClick: () => { setHandoverFilter('me'); setStatusFilter('open'); setDueOnly(false) } },
    { label: 'Interested / Quoted', value: inquiries.filter((i) => ['interested', 'follow_up', 'quotation_sent'].includes(i.status)).length, onClick: () => { setStatusFilter('open'); setDueOnly(false) } },
    { label: 'Converted', value: wonCount, note: conversion !== null ? `${conversion}% rate` : undefined, onClick: () => { setStatusFilter('won'); setDueOnly(false) } },
    { label: 'Not Interested', value: lostCount, onClick: () => { setStatusFilter('lost'); setDueOnly(false) } },
  ]

  const updateForm = <K extends keyof InquiryInput>(key: K, value: InquiryInput[K]) => setForm((prev) => ({ ...prev, [key]: value }))

  const closeForm = () => setShowForm(false)
  const closeDetail = () => setDetail(null)

  const openAdd = () => { setEditingId(null); setForm(emptyInquiry); setShowForm(true) }
  const openEdit = (inq: Inquiry) => {
    setEditingId(inq.id)
    setForm({
      client_name: inq.client_name, mobile_no: inq.mobile_no, email: inq.email, source: inq.source, source_detail: inq.source_detail, location: inq.location, budget: inq.budget,
      work_categories: inq.work_categories, notes: inq.notes, assigned_to: inq.assigned_to,
      status: inq.status, next_follow_up: inq.next_follow_up,
    })
    setShowForm(true)
  }

  const replaceInList = (inq: Inquiry) => setInquiries((list) => list.map((i) => i.id === inq.id ? { ...inq, activities: undefined } : i))

  const saveInquiry = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    try {
      const payload = { ...form, next_follow_up: form.next_follow_up || null }
      if (editingId !== null) {
        const { data } = await api.updateInquiry(editingId, payload)
        replaceInList(data)
      } else {
        const { data } = await api.createInquiry(payload)
        setInquiries((list) => [data, ...list])
      }
      setShowForm(false)
      showSaved('Saved enquiry')
    } catch (e) {
      window.alert((e as Error).message || 'Could not save enquiry')
    } finally {
      setSaving(false)
    }
  }

  const deleteInquiry = async (inq: Inquiry) => {
    if (!window.confirm(`Delete enquiry ${inq.inquiry_no} (${inq.client_name})?`)) return
    try {
      await api.deleteInquiry(inq.id)
      setInquiries((list) => list.filter((i) => i.id !== inq.id))
      if (detail?.id === inq.id) setDetail(null)
    } catch (e) {
      window.alert((e as Error).message || 'Could not delete enquiry')
    }
  }

  const openCall = (inq: Inquiry) => {
    setDetail(inq)
    setCall({ status: inq.status === 'new' ? 'no_answer' : inq.status, remark: '', next_follow_up: null, assigned_to: inq.assigned_to })
    api.inquiry(inq.id).then(({ data }) => setDetail((cur) => cur?.id === data.id ? data : cur)).catch(() => undefined)
  }

  const saveCall = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!detail) return
    setSaving(true)
    try {
      const { data } = await api.logInquiryCall(detail.id, { ...call, next_follow_up: call.next_follow_up || null })
      setDetail(data)
      replaceInList(data)
      setCall((c) => ({ ...c, remark: '', next_follow_up: null }))
    } catch (e) {
      window.alert((e as Error).message || 'Could not save call')
    } finally {
      setSaving(false)
    }
  }

  const filtersActive = search || statusFilter || categoryFilter || sourceFilter || handoverFilter || dueOnly

  return (
    <div>
      <div className="inq-metric-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 12, marginBottom: 16 }}>
        {metricCards.map(({ label, value, tone, onClick, note }) => {
          const toneStyle = tone && value > 0 ? FOLLOW_UP_STYLES[tone] : null
          return (
            <button type="button" key={label} onClick={onClick} className="metric-card" data-urgent={toneStyle ? tone : undefined} style={{ minHeight: 96, padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, textAlign: 'left', cursor: 'pointer', background: toneStyle ? toneStyle.background : '#fff', border: `1px solid ${toneStyle ? toneStyle.border : 'rgba(0, 0, 0, 0.08)'}`, borderRadius: 14, boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04), 0 2px 8px rgba(0, 0, 0, 0.03)' }}>
              <span style={{ color: toneStyle ? toneStyle.color : '#737373', fontSize: '0.78rem', lineHeight: 1.3 }}>{label}</span>
              <strong style={{ color: toneStyle ? toneStyle.color : '#171717', fontSize: '1.6rem', lineHeight: 1, fontWeight: 750 }}>{value}{note ? <small style={{ marginLeft: 6, fontSize: '0.72rem', fontWeight: 600, color: '#15803d' }} title="Converted out of all closed enquiries (converted + not interested)">{note}</small> : null}</strong>
            </button>
          )
        })}
      </div>
      <style>{`
        @media (max-width: 1100px) { .inq-metric-grid { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; } }
        @media (max-width: 620px) { .inq-metric-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; } .inq-form-grid { grid-template-columns: 1fr !important; } }
        .inq-row--overdue > td { background: ${FOLLOW_UP_STYLES.overdue.background} !important; }
        .inq-row--today > td { background: ${FOLLOW_UP_STYLES.today.background} !important; }
        .inq-status-pill { border: 1px solid rgba(0,0,0,0.12); background: #fff; border-radius: 999px; padding: 6px 12px; font-size: 0.8rem; font-weight: 600; cursor: pointer; }
      `}</style>

      <div className="dd-filters">
        <div className="dd-filters__search">
          <Search size={16} />
          <input className="input" placeholder="Search client, number, location, notes…" aria-label="Search enquiries" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Dropdown filter searchable={false} ariaLabel="Status" value={statusFilter} onChange={setStatusFilter}
          options={[{ value: '', label: 'All statuses' }, { value: 'open', label: 'Open' }, ...INQUIRY_STATUSES.map((x) => ({ value: x.key as string, label: x.label as string }))]} />
        <Dropdown filter ariaLabel="Work category" value={categoryFilter} onChange={setCategoryFilter}
          options={[{ value: '', label: 'All work categories' }, ...WORK_CATEGORIES.map(asOption)]} />
        <Dropdown filter ariaLabel="Source" value={sourceFilter} onChange={setSourceFilter}
          options={[{ value: '', label: 'All sources' }, ...ENQUIRY_SOURCES.map(asOption), { value: 'none', label: 'Not recorded' }]} />
        <Dropdown filter ariaLabel="Handover" value={handoverFilter} onChange={setHandoverFilter}
          options={[{ value: '', label: 'Handover: anyone' }, { value: 'me', label: 'Handed over to me' }, { value: 'none', label: 'Not handed over' }, ...users.map((u) => ({ value: String(u.id), label: u.name }))]} />
        <button type="button" className={`input dd-box dd-toggle${dueOnly ? ' dd-box--set' : ''}`} aria-pressed={dueOnly} onClick={() => setDueOnly((d) => !d)}><CalendarClock size={16} /> Follow-ups due</button>
        {filtersActive ? <button type="button" className="ghost-button" onClick={() => { setSearch(''); setStatusFilter(''); setCategoryFilter(''); setSourceFilter(''); setHandoverFilter(''); setDueOnly(false) }}>Clear</button> : null}
      </div>

      <section className="surface">
        <div className="surface-heading">
          <div><p className="section-label">Enquiry</p><h2>Enquiries ({filtered.length}{filtersActive ? ` of ${inquiries.length}` : ''})</h2></div>
          <button type="button" className="btn btn-primary" onClick={openAdd}><Plus size={16} /> Add enquiry</button>
        </div>

        {error ? <p style={{ color: '#b91c1c', margin: '0 0 12px' }}>{error} <button type="button" className="ghost-button" onClick={() => { setLoading(true); void reload() }}>Retry</button></p> : null}

        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ minWidth: 1420 }}>
            <thead>
              <tr>
                <th>Enquiry No.</th><th>Client Name</th><th>Client Number</th><th>Source</th><th>Location</th><th>Rate / Price / Budget</th>
                <th>Work Category</th><th>Notes</th><th>Handover To</th><th>Status</th><th>Next Follow-up</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={12} className="empty-state">{loading ? 'Loading enquiries…' : inquiries.length === 0 ? 'No enquiries yet. Add the first enquiry.' : 'No enquiries match your filters.'}</td></tr>
              ) : filtered.map((inq) => {
                const due = followUpState(inq)
                return (
                  <tr key={inq.id} className={due ? `inq-row--${due}` : undefined}>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <NoLink title="Open enquiry" onClick={() => openEdit(inq)}>{inq.inquiry_no}</NoLink>
                      <div style={{ fontSize: '0.74rem', color: '#64748b' }}>{formatDate(inq.received_date)}</div>
                    </td>
                    <td style={{ fontWeight: 600, minWidth: 140 }}>{inq.client_name}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{inq.mobile_no ? <a href={`tel:${inq.mobile_no.replace(/\s+/g, '')}`}>{inq.mobile_no}</a> : '-'}{inq.email ? <a href={`mailto:${inq.email}`} style={{ display: 'block', fontSize: '0.76rem' }}>{inq.email}</a> : null}</td>
                    <td style={{ maxWidth: 150, whiteSpace: 'normal' }}>{inq.source || <span style={{ color: '#94a3b8' }}>Not recorded</span>}{inq.source_detail ? <div style={{ fontSize: '0.76rem', color: '#64748b' }}>{inq.source_detail}</div> : null}</td>
                    <td style={{ maxWidth: 160, whiteSpace: 'normal' }}>{inq.location || '-'}</td>
                    <td style={{ color: '#15803d', fontWeight: 700, whiteSpace: 'nowrap' }}>{inq.budget || '-'}</td>
                    <td style={{ maxWidth: 220, whiteSpace: 'normal' }}><CategoryChips categories={inq.work_categories} /></td>
                    <td style={{ maxWidth: 240, whiteSpace: 'normal' }}><span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }} title={inq.notes}>{inq.notes || '-'}</span></td>
                    <td style={{ whiteSpace: 'nowrap', fontWeight: inq.assigned_to === myId ? 700 : undefined }}>{inq.assigned_to_name ? (inq.assigned_to === myId ? `${inq.assigned_to_name} (me)` : inq.assigned_to_name) : '-'}</td>
                    <td><StatusBadge status={inq.status} /></td>
                    <td style={{ whiteSpace: 'nowrap', fontWeight: due ? 700 : undefined, color: due ? FOLLOW_UP_STYLES[due].color : undefined }}>
                      {CLOSED_STATUSES.includes(inq.status) ? '-' : formatDate(inq.next_follow_up)}
                      {due ? <div style={{ fontSize: '0.72rem' }}>{due === 'overdue' ? 'Overdue' : 'Today'}</div> : null}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="icon-button" type="button" title="Log call / view history" onClick={() => openCall(inq)}><PhoneCall size={16} /></button>
                      <HistoryButton type="Inquiry" id={inq.id} title={`Enquiry ${inq.inquiry_no ?? ''} · ${inq.client_name ?? ''}`} />
                      <button className="icon-button" type="button" title="Edit enquiry" onClick={() => openEdit(inq)}><Pencil size={16} /></button>
                      <button className="icon-button" type="button" title="Delete enquiry" onClick={() => void deleteInquiry(inq)}><Trash2 size={16} /></button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {showForm ? (
        <Modal
          title={editingId !== null ? 'Edit enquiry' : 'Add enquiry'}
          subtitle={`Enquiry${editingId !== null ? ` · ${inquiries.find((i) => i.id === editingId)?.inquiry_no ?? ''}` : ''}`}
          onClose={closeForm}
          size={760}
          onSubmit={saveInquiry}
          saving={saving}
          saveLabel={editingId !== null ? 'Update enquiry' : 'Save enquiry'}
        >
            <div className="inq-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label><span>Client Name<Req /></span><input className="input" required value={form.client_name} onChange={(e) => updateForm('client_name', e.target.value)} /></label>
              <label>Client Number<input className="input" type="tel" inputMode="numeric" value={form.mobile_no} onChange={(e) => updateForm('mobile_no', e.target.value.replace(/\D/g, ''))} placeholder="Mobile number (digits only)" /></label>
              <label>Client Email<input className="input" type="email" value={form.email} onChange={(e) => updateForm('email', e.target.value.trim())} placeholder="name@company.com" /></label>
              <label><span>Source{editingId === null ? <Req /> : null}</span>
                <Dropdown ariaLabel="Source" required={editingId === null} value={form.source} placeholder={editingId === null ? 'How did they reach us?' : 'Not recorded'} options={ENQUIRY_SOURCES.map(asOption)}
                  onChange={(source) => setForm((f) => ({ ...f, source, source_detail: SOURCE_DETAIL[source] ? f.source_detail : '' }))} />
              </label>
              {SOURCE_DETAIL[form.source] ? <label>{SOURCE_DETAIL[form.source]}<input className="input" maxLength={200} value={form.source_detail} onChange={(e) => updateForm('source_detail', e.target.value)} /></label> : null}
              <label>Location<input className="input" value={form.location} onChange={(e) => updateForm('location', e.target.value)} /></label>
              <label>Rate / Price / Budget<input className="input" value={form.budget} onChange={(e) => updateForm('budget', e.target.value)} placeholder="e.g. ₹25,000" /></label>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', marginBottom: 4 }}>Work Category</label>
                <MultiDropdown chips ariaLabel="Work category" placeholder="Select work categories" options={WORK_CATEGORIES.map((c) => ({ value: c }))} isChosen={(c) => form.work_categories.includes(c)}
                  onToggle={(c) => updateForm('work_categories', form.work_categories.includes(c) ? form.work_categories.filter((x) => x !== c) : [...form.work_categories, c])}
                  onClear={() => updateForm('work_categories', [])} />
              </div>
              <label>Handover To<UserSelect users={users} value={form.assigned_to} onChange={(id) => updateForm('assigned_to', id)} /></label>
              <label>Status
                <Dropdown ariaLabel="Status" value={form.status} onChange={(v) => updateForm('status', v as InquiryStatus)} options={INQUIRY_STATUSES.map((x) => ({ value: x.key, label: x.label }))} />
              </label>
              <label>Next Follow-up Date<input className="input" type="date" value={form.next_follow_up ?? ''} onChange={(e) => updateForm('next_follow_up', e.target.value || null)} /></label>
              <label style={{ gridColumn: '1 / -1' }}>Notes<textarea className="input" rows={3} value={form.notes} onChange={(e) => updateForm('notes', e.target.value)} style={{ resize: 'vertical' }} /></label>
            </div>
        </Modal>
      ) : null}

      {detail ? (
        <Modal
          title={detail.client_name}
          subtitle={`${detail.inquiry_no} · ${formatDate(detail.received_date)}`}
          onClose={closeDetail}
          size={720}
          onSubmit={saveCall}
          saving={saving}
          saveLabel="Save call"
        >

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 16, fontSize: '0.85rem' }}>
              <div><div style={{ color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 600 }}>Number</div>{detail.mobile_no ? <a href={`tel:${detail.mobile_no.replace(/\s+/g, '')}`} style={{ fontWeight: 700 }}>{detail.mobile_no}</a> : '-'}</div>
              {detail.email ? <div><div style={{ color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 600 }}>Email</div><a href={`mailto:${detail.email}`} style={{ overflowWrap: 'anywhere' }}>{detail.email}</a></div> : null}
              <div><div style={{ color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 600 }}>Source</div>{detail.source ? `${detail.source}${detail.source_detail ? ` (${detail.source_detail})` : ''}` : 'Not recorded'}</div>
              <div><div style={{ color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 600 }}>Location</div>{detail.location || '-'}</div>
              <div><div style={{ color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 600 }}>Budget</div>{detail.budget || '-'}</div>
              <div><div style={{ color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 600 }}>Status</div><StatusBadge status={detail.status} /></div>
              <div style={{ gridColumn: '1 / -1' }}><div style={{ color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>Work Category</div><CategoryChips categories={detail.work_categories} /></div>
              {detail.notes ? <div style={{ gridColumn: '1 / -1' }}><div style={{ color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 600 }}>Notes</div><p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{detail.notes}</p></div> : null}
            </div>

            <div style={{ border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12, padding: 14, background: '#f8fafc' }}>
              <strong style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}><PhoneCall size={16} /> Log a call / update status</strong>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {INQUIRY_STATUSES.filter((s) => s.key !== 'new').map((s) => {
                  const active = call.status === s.key
                  return (
                    <button type="button" key={s.key} className="inq-status-pill" onClick={() => setCall((c) => ({ ...c, status: s.key }))} style={active ? { background: s.background, color: s.color, borderColor: s.color } : undefined}>{s.label}</button>
                  )
                })}
              </div>
              <div className="inq-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label>Next Follow-up Date<input className="input" type="date" value={call.next_follow_up ?? ''} disabled={CLOSED_STATUSES.includes(call.status)} onChange={(e) => setCall((c) => ({ ...c, next_follow_up: e.target.value || null }))} /></label>
                <label>Handover To<UserSelect users={users} value={call.assigned_to} onChange={(id) => setCall((c) => ({ ...c, assigned_to: id }))} /></label>
                <label style={{ gridColumn: '1 / -1' }}>Remark<textarea className="input" rows={2} value={call.remark} onChange={(e) => setCall((c) => ({ ...c, remark: e.target.value }))} placeholder="What did the client say?" style={{ resize: 'vertical' }} /></label>
              </div>
            </div>

            <h3 style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.95rem', margin: '18px 0 8px' }}><History size={16} /> Call history</h3>
            {!detail.activities ? <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Loading…</p> : detail.activities.length === 0 ? <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No calls logged yet.</p> : (
              <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {detail.activities.map((a) => (
                  <li key={a.id} style={{ borderLeft: '2px solid #e2e8f0', padding: '0 0 14px 14px', position: 'relative' }}>
                    <span style={{ position: 'absolute', left: -6, top: 4, width: 10, height: 10, borderRadius: 999, background: a.status ? statusInfo(a.status).color : '#94a3b8' }} />
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, fontSize: '0.8rem', color: '#64748b' }}>
                      <span>{formatDateTime(a.created_at)}</span>
                      <span>· {a.user_name ?? 'Unknown user'}</span>
                      {a.status ? <StatusBadge status={a.status} /> : null}
                    </div>
                    {a.remark ? <p style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap', fontSize: '0.88rem' }}>{a.remark}</p> : null}
                    {a.assigned_to_name ? <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#334155' }}>Handed over to <strong>{a.assigned_to_name}</strong></p> : null}
                    {a.next_follow_up ? <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#334155' }}>Next follow-up: <strong>{formatDate(a.next_follow_up)}</strong></p> : null}
                  </li>
                ))}
              </ol>
            )}
        </Modal>
      ) : null}
    </div>
  )
}
