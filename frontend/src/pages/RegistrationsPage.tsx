import { useState, useMemo, useEffect } from 'react'
import { Modal } from '../components/Modal'
import { Search, Plus, UserCog, History, Download, X, Folder } from 'lucide-react'
import { DateRangeFilter } from '../components/DateRangeFilter'
import { useAuth } from '../lib/auth'
import { api, request } from '../lib/api'
import { billsApi } from '../lib/bills'
import { DataTable } from '../components/DataTable'
import { RegistrationWizard } from '../components/RegistrationWizard'
import { Timeline } from '../components/Timeline'
import { UIDDocumentDrawer } from '../components/UIDDocumentDrawer'
import type { Registration, RegistrationFormData } from '../lib/types'

function normalizeDate(value: string | null | undefined) {
  if (!value) return ''
  if (value.includes('-')) return value
  const parts = value.split('/')
  if (parts.length === 3) {
    const [day, month, year] = parts
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }
  return value
}

function displayDate(value: string | null | undefined) {
  if (!value) return ''
  const normalized = normalizeDate(value)
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    const [year, month, day] = normalized.split('-')
    return `${day}/${month}/${year}`
  }
  return normalized
}

function money(value: number) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(value)
}

function exportToCsv(headers: string[], rows: (string | number)[][], filename: string) {
  const csvContent = [
    headers.map(h => `"${h}"`).join(','),
    ...rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
  ].join('\n')
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
}

