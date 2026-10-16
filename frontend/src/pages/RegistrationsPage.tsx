import { useState, useMemo } from 'react'
import { Search, Plus, UserCog, History, Download, Calendar, X, Folder, Paperclip } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { api, request } from '../lib/api'
import { DataTable } from '../components/DataTable'
import { RegistrationWizard } from '../components/RegistrationWizard'
import { Timeline } from '../components/Timeline'
import { UIDDocumentDrawer } from '../components/UIDDocumentDrawer'
import type { Registration, RegistrationFormData } from '../lib/types'
import { getUserDefaultRoleTab } from '../lib/roleConfig'

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

export function RegistrationsPage() {
  const { user, registrations, refresh, clearError, setStatus } = useAuth()
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
  const [roleFilter, setRoleFilter] = useState<string>(() => getUserDefaultRoleTab(user?.tracker_role))

  const filtered = useMemo(() => {
    let list = registrations

    if (roleFilter !== 'all') {
      if (roleFilter === 'stuck') {
        list = list.filter((r) => (r.days_at_stage ?? 0) >= 2 && r.current_stage !== '8. Closed')
      } else if (roleFilter === 'registration') {
        list = list.filter((r) => r.current_stage === '1. Registered' || r.current_stage === '6. Report Dispatched')
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
      normalizeDate(r.received_date),
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

  const applyDateFilter = () => { setActiveFilter(true) }
  const clearDateFilter = () => { setStartDate(''); setEndDate(''); setActiveFilter(false) }

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
      {/* Clean Professional Top Toolbar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
        padding: '16px 20px',
        background: '#fff',
        borderRadius: 12,
        border: '1px solid #e2e8f0'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
            Manage Client Registration
          </h2>
          <span style={{
            fontSize: '0.78rem',
            fontWeight: 700,
            background: '#eff6ff',
            color: '#2563eb',
            padding: '2px 10px',
            borderRadius: 999
          }}>
            {filtered.length} Records
          </span>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            className="ghost-button"
            onClick={handleExport}
            type="button"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.84rem', padding: '7px 14px' }}
          >
            <Download size={15} /> Export CSV
          </button>
          <button
            className="primary-button"
            onClick={beginCreate}
            type="button"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.84rem', padding: '7px 16px', fontWeight: 600 }}
          >
            <Plus size={16} /> Create Registration
          </button>
        </div>
      </div>

      {/* Role / Stage Filter Tabs */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {filterTabs.map((t) => {
          const isActive = roleFilter === t.key
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setRoleFilter(t.key)}
              style={{
                border: 'none',
                background: isActive ? '#2563eb' : '#fff',
                color: isActive ? '#fff' : '#64748b',
                padding: '6px 14px',
                borderRadius: 20,
                fontSize: '0.82rem',
                fontWeight: isActive ? 600 : 500,
                cursor: 'pointer',
                borderWidth: 1,
                borderStyle: 'solid',
                borderColor: isActive ? '#2563eb' : '#e2e8f0',
                transition: 'all 0.15s ease'
              }}
            >
              {t.label}
              {typeof t.count === 'number' && (
                <span style={{ marginLeft: 6, opacity: 0.85, fontSize: '0.75rem' }}>({t.count})</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Date Filter Bar Matching Old Software start_date - end_date - GO */}
      <div style={{
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        flexWrap: 'wrap',
        padding: '12px 16px',
        background: '#f8fafc',
        borderRadius: 10,
        border: '1px solid #e2e8f0'
      }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Calendar size={15} color="#64748b" />
          <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569' }}>Start Date:</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', background: '#fff' }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569' }}>End Date:</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', background: '#fff' }}
          />
        </div>

        <button
          className="primary-button"
          onClick={applyDateFilter}
          type="button"
          style={{ padding: '6px 16px', fontSize: '0.82rem', fontWeight: 600 }}
        >
          GO
        </button>

        {activeFilter && (
          <button
            className="ghost-button"
            onClick={clearDateFilter}
            type="button"
            style={{ fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}
          >
            <X size={14} /> Clear
          </button>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, minWidth: 260, maxWidth: 360, flex: 1 }}>
          <div style={{ position: 'relative', width: '100%' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search UID, agency, work, mobile..."
              style={{
                width: '100%',
                padding: '6px 10px 6px 32px',
                borderRadius: 6,
                border: '1px solid #cbd5e1',
                fontSize: '0.82rem',
                background: '#fff'
              }}
            />
          </div>
        </div>
      </div>

      {/* Main Data Table matching Old software Manage Registration table */}
      <div className="table-card" style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '16px' }}>
        <DataTable
          showHeader={false}
          columns={[
            { key: 'uid_no', label: 'UID NO.' },
            { key: 'received_date', label: 'Date' },
            { key: 'agency_name', label: 'Agency Name' },
            { key: 'reporting_address', label: 'Reporting Address' },
            { key: 'mobile_no', label: 'Mobile No.' },
            { key: 'name_of_work', label: 'Name Of Work' },
            { key: 'sample_details', label: 'Sample Details' },
            { key: 'total_payment', label: 'Total Payment' },
            { key: 'advance_payment', label: 'Advance Payment' },
            { key: 'balance_dues', label: 'Payment Dues' },
            { key: 'scan_copy', label: 'Scan Copy' },
            { key: 'report_copy', label: 'Report Copy' },
            { key: 'actions', label: 'Action', sortable: false },
          ]}
          rows={filtered.map((registration) => {
            const isPaid = (registration.balance_dues ?? 0) <= 0
            const attachedDocs = [
              registration.scan_copy,
              registration.scan_copy_1,
              registration.scan_copy_2,
              registration.scan_copy_3,
              registration.scan_copy_4,
            ].filter(Boolean)

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
                  {registration.uid_no}
                </button>
              ),
              received_date: (
                <span style={{ fontSize: '0.82rem', whiteSpace: 'nowrap', color: '#334155' }}>
                  {normalizeDate(registration.received_date) || '-'}
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
                  {registration.name_of_work || '-'}
                </div>
              ),
              sample_details: (
                <div style={{ maxWidth: 180, fontSize: '0.8rem', color: '#334155' }}>
                  <span style={{ fontWeight: 600 }}>{registration.sample_details || '-'}</span>
                  {registration.qty ? <span style={{ color: '#64748b' }}> (Qty: {registration.qty})</span> : null}
                </div>
              ),
              total_payment: (
                <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.82rem', color: '#0f172a' }}>
                  ₹{money(registration.total_payment)}
                </span>
              ),
              advance_payment: (
                <span style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: '#16a34a', fontWeight: 600 }}>
                  ₹{money(registration.advance_payment)}
                </span>
              ),
              balance_dues: (
                <span
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    color: isPaid ? '#16a34a' : '#dc2626'
                  }}
                >
                  ₹{money(registration.balance_dues)}
                </span>
              ),
              scan_copy: (
                <div>
                  {attachedDocs.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => setDrawerUid(registration.uid_no)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        color: '#0284c7',
                        background: '#e0f2fe',
                        border: '1px solid #bae6fd',
                        padding: '3px 8px',
                        borderRadius: 6,
                        cursor: 'pointer'
                      }}
                      title="View uploaded scan documents"
                    >
                      <Paperclip size={11} /> View ({attachedDocs.length})
                    </button>
                  ) : (
                    <span style={{ fontSize: '0.76rem', color: '#94a3b8' }}>None</span>
                  )}
                </div>
              ),
              report_copy: (
                <div>
                  {registration.report_copy ? (
                    <a
                      href={registration.report_copy.startsWith('http') ? registration.report_copy : `/uploads/${registration.report_copy}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        color: '#16a34a',
                        background: '#f0fdf4',
                        border: '1px solid #bbf7d0',
                        padding: '3px 8px',
                        borderRadius: 6,
                        textDecoration: 'none'
                      }}
                    >
                      Report Copy
                    </a>
                  ) : (
                    <span style={{ fontSize: '0.76rem', color: '#94a3b8' }}>-</span>
                  )}
                </div>
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
                    style={{
                      border: '1px solid #cbd5e1',
                      background: '#fff',
                      padding: '5px 8px',
                      borderRadius: 6,
                      cursor: 'pointer'
                    }}
                  >
                    <History size={14} color="#64748b" />
                  </button>
                  <button
                    className="icon-btn"
                    onClick={() => setDrawerUid(registration.uid_no)}
                    title="Documents"
                    type="button"
                    style={{
                      border: '1px solid #cbd5e1',
                      background: '#fff',
                      padding: '5px 8px',
                      borderRadius: 6,
                      cursor: 'pointer'
                    }}
                  >
                    <Folder size={14} color="#64748b" />
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
      <UIDDocumentDrawer
        uidNo={drawerUid}
        isOpen={Boolean(drawerUid)}
        onClose={() => setDrawerUid('')}
      />
    </div>
  )
}
