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
    <div className="reg-page-container">
      {/* Top Action Bar */}
      <div className="reg-page-actions">
        <button className="btn btn-outline btn-sm" onClick={handleExport} type="button">
          <Download size={14} /> Export CSV
        </button>
        <button className="btn btn-primary btn-sm" onClick={beginCreate} type="button">
          <Plus size={15} /> New Registration
        </button>
      </div>

      {/*
      <div className="reg-metrics-grid">
        <div className="reg-metric-card">
          <div className="reg-metric-icon" style={{ background: 'rgba(0, 113, 227, 0.08)', color: 'var(--color-primary)' }}>
            <ClipboardList size={20} />
          </div>
          <div className="reg-metric-content">
            <span className="reg-metric-label">Total Jobs</span>
            <strong className="reg-metric-val">{metrics.total}</strong>
            <span className="reg-metric-sub">{metrics.active} in active workflow</span>
          </div>
        </div>

        <div className="reg-metric-card">
          <div className="reg-metric-icon" style={{ background: 'rgba(52, 199, 89, 0.08)', color: 'var(--color-green-text)' }}>
            <IndianRupee size={20} />
          </div>
          <div className="reg-metric-content">
            <span className="reg-metric-label">Total Billed</span>
            <strong className="reg-metric-val">₹{money(metrics.totalValue)}</strong>
            <span className="reg-metric-sub">Across all registrations</span>
          </div>
        </div>

        <div className="reg-metric-card">
          <div className="reg-metric-icon" style={{ background: metrics.balanceDues > 0 ? 'rgba(255, 59, 48, 0.08)' : 'rgba(52, 199, 89, 0.08)', color: metrics.balanceDues > 0 ? 'var(--color-red-text)' : 'var(--color-green-text)' }}>
            <Clock size={20} />
          </div>
          <div className="reg-metric-content">
            <span className="reg-metric-label">Pending Dues</span>
            <strong className="reg-metric-val" style={{ color: metrics.balanceDues > 0 ? 'var(--color-red-text)' : 'var(--color-green-text)' }}>
              ₹{money(metrics.balanceDues)}
            </strong>
            <span className="reg-metric-sub">Outstanding balance</span>
          </div>
        </div>

        <div className="reg-metric-card">
          <div className="reg-metric-icon" style={{ background: metrics.stuck > 0 ? 'rgba(245, 158, 11, 0.08)' : 'rgba(0, 0, 0, 0.04)', color: metrics.stuck > 0 ? 'var(--color-accent-dark)' : 'var(--gray-400)' }}>
            <AlertTriangle size={20} />
          </div>
          <div className="reg-metric-content">
            <span className="reg-metric-label">Stuck Jobs (&gt;2d)</span>
            <strong className="reg-metric-val" style={{ color: metrics.stuck > 0 ? 'var(--color-accent-dark)' : 'var(--gray-900)' }}>
              {metrics.stuck}
            </strong>
            <span className="reg-metric-sub">{metrics.stuck > 0 ? 'Action needed' : 'All jobs on track'}</span>
          </div>
        </div>
      </div>

      */}
      {/* Segmented Queue Filter Strip */}
      <div className="apple-filter-strip">
        {filterTabs.map((tab) => {
          const isActive = roleFilter === tab.key
          return (
            <button
              key={tab.key}
              type="button"
              className={`apple-filter-pill${isActive ? ' active' : ''}`}
              onClick={() => setRoleFilter(tab.key)}
            >
              <span>{tab.label}</span>
              {tab.count !== undefined ? <span className="apple-filter-pill__count">{tab.count}</span> : null}
            </button>
          )
        })}
      </div>

      {/* Action Toolbar */}
      <div className="filter-bar reg-toolbar">
        <div className="search-field" style={{ flex: 1, minWidth: 260 }}>
          <Search size={15} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search UID, client agency, work name, or assignee..."
          />
        </div>

        <div className="date-filter">
          <Calendar size={14} />
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            title="Start date"
          />
          <span>to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            title="End date"
          />
          <button className="btn btn-sm btn-outline" onClick={applyDateFilter} type="button">
            Apply
          </button>
          {activeFilter && (
            <button className="btn btn-sm btn-danger" onClick={clearDateFilter} type="button">
              Reset
            </button>
          )}
        </div>

      </div>

      {/* Main Data Table */}
      <div className="table-card">
        <DataTable
          showHeader={false}
          columns={[
            { key: 'uid', label: 'UID / Date' },
            { key: 'agency', label: 'Client & Work' },
            { key: 'stage', label: 'Stage' },
            { key: 'assignee', label: 'Assignee' },
            { key: 'days', label: 'Time' },
            { key: 'amount', label: 'Value' },
            { key: 'balance', label: 'Balance' },
            { key: 'payment_status', label: 'Payment' },
            { key: 'actions', label: 'Actions', sortable: false },
          ]}
          rows={filtered.map((registration) => {
            const isStuck = (registration.days_at_stage ?? 0) >= 2 && registration.current_stage !== '8. Closed'
            const isPaid = (registration.balance_dues ?? 0) <= 0
            const attachedDocs = [
              registration.scan_copy,
              registration.scan_copy_1,
              registration.scan_copy_2,
              registration.scan_copy_3,
              registration.scan_copy_4,
              registration.report_copy,
            ].filter(Boolean)

            return {
              uid: (
                <div>
                  <span className="uid-cell">{registration.uid_no}</span>
                  <div style={{ fontSize: '0.72rem', color: 'var(--gray-400)', marginTop: 2 }}>
                    {normalizeDate(registration.received_date)}
                  </div>
                  {attachedDocs.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => setDrawerUid(registration.uid_no)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                        fontSize: '0.68rem',
                        fontWeight: 600,
                        color: 'var(--color-primary)',
                        background: 'var(--color-primary-tint)',
                        padding: '1px 6px',
                        borderRadius: 4,
                        marginTop: 4,
                        border: 0,
                        cursor: 'pointer',
                      }}
                      title="View attached documents"
                    >
                      <Paperclip size={10} /> {attachedDocs.length} {attachedDocs.length === 1 ? 'doc' : 'docs'}
                    </button>
                  ) : null}
                </div>
              ),
              agency: (
                <div style={{ maxWidth: 220 }}>
                  <strong style={{ display: 'block', fontSize: '0.85rem', color: 'var(--gray-900)' }}>
                    {registration.agency_name}
                  </strong>
                  <span style={{ fontSize: '0.76rem', color: 'var(--gray-500)', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {registration.name_of_work}
                  </span>
                </div>
              ),
              stage: (
                <span className="stage-pill stage-pill--default">
                  {registration.current_stage ?? '1. Registered'}
                </span>
              ),
              assignee: (
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: registration.currently_with ? 'var(--gray-800)' : 'var(--gray-400)' }}>
                  {registration.currently_with || 'Unassigned'}
                </span>
              ),
              days: (
                <span className={`turnaround ${isStuck ? 'turnaround--danger' : 'turnaround--ok'}`}>
                  {isStuck ? '⚠️ ' : ''}{registration.days_at_stage ?? 0}d
                </span>
              ),
              amount: (
                <span className="mono" style={{ fontWeight: 600, color: 'var(--gray-900)' }}>
                  ₹{money(registration.total_payment)}
                </span>
              ),
              balance: (
                <span className={`mono ${isPaid ? 'text-success' : 'text-danger'}`} style={{ fontWeight: 700 }}>
                  ₹{money(registration.balance_dues)}
                </span>
              ),
              payment_status: (
                <span className="badge reg-payment-status" style={{
                  background: isPaid ? 'rgba(52, 199, 89, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                  color: isPaid ? 'var(--color-green-text)' : 'var(--color-orange-text)',
                }}>
                  {registration.payment_status || (isPaid ? 'Fully Received' : 'Not Invoiced')}
                </span>
              ),
              actions: (
                <div className="reg-row-actions">
                  <button
                    className="manage-btn"
                    onClick={() => beginEdit(registration)}
                    title="Manage registration"
                    type="button"
                  >
                    <UserCog size={13} style={{ marginRight: 4 }} /> Edit
                  </button>
                  <button
                    className="icon-btn"
                    onClick={() => showHistory(registration)}
                    title="Audit trail"
                    type="button"
                  >
                    <History size={15} />
                  </button>
                  <button
                    className="icon-btn"
                    onClick={() => setDrawerUid(registration.uid_no)}
                    title="Documents"
                    type="button"
                  >
                    <Folder size={15} />
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