export function RegistrationsPage({ onViewBill, onCreateBill }: { onViewBill?: (uid: string) => void; onCreateBill?: (uid: string) => void } = {}) {
  const { registrations, refresh, clearError, setStatus } = useAuth()
  // UIDs that have a bill under the Billing menu (matched case-insensitively)
  const [billedUids, setBilledUids] = useState<Set<string>>(new Set())
  useEffect(() => {
    let cancelled = false
    billsApi.billedUids()
      .then((res) => {
        if (cancelled) return
        setBilledUids(new Set((res.data ?? []).map((uid) => (uid ?? '').trim().toLowerCase()).filter(Boolean)))
      })
      .catch(() => { /* no billing access or network error: column just shows '-' */ })
    return () => { cancelled = true }
  }, [registrations])
  const [query, setQuery] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formVisible, setFormVisible] = useState(false)
  const [, setLocalError] = useState('')
  const [timelineData, setTimelineData] = useState<Array<{ event: string; timestamp: string | null; icon: string; user?: string; note?: string | null }>>([])
  const [timelineVisible, setTimelineVisible] = useState(false)
  const [timelineUid, setTimelineUid] = useState('')
  const [drawerUid, setDrawerUid] = useState<string>('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [activeFilter, setActiveFilter] = useState(false)
  const [applyCount, setApplyCount] = useState(0)
  const [workFor, setWorkFor] = useState<Registration | null>(null)
  // Always open on "All jobs": filtering by the user's stage hid jobs right after they were saved / handed over.
  const [roleFilter, setRoleFilter] = useState<string>('all')

  const filtered = useMemo(() => {
    let list = registrations

    if (roleFilter !== 'all') {
      if (roleFilter === 'stuck') {
        list = list.filter((r) => (r.days_at_stage ?? 0) >= 2 && r.current_stage !== '8. Closed')
      } else if (roleFilter === 'registration') {
        list = list.filter((r) => r.is_draft || r.current_stage === 'Draft' || r.current_stage === '1. Registered' || r.current_stage === '6. Report Dispatched')
      } else if (roleFilter === 'lab') {
        list = list.filter((r) => r.current_stage === '2. Field/Site Work' || r.current_stage === '3. Lab Testing')
      } else if (roleFilter === 'report_staff') {
        list = list.filter((r) => r.current_stage === '4. Report Drafting')
      } else if (roleFilter === 'technical') {
        list = list.filter((r) => r.current_stage === '5. Report Review')
      } else if (roleFilter === 'manager') {
        list = list.filter((r) => r.current_stage === '7. Payment Pending')
      } else if (roleFilter === 'closed') {
        list = list.filter((r) => r.current_stage === '8. Closed')
      }
    }

    if (activeFilter && (startDate || endDate)) {
      list = list.filter((r) => {
        const d = normalizeDate(r.received_date)
        if (startDate && d < startDate) return false
        if (endDate && d > endDate) return false
        return true
      })
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      list = list.filter((r) =>
        [r.uid_no, r.agency_name, r.reporting_address, r.mobile_no, r.name_of_work, r.current_stage, r.currently_with]
          .join(' ').toLowerCase().includes(q)
      )
    }
    return list
  }, [registrations, roleFilter, activeFilter, startDate, endDate, query])

  const beginCreate = () => {
    setEditingId(null)
    setFormVisible(true)
    clearError()
    setLocalError('')
    setStatus('Creating registration')
  }

  const beginEdit = (registration: Registration) => {
    setEditingId(registration.id)
    setFormVisible(true)
    clearError()
    setLocalError('')
    setStatus('Editing registration')
  }

  const handleSaved = async () => {
    setEditingId(null)
    setFormVisible(false)
    await refresh()
    setStatus('Registration saved')
  }

  const showHistory = async (registration: Registration) => {
    setTimelineUid(registration.uid_no)
    setTimelineVisible(true)
    setTimelineData([])
    try {
      const data = await api.registrationHistory(registration.id)
      setTimelineData(data.data || [])
    } catch {
      setLocalError('Failed to load history')
    }
  }

  const handleExport = () => {
    const headers = ['UID No', 'Date', 'Agency Name', 'Current Stage', 'Currently With', 'Priority', 'Days at Stage', 'Payment Status', 'Total Payment', 'Balance Dues']
    const rows = filtered.map((r) => [
      r.uid_no,
      displayDate(r.received_date),
      r.agency_name,
      r.current_stage ?? '1. Registered',
      r.currently_with ?? '',
      r.priority ?? 'Medium',
      r.days_at_stage ?? 0,
      r.payment_status ?? 'Not Invoiced',
      r.total_payment,
      r.balance_dues,
    ])
    exportToCsv(headers, rows, `registrations_${new Date().toISOString().slice(0, 10)}.csv`)
  }

  const applyDateFilter = (start: string, end: string) => { setStartDate(start); setEndDate(end); setActiveFilter(Boolean(start || end)); setApplyCount((n) => n + 1) }

  // Any filter change sends the table back to page 1
  const filterKey = `${roleFilter}|${activeFilter ? `${startDate}|${endDate}` : ''}|${query.trim().toLowerCase()}|${applyCount}`

  const wizardInitial = (): RegistrationFormData => {
    if (!editingId) return {
      uid_no: '', received_date: new Date().toISOString().slice(0, 10),
      agency_name: '', reporting_address: '', mobile_no: '',
      name_of_work: '', sample_details: '', total_payment: '0',
      advance_payment: '0', balance_dues: '0', payment_followup: '',
      remark: '', qty: '', assign_to: 'lab',
      current_stage: '1. Registered', currently_with: '', priority: 'Medium',
      target_date: '', payment_status: 'Not Invoiced', handover_note: '',
    }
    const reg = registrations.find((r) => r.id === editingId)
    if (!reg) return {
      uid_no: '', received_date: new Date().toISOString().slice(0, 10),
      agency_name: '', reporting_address: '', mobile_no: '',
      name_of_work: '', sample_details: '', total_payment: '0',
      advance_payment: '0', balance_dues: '0', payment_followup: '',
      remark: '', qty: '', assign_to: 'lab',
      current_stage: '1. Registered', currently_with: '', priority: 'Medium',
      target_date: '', payment_status: 'Not Invoiced', handover_note: '',
    }
    return {
      uid_no: reg.uid_no,
      received_date: normalizeDate(reg.received_date),
      agency_name: reg.agency_name,
      reporting_address: reg.reporting_address,
      mobile_no: reg.mobile_no,
      name_of_work: reg.name_of_work,
      work_order_no: reg.work_order_no ?? '',
      reference: reg.reference ?? '',
      work: reg.work ?? '',
      report_status: reg.report_status ?? '',
      sample_details: reg.sample_details,
      sample_details_1: reg.sample_details_1 ?? '',
      sample_details_2: reg.sample_details_2 ?? '',
      sample_details_3: reg.sample_details_3 ?? '',
      sample_details_4: reg.sample_details_4 ?? '',
      sample_items: reg.sample_items ?? '',
      new_back: reg.new_back ?? '',
      new_back_1: reg.new_back_1 ?? '',
      new_back_2: reg.new_back_2 ?? '',
      new_back_3: reg.new_back_3 ?? '',
      new_back_4: reg.new_back_4 ?? '',
      total_payment: String(reg.total_payment ?? 0),
      advance_payment: String(reg.advance_payment ?? 0),
      balance_dues: String(reg.balance_dues ?? 0),
      payment_followup: reg.payment_followup ?? '',
      financial_remark: reg.financial_remark ?? '',
      mode_of_payment: reg.mode_of_payment ?? '',
      gst_no: reg.gst_no ?? '',
      sample_nos: reg.sample_nos ?? '',
      remark: reg.remark ?? '',
      qty: reg.qty ?? '',
      qty_1: reg.qty_1 ?? '',
      qty_2: reg.qty_2 ?? '',
      qty_3: reg.qty_3 ?? '',
      qty_4: reg.qty_4 ?? '',
      witness: reg.witness ?? '',
      sample_test: reg.sample_test ?? '',
      sample_remark: reg.sample_remark ?? '',
      report_no: reg.report_no ?? '',
      field_person_name: reg.field_person_name ?? '',
      prepared_date: normalizeDate(reg.prepared_date),
      dispatch_date: normalizeDate(reg.dispatch_date),
      assign_to: reg.assign_to ?? 'lab',
      current_stage: reg.current_stage ?? '1. Registered',
      currently_with: reg.currently_with ?? '',
      priority: reg.priority ?? 'Medium',
      target_date: normalizeDate(reg.target_date),
      payment_status: reg.payment_status ?? 'Not Invoiced',
      handover_note: '',
      // Saved attachments, so the Files tab shows what is already uploaded.
      scan_copy: reg.scan_copy ?? '',
      scan_copy_1: reg.scan_copy_1 ?? '',
      scan_copy_2: reg.scan_copy_2 ?? '',
      scan_copy_3: reg.scan_copy_3 ?? '',
      scan_copy_4: reg.scan_copy_4 ?? '',
      scan_copy_5: reg.scan_copy_5 ?? '',
      scan_copy_6: reg.scan_copy_6 ?? '',
      scan_copy_7: reg.scan_copy_7 ?? '',
      scan_copy_8: reg.scan_copy_8 ?? '',
      scan_copy_9: reg.scan_copy_9 ?? '',
    }
  }

  const filterTabs: Array<{ key: string; label: string; count?: number }> = [
    { key: 'all', label: 'All jobs', count: registrations.length },
    { key: 'registration', label: 'Registration' },
    { key: 'lab', label: 'Lab / Field' },
    { key: 'report_staff', label: 'Report drafting' },
    { key: 'technical', label: 'Review' },
    { key: 'manager', label: 'Payment dues' },
    { key: 'closed', label: 'Closed' },
    { key: 'stuck', label: 'Stuck' },
  ]

  return (
    <div className="space-y-4">
      {/* Registration filters and actions */}
      <div className="registration-filter-stack">
        <div className="registration-filter-row registration-filter-row-top">
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          aria-label="Filter registrations by stage"
          style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', background: '#fff', minWidth: 165 }}
        >
          {filterTabs.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}{typeof t.count === 'number' ? ` (${t.count})` : ''}
            </option>
          ))}
        </select>
        <DateRangeFilter start={activeFilter ? startDate : ''} end={activeFilter ? endDate : ''} onApply={applyDateFilter} />
        <button className="btn btn-outline" onClick={handleExport} type="button">
          <Download size={15} /> Export
        </button>
        </div>
        <div className="registration-filter-row registration-filter-row-bottom">
        <div style={{ position: 'relative', minWidth: 220, flex: 1 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search UID, agency, work..." aria-label="Search registrations" style={{ width: '100%', padding: '7px 10px 7px 32px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', background: '#fff' }} />
        </div>
        <button className="btn btn-primary registration-create-button" onClick={beginCreate} type="button">
          <Plus size={16} /> Create Registration
        </button>
        </div>
      </div>

      {/* Main Data Table matching Old software Manage Registration table */}
      <div>
        <DataTable
          resetPageKey={filterKey}
          showHeader={false}
          columns={[
            { key: 'uid_no', label: 'UID NO.' },
            { key: 'received_date', label: 'Date' },
            { key: 'agency_name', label: 'Agency Name' },
            { key: 'reporting_address', label: 'Reporting Address' },
            { key: 'mobile_no', label: 'Mobile No.' },
            { key: 'name_of_work', label: 'Name Of Work' },
            { key: 'sample_details', label: 'Sample Details' },
            { key: 'total_payment', label: 'Total Payment', align: 'center', width: 95 },
            { key: 'advance_payment', label: 'Advance Payment', align: 'center', width: 95 },
            { key: 'balance_dues', label: 'Payment Dues', align: 'center', width: 95 },
            { key: 'bill', label: 'Invoice', sortable: false, align: 'center', width: 70 },
            { key: 'actions', label: 'Action', sortable: false },
          ]}
          rows={filtered.map((registration) => {
            const isPaid = (registration.balance_dues ?? 0) <= 0

            return {
              uid_no: (
                <button
                  type="button"
                  onClick={() => beginEdit(registration)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    padding: 0,
                    color: '#2563eb',
                    fontWeight: 700,
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    fontSize: '0.84rem'
                  }}
                  title="Click to edit registration"
                >
                  <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3 }}>
                    {registration.is_draft ? <span className="badge badge-warning">Draft</span> : null}
                    <span>{registration.uid_no || 'Draft registration'}</span>
                  </span>
                </button>
              ),
              received_date: (
                <span style={{ fontSize: '0.82rem', whiteSpace: 'nowrap', color: '#334155' }}>
                  {displayDate(registration.received_date) || '-'}
                </span>
              ),
              agency_name: (
                <div style={{ maxWidth: 180, fontSize: '0.82rem', fontWeight: 600, color: '#0f172a', lineHeight: 1.3 }}>
                  {registration.agency_name}
                </div>
              ),
              reporting_address: (
                <div style={{ maxWidth: 180, fontSize: '0.8rem', color: '#475569', lineHeight: 1.3 }}>
                  {registration.reporting_address || '-'}
                </div>
              ),
              mobile_no: (
                <span style={{ fontSize: '0.82rem', color: '#334155', whiteSpace: 'nowrap' }}>
                  {registration.mobile_no || '-'}
                </span>
              ),
              name_of_work: (
                <div style={{ maxWidth: 200, fontSize: '0.8rem', color: '#475569', lineHeight: 1.3 }}>
                  <span style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{registration.name_of_work || '-'}</span>
                  {(registration.name_of_work ?? '').length > 90 ? (
                    <button type="button" onClick={() => setWorkFor(registration)} style={{ background: 'none', border: 'none', padding: 0, marginTop: 4, color: '#2563eb', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer' }}>Read more</button>
                  ) : null}
                </div>
              ),
              sample_details: (
                <div style={{ maxWidth: 180, fontSize: '0.8rem', color: '#334155' }}>
                  <span style={{ fontWeight: 600 }}>{registration.sample_details || '-'}</span>
                  {registration.qty ? <span style={{ color: '#64748b' }}> (Qty: {registration.qty})</span> : null}
                </div>
              ),
              total_payment: (
                <span style={{ fontWeight: 600, fontSize: '0.82rem', color: '#0f172a' }}>
                  ₹{money(registration.total_payment)}
                </span>
              ),
              advance_payment: (
                <span style={{ fontSize: '0.82rem', color: '#16a34a', fontWeight: 600 }}>
                  ₹{money(registration.advance_payment)}
                </span>
              ),
              balance_dues: (
                <span
                  style={{
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    color: isPaid ? '#16a34a' : '#dc2626'
                  }}
                >
                  ₹{money(registration.balance_dues)}
                </span>
              ),
              bill: registration.uid_no && billedUids.has(registration.uid_no.trim().toLowerCase()) ? (
                onViewBill ? (
                  <button
                    type="button"
                    onClick={() => onViewBill(registration.uid_no)}
                    title="View invoice"
                    style={{
                      border: '1px solid #bbf7d0',
                      background: '#f0fdf4',
                      padding: '5px 10px',
                      borderRadius: 6,
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      color: '#16a34a',
                      cursor: 'pointer'
                    }}
                  >
                    View
                  </button>
                ) : (
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#16a34a' }}>Billed</span>
                )
              ) : registration.uid_no && onCreateBill ? (
                <button
                  type="button"
                  onClick={() => onCreateBill(registration.uid_no)}
                  title="Create an invoice for this UID"
                  style={{
                    border: '1px solid #bfdbfe',
                    background: '#eff6ff',
                    padding: '5px 10px',
                    borderRadius: 6,
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    color: '#1d4ed8',
                    cursor: 'pointer'
                  }}
                >
                  Create
                </button>
              ) : (
                <span style={{ color: '#94a3b8' }}>-</span>
              ),
              actions: (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <button
                    className="manage-btn"
                    onClick={() => beginEdit(registration)}
                    title="Edit Registration"
                    type="button"
                    style={{
                      border: '1px solid #cbd5e1',
                      background: '#fff',
                      padding: '5px 10px',
                      borderRadius: 6,
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      color: '#2563eb',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      cursor: 'pointer'
                    }}
                  >
                    <UserCog size={13} /> Edit
                  </button>
                  <button
                    className="icon-btn"
                    onClick={() => showHistory(registration)}
                    title="Audit trail"
                    type="button"
                  >
                    <History size={16} />
                  </button>
                  <button
                    className="icon-btn"
                    onClick={() => setDrawerUid(registration.uid_no)}
                    title="Documents"
                    type="button"
                  >
                    <Folder size={16} />
                  </button>
                </div>
              ),
            }
          })}
        />
      </div>

      {/* Registration Wizard Modal */}
      {formVisible && (
        <div className="modal-overlay" onClick={() => { setEditingId(null); setFormVisible(false) }}>
          <div className="modal-content modal-lg" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => { setEditingId(null); setFormVisible(false) }} type="button">
              <X size={18} />
            </button>
            <RegistrationWizard
              key={editingId ?? 'new'}
              editingId={editingId}
              initial={wizardInitial()}
              onSaved={handleSaved}
              onCancel={() => { setEditingId(null); setFormVisible(false) }}
              onGenerateUid={async () => { const d = await request<{ uid_no: string }>('/registrations/generate-uid'); return d.uid_no }}
              generatingUid={false}
            />
          </div>
        </div>
      )}

      {/* Timeline Audit Drawer */}
      {timelineVisible && (
        <Timeline
          entries={timelineData}
          uidNo={timelineUid}
          onClose={() => {
            setTimelineVisible(false)
            setTimelineData([])
            setTimelineUid('')
          }}
        />
      )}

      {/* Document Library Drawer */}
      {workFor ? (
        <Modal title="Name of work" subtitle={`${workFor.uid_no || 'Draft'} · ${workFor.agency_name || ''}`} onClose={() => setWorkFor(null)} size={600}>
          <p style={{ margin: 0, color: '#1e293b', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{workFor.name_of_work}</p>
        </Modal>
      ) : null}

      <UIDDocumentDrawer
        uidNo={drawerUid}
        isOpen={Boolean(drawerUid)}
        onClose={() => setDrawerUid('')}
      />
    </div>
  )
}
