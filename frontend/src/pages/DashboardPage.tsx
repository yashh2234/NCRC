import { useCallback, useEffect, useState } from 'react'
import {
  ClipboardList, UserCheck, AlertTriangle, Briefcase, Eye, ThumbsUp,
  CreditCard, Truck, Sparkles, Clock, IndianRupee, Users, FileText,
  CheckCircle2, ArrowUpRight, BarChart3, TrendingUp, Plus, Search, X
} from 'lucide-react'
import { useAuth } from '../lib/auth'
import { MetricCard } from '../components/MetricCard'
import { DashboardAnalyticsWidget } from '../components/DashboardAnalyticsWidget'
import { RegistrationWizard } from '../components/RegistrationWizard'
import { api, request } from '../lib/api'
import { useTracking } from '../lib/useTracking'
import { getRoleConfig, shouldShowWidget } from '../lib/roleConfig'
import type { TrackerRole, MyQueueItem, Registration } from '../lib/types'

interface TrendsData {
  monthly_registrations: Array<{
    month: string
    total: number
    total_amount: number
    received_amount: number
    balance_amount: number
  }>
  report_statuses: {
    total: number
    pending: number
    complete: number
    cancel: number
  }
  today_reports: number
}

function money(value: number) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(value)
}

export function DashboardPage() {
  const { user, dashboard, registrations, refresh } = useAuth()
  useTracking('dashboard')

  const trackerRole: TrackerRole = (user?.tracker_role ?? dashboard?.user_role ?? 'staff') as TrackerRole
  const roleConfig = getRoleConfig(trackerRole)
  const metrics = dashboard?.metrics ?? {}

  // Master Control Dashboard state for Admin
  const [selectedStage, setSelectedStage] = useState<string>('all')
  const [masterSearch, setMasterSearch] = useState<string>('')
  const [stuckOnly, setStuckOnly] = useState<boolean>(false)
  const [editingReg, setEditingReg] = useState<Registration | null>(null)
  const [showWizard, setShowWizard] = useState<boolean>(false)

  // Period / Date range state for Analytics
  const [period, setPeriod] = useState<string>('monthly')
  const [fromDate, setFromDate] = useState<string>(() => {
    const d = new Date()
    d.setDate(1)
    return d.toISOString().substring(0, 10)
  })
  const [toDate, setToDate] = useState<string>(() => new Date().toISOString().substring(0, 10))

  const [trends, setTrends] = useState<TrendsData | null>(null)
  const [assignedCount, setAssignedCount] = useState(0)
  const [monthExpenses, setMonthExpenses] = useState<Array<{ category: string; total: number }>>([])
  const [trackingSummary, setTrackingSummary] = useState<any>(null)
  const [recentActivities, setRecentActivities] = useState<any[]>([])
  const [myQueue, setMyQueue] = useState<MyQueueItem[]>([])

  const loadTrends = useCallback(async (p: string, fDate?: string, tDate?: string) => {
    try {
      const params = new URLSearchParams()
      params.set('period', p)
      if (p === 'custom' && fDate && tDate) {
        params.set('from_date', fDate)
        params.set('to_date', tDate)
      }
      const data = await request<TrendsData>(`/dashboard/trends?${params.toString()}`)
      setTrends(data)
    } catch {}
  }, [])

  const handlePeriodChange = (newPeriod: string, fDate?: string, tDate?: string) => {
    setPeriod(newPeriod)
    if (fDate) setFromDate(fDate)
    if (tDate) setToDate(tDate)
    void loadTrends(newPeriod, fDate || fromDate, tDate || toDate)
  }

  const loadAssigned = useCallback(async () => {
    try {
      const data = await api.myAssigned()
      setAssignedCount(data.count)
    } catch {}
  }, [])

  const loadExpenses = useCallback(async () => {
    try {
      const data = await api.monthlyExpenses()
      setMonthExpenses(data.data)
    } catch {}
  }, [])

  const loadTracking = useCallback(async () => {
    try {
      const summaryData = await api.trackSummary()
      setTrackingSummary(summaryData)
      const actData = await api.userActivity()
      setRecentActivities((actData.activities || []).filter((a: any) => a.action !== 'page_visit'))
    } catch {}
  }, [])

  const loadMyQueue = useCallback(async () => {
    try {
      const data = await api.myQueue()
      setMyQueue(data.queue ?? [])
    } catch {}
  }, [])

  useEffect(() => {
    if (shouldShowWidget(trackerRole, 'analytics')) {
      void loadTrends(period, fromDate, toDate)
    }
    void loadAssigned()
    if (shouldShowWidget(trackerRole, 'expense_breakdown')) {
      void loadExpenses()
    }
    void loadTracking()
    void loadMyQueue()
  }, [period, fromDate, toDate, loadTrends, loadAssigned, loadExpenses, loadTracking, loadMyQueue, trackerRole])

  // ─── WELCOME SECTION ─────────────────────────────────────────────────
  const renderWelcome = () => (
    <section className="dash-welcome">
      <div>
        <div className="dash-welcome__label" style={{ color: roleConfig.color }}>
          <Sparkles size={14} />
          <span>{roleConfig.label} workspace</span>
        </div>
        <h1 className="dash-welcome__title">
          Welcome back, {user?.name || 'Administrator'}
        </h1>
        <p className="dash-welcome__subtitle">
          {roleConfig.description}
        </p>
      </div>

      {/* Quick summary tags & Action buttons */}
      <div className="dash-welcome__tags">
        {trackerRole === 'admin' && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              setEditingReg(null)
              setShowWizard(true)
            }}
          >
            <Plus size={15} /> New Registration
          </button>
        )}
        {shouldShowWidget(trackerRole, 'today_registrations') && (
          <div className="dash-tag">
            <span className="dash-tag__label">Today Registrations:</span>
            <strong className="dash-tag__value">{metrics.today_registration ?? 0}</strong>
          </div>
        )}
        {shouldShowWidget(trackerRole, 'financial_snapshot') && (
          <div className="dash-tag">
            <span className="dash-tag__label">Today Revenue:</span>
            <strong className="dash-tag__value--success">₹{money(metrics.today_balance_amount ?? 0)}</strong>
          </div>
        )}
        <div className="dash-tag" style={{ borderColor: roleConfig.color + '33', background: roleConfig.bgColor }}>
          <span style={{ color: roleConfig.color, fontWeight: 600 }}>
            Active System Jobs: {metrics.jobs_active ?? registrations.length}
          </span>
        </div>
      </div>
    </section>
  )

  // ─── 8-STAGE WORKFLOW PIPELINE (Admin Interactive Control) ───────────────
  const render8StagePipeline = () => {
    if (trackerRole !== 'admin' && trackerRole !== 'manager') return null
    const stageCounts = dashboard?.all_stage_counts ?? {}

    const stagesList = [
      { name: '1. Registered', label: '1. Intake', bg: '#ecfeff', color: '#0891b2', icon: ClipboardList },
      { name: '2. Field/Site Work', label: '2. Field Work', bg: '#eff6ff', color: '#2563eb', icon: Briefcase },
      { name: '3. Lab Testing', label: '3. Lab Testing', bg: '#ecfdf5', color: '#059669', icon: Sparkles },
      { name: '4. Report Drafting', label: '4. Report Draft', bg: '#fffbeb', color: '#d97706', icon: FileText },
      { name: '5. Report Review', label: '5. Technical Review', bg: '#eef2ff', color: '#4f46e5', icon: Eye },
      { name: '6. Report Dispatched', label: '6. Dispatch', bg: '#f0fdf4', color: '#16a34a', icon: Truck },
      { name: '7. Payment Pending', label: '7. Payment Dues', bg: '#fef2f2', color: '#dc2626', icon: IndianRupee },
      { name: '8. Closed', label: '8. Closed Jobs', bg: '#f1f5f9', color: '#475569', icon: CheckCircle2 },
    ]

    return (
      <section className="surface">
        <div className="dash-section-header">
          <div>
            <p className="dash-section-label" style={{ color: '#7c3aed' }}>
              Master 8-Stage Workflow Pipeline
            </p>
            <h2 className="dash-section-title">Click Any Stage to Filter Master Control Table Below</h2>
          </div>
          {selectedStage !== 'all' ? (
            <button
              onClick={() => setSelectedStage('all')}
              className="btn btn-sm btn-outline"
            >
              <X size={14} /> Clear Filter
            </button>
          ) : null}
        </div>

        <div className="pipeline-grid">
          {stagesList.map((st) => {
            const count = stageCounts[st.name] ?? 0
            const isSelected = selectedStage === st.name

            return (
              <button
                key={st.name}
                type="button"
                onClick={() => setSelectedStage(isSelected ? 'all' : st.name)}
                className={`pipeline-card${isSelected ? ' pipeline-card--active' : ''}`}
                style={{
                  borderColor: isSelected ? st.color : st.color + '33',
                  background: isSelected ? st.color : st.bg,
                  color: isSelected ? '#ffffff' : st.color,
                }}
              >
                <st.icon size={16} style={{ margin: '0 auto 4px', color: isSelected ? '#ffffff' : st.color }} />
                <strong className="pipeline-card__count">{count}</strong>
                <p className="pipeline-card__label">{st.label}</p>
              </button>
            )
          })}
        </div>
      </section>
    )
  }

  // ─── MASTER LIVE JOBS CONTROL TABLE (Admin Control Panel) ─────────────
  const renderMasterJobsControlTable = () => {
    if (trackerRole !== 'admin' && trackerRole !== 'manager') return null

    let list = registrations

    // Filter by selectedStage
    if (selectedStage !== 'all') {
      list = list.filter((r) => r.current_stage === selectedStage)
    }

    // Filter by stuckOnly
    if (stuckOnly) {
      list = list.filter((r) => (r.days_at_stage ?? 0) >= 2 && r.current_stage !== '8. Closed')
    }

    // Filter by masterSearch
    if (masterSearch.trim()) {
      const q = masterSearch.trim().toLowerCase()
      list = list.filter((r) =>
        [r.uid_no, r.agency_name, r.name_of_work, r.currently_with, r.current_stage, r.field_person_name, r.mobile_no]
          .join(' ')
          .toLowerCase()
          .includes(q)
      )
    }

    return (
      <section className="surface">
        <div className="dash-section-header">
          <div>
            <p className="dash-section-label" style={{ color: '#0891b2' }}>
              Master Operations Control Feed
            </p>
            <h2 className="dash-section-title">
              Live All-Jobs Feed ({list.length} Records {selectedStage !== 'all' ? `— ${selectedStage}` : ''})
            </h2>
          </div>

          {/* Quick Filters */}
          <div className="dash-welcome__tags">
            <div className="search-field" style={{ minWidth: 220 }}>
              <Search size={15} />
              <input
                value={masterSearch}
                onChange={(e) => setMasterSearch(e.target.value)}
                placeholder="Search UID, client, staff, stage..."
              />
            </div>

            <button
              type="button"
              onClick={() => setStuckOnly(!stuckOnly)}
              className={`stuck-filter-btn${stuckOnly ? ' stuck-filter-btn--active' : ''}`}
            >
              <AlertTriangle size={13} />
              {stuckOnly ? 'Showing Stuck Jobs (>2 Days)' : 'Filter Stuck Jobs (>2 Days)'}
            </button>
          </div>
        </div>

        <div className="dash-table-wrap">
          <table className="dash-table">
            <thead>
              <tr>
                <th>UID No</th>
                <th>Agency / Client</th>
                <th>Work Name</th>
                <th>Current Stage</th>
                <th>Currently With</th>
                <th>Turnaround</th>
                <th>Priority</th>
                <th>Payment Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr>
                  <td colSpan={9} className="empty-state" style={{ border: 'none' }}>
                    No matching registration jobs found.
                  </td>
                </tr>
              ) : (
                list.slice(0, 15).map((reg) => (
                  <tr key={reg.id}>
                    <td>
                      <span className="uid-link">{reg.uid_no}</span>
                    </td>
                    <td className="agency-name">{reg.agency_name}</td>
                    <td className="work-name">{reg.name_of_work}</td>
                    <td>
                      <span className="stage-pill stage-pill--default">
                        {reg.current_stage || '1. Registered'}
                      </span>
                    </td>
                    <td>
                      <span className="agency-name" style={{ fontWeight: 600, color: '#334155' }}>
                        {reg.currently_with || 'Unassigned'}
                      </span>
                    </td>
                    <td>
                      <span className={`turnaround ${(reg.days_at_stage ?? 0) >= 2 ? 'turnaround--danger' : 'turnaround--ok'}`}>
                        {(reg.days_at_stage ?? 0) >= 2 ? '⚠️ ' : ''}
                        {reg.days_at_stage ?? 0} days
                      </span>
                    </td>
                    <td>
                      <span className={`priority-pill priority-pill--${(reg.priority || 'Medium').toLowerCase()}`}>
                        {reg.priority || 'Medium'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.72rem', color: '#475569' }}>
                        {reg.payment_status || 'Not Invoiced'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingReg(reg)
                          setShowWizard(true)
                        }}
                        className="manage-btn"
                      >
                        Manage / Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {list.length > 15 ? (
          <p className="dash-section-sublabel">
            Showing top 15 of {list.length} matching jobs — view Registration Register page for full records.
          </p>
        ) : null}
      </section>
    )
  }

  // ─── MY QUEUE SECTION ─────────────────────────────────────────────────
  const renderMyQueue = () => {
    if (!shouldShowWidget(trackerRole, 'my_queue')) return null
    if (myQueue.length === 0) return null

    return (
      <section className="surface">
        <div className="dash-section-header">
          <div>
            <p className="dash-section-label" style={{ color: roleConfig.color }}>
              My Queue — {roleConfig.label}
            </p>
            <h2 className="dash-section-title">
              Jobs in My Stages ({myQueue.length})
            </h2>
          </div>
          <ClipboardList size={20} style={{ color: roleConfig.color }} />
        </div>

        <div className="dash-table-wrap">
          <table className="dash-table">
            <thead>
              <tr>
                <th>UID</th>
                <th>Client</th>
                <th>Description</th>
                <th>Stage</th>
                <th>Days</th>
                <th>Priority</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {myQueue.slice(0, 10).map((item) => (
                <tr key={item.id} className={item.is_overdue ? 'queue-overdue-row' : ''}>
                  <td>
                    <span className="uid-link">{item.uid_no}</span>
                  </td>
                  <td>{item.client_name || '—'}</td>
                  <td className="work-name">
                    {item.title || item.description || '—'}
                  </td>
                  <td>
                    <span className="stage-pill" style={{ background: roleConfig.bgColor, color: roleConfig.color }}>
                      {item.current_stage}
                    </span>
                  </td>
                  <td>
                    <span className={`turnaround ${item.days_at_stage > 2 ? 'turnaround--danger' : 'turnaround--ok'}`}>
                      <Clock size={12} />
                      {item.days_at_stage}d
                    </span>
                  </td>
                  <td>
                    <span className={`priority-pill priority-pill--${item.priority.toLowerCase()}`}>
                      {item.priority}
                    </span>
                  </td>
                  <td>
                    {item.is_overdue && (
                      <span className="overdue-tag">
                        <AlertTriangle size={11} /> OVERDUE
                      </span>
                    )}
                    {!item.is_overdue && (
                      <span className="on-track-tag">{item.status}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {myQueue.length > 10 && (
          <p className="dash-section-sublabel">
            Showing 10 of {myQueue.length} items — view UID Register for full list
          </p>
        )}
      </section>
    )
  }

  // ─── MY TASKS SECTION ─────────────────────────────────────────────────
  const renderMyTasks = () => {
    if (!shouldShowWidget(trackerRole, 'my_tasks')) return null
    const myPending = metrics.my_pending_jobs ?? 0
    const myReviews = metrics.my_pending_reviews ?? 0
    const total = myPending + myReviews
    if (total === 0 && assignedCount === 0) return null

    return (
      <section className="surface">
        <div className="dash-section-header">
          <div>
            <p className="dash-section-label" style={{ color: 'var(--color-primary)' }}>My Tasks</p>
            <h2 className="dash-section-title">Assigned Work Items</h2>
          </div>
          <UserCheck size={20} style={{ color: 'var(--color-primary)' }} />
        </div>
        <div className="my-tasks-grid">
          {myPending > 0 && (
            <div className="my-task-card" style={{ background: 'rgba(0,113,227,0.06)' }}>
              <strong className="my-task-card__count" style={{ color: 'var(--color-primary)' }}>{myPending}</strong>
              <p className="my-task-card__label" style={{ color: 'var(--color-primary-dark)' }}>Pending Jobs</p>
            </div>
          )}
          {myReviews > 0 && (
            <div className="my-task-card" style={{ background: '#fffbeb' }}>
              <strong className="my-task-card__count" style={{ color: '#d97706' }}>{myReviews}</strong>
              <p className="my-task-card__label" style={{ color: '#92400e' }}>Pending Reviews</p>
            </div>
          )}
          {assignedCount > 0 && (
            <div className="my-task-card" style={{ background: 'rgba(52,199,89,0.06)' }}>
              <strong className="my-task-card__count" style={{ color: 'var(--color-green-text)' }}>{assignedCount}</strong>
              <p className="my-task-card__label" style={{ color: 'var(--color-green-text)' }}>Assigned Testing Samples</p>
            </div>
          )}
        </div>
      </section>
    )
  }

  // ─── ROLE QUEUE COUNTS (Admin/Manager) ────────────────────────────────
  const renderRoleQueueCounts = () => {
    if (!shouldShowWidget(trackerRole, 'role_queue_counts')) return null
    const counts = dashboard?.role_queue_counts ?? {}
    if (Object.keys(counts).length === 0) return null

    const roles = [
      { key: 'registration', label: 'Registration', icon: ClipboardList, stages: 'Stages 1 & 6' },
      { key: 'lab', label: 'Lab / Field', icon: Briefcase, stages: 'Stages 2 & 3' },
      { key: 'report_staff', label: 'Report Staff', icon: FileText, stages: 'Stage 4' },
      { key: 'technical', label: 'Technical', icon: Eye, stages: 'Stage 5' },
      { key: 'manager', label: 'Manager', icon: IndianRupee, stages: 'Stage 7' },
    ]

    return (
      <section className="surface">
        <div className="dash-section-header">
          <div>
            <p className="dash-section-label" style={{ color: '#7c3aed' }}>
              Jobs in Each Role's Queue
            </p>
            <h2 className="dash-section-title">Workflow Queue Overview</h2>
          </div>
          <Users size={20} style={{ color: '#7c3aed' }} />
        </div>
        <div className="role-queue-grid">
          {roles.map((r) => {
            const config = getRoleConfig(r.key as TrackerRole)
            const count = counts[r.key] ?? 0
            return (
              <div
                key={r.key}
                className="role-queue-card"
                style={{ border: `1px solid ${config.color}22`, background: config.bgColor }}
              >
                <r.icon size={18} style={{ color: config.color, margin: '0 auto 6px' }} />
                <strong className="role-queue-card__count" style={{ color: config.color }}>{count}</strong>
                <p className="role-queue-card__label" style={{ color: config.color }}>{r.label}</p>
                <p className="role-queue-card__sub">{r.stages}</p>
              </div>
            )
          })}
        </div>
      </section>
    )
  }

  // ─── FINANCIAL SNAPSHOT (Manager/Admin) ────────────────────────────────
  const renderFinancialSnapshot = () => {
    if (!shouldShowWidget(trackerRole, 'financial_snapshot')) return null
    const fs = dashboard?.financial_snapshot
    if (!fs) return null

    const items = [
      { label: 'Total Billed', value: fs.total_billed, icon: BarChart3, color: '#4f46e5' },
      { label: 'Total Received', value: fs.total_received, icon: CheckCircle2, color: '#059669' },
      { label: 'Outstanding', value: fs.outstanding, icon: ArrowUpRight, color: '#dc2626' },
      { label: 'Avg Job Value', value: fs.avg_job_value, icon: TrendingUp, color: '#d97706' },
      { label: 'Active Job Value', value: fs.active_job_value, icon: Briefcase, color: '#0891b2' },
    ]

    return (
      <section className="surface">
        <div className="dash-section-header">
          <div>
            <p className="dash-section-label" style={{ color: '#059669' }}>Financial Snapshot</p>
            <h2 className="dash-section-title">Revenue & Payments</h2>
          </div>
          <IndianRupee size={20} style={{ color: '#059669' }} />
        </div>
        <div className="financial-grid">
          {items.map((item) => (
            <div key={item.label} className="financial-card">
              <item.icon size={16} style={{ color: item.color, margin: '0 auto 6px' }} />
              <strong className="financial-card__value" style={{ color: item.color }}>
                ₹{money(item.value)}
              </strong>
              <p className="financial-card__label">{item.label}</p>
            </div>
          ))}
        </div>
      </section>
    )
  }

  // ─── ATTENTION NEEDED (Admin/Manager/Technical) ───────────────────────
  const renderAttentionNeeded = () => {
    if (!shouldShowWidget(trackerRole, 'attention_needed')) return null
    const an = dashboard?.attention_needed
    if (!an) return null

    const items = [
      { label: 'Overdue Jobs (past target date, still active)', value: an.overdue_jobs, color: '#dc2626', icon: AlertTriangle },
      { label: 'Stuck > 2 days at current stage', value: an.stuck_jobs, color: '#d97706', icon: Clock },
      { label: 'Reports awaiting review or drafting', value: an.reports_awaiting, color: '#4f46e5', icon: FileText },
      { label: 'Payment follow-up needed (invoiced or partial)', value: an.payment_followup, color: '#059669', icon: CreditCard },
    ]

    return (
      <section className="surface">
        <div className="dash-section-header">
          <div>
            <p className="dash-section-label" style={{ color: '#dc2626' }}>Attention Needed</p>
            <h2 className="dash-section-title">Items Requiring Action</h2>
          </div>
          <AlertTriangle size={20} style={{ color: '#dc2626' }} />
        </div>
        <div className="attention-stack">
          {items.map((item) => (
            <div
              key={item.label}
              className={`attention-item${item.value > 0 ? ' attention-item--alert' : ''}`}
            >
              <div className="attention-item__info">
                <item.icon size={16} style={{ color: item.value > 0 ? item.color : '#9ca3af' }} />
                <span className="attention-item__label">{item.label}</span>
              </div>
              <strong
                className="attention-item__count"
                style={{ color: item.value > 0 ? item.color : '#9ca3af' }}
              >
                {item.value}
              </strong>
            </div>
          ))}
        </div>
      </section>
    )
  }

  // ─── JOB METRICS (role-filtered) ──────────────────────────────────────
  const renderJobMetrics = () => {
    if (!shouldShowWidget(trackerRole, 'job_metrics')) return null

    // Different roles see different metrics
    let jobMetrics: Array<{ label: string; value: number; detail: string; icon: any }> = []

    if (trackerRole === 'admin') {
      jobMetrics = [
        { label: 'Jobs Today', value: metrics.jobs_today ?? 0, detail: `${metrics.jobs_completed_today ?? 0} completed`, icon: ClipboardList },
        { label: 'Active Jobs', value: metrics.jobs_active ?? 0, detail: `${metrics.jobs_completed ?? 0} total completed`, icon: Briefcase },
        { label: 'Pending Review', value: metrics.jobs_pending_review ?? 0, detail: 'Technical review', icon: Eye },
        { label: 'Pending Approval', value: metrics.jobs_pending_approval ?? 0, detail: 'Final approval', icon: ThumbsUp },
        { label: 'Pending Billing', value: metrics.jobs_pending_billing ?? 0, detail: 'Invoice generation', icon: CreditCard },
        { label: 'Pending Dispatch', value: metrics.jobs_pending_dispatch ?? 0, detail: 'Dispatch to client', icon: Truck },
        { label: 'Overdue SLA', value: metrics.jobs_overdue ?? 0, detail: 'SLA breached', icon: AlertTriangle },
      ]
    } else if (trackerRole === 'registration') {
      jobMetrics = [
        { label: 'Stage 1: Registered', value: metrics.registration_queue_count ?? metrics.my_queue_count ?? 0, detail: 'Job intake queue', icon: ClipboardList },
        { label: 'Jobs Today', value: metrics.jobs_today ?? 0, detail: `${metrics.jobs_completed_today ?? 0} completed`, icon: Briefcase },
        { label: 'Stage 6: Dispatched', value: metrics.jobs_pending_dispatch ?? 0, detail: 'Report dispatch', icon: Truck },
        { label: 'Total Registrations', value: metrics.total_registration ?? 0, detail: 'All time', icon: FileText },
      ]
    } else if (trackerRole === 'lab') {
      jobMetrics = [
        { label: 'Stage 2 & 3: Lab Queue', value: metrics.lab_queue_count ?? metrics.my_queue_count ?? 0, detail: 'Field & lab testing', icon: Briefcase },
        { label: 'Active Jobs', value: metrics.jobs_active ?? 0, detail: 'Across all stages', icon: ClipboardList },
        { label: 'Pending Reports', value: metrics.pending_reports ?? 0, detail: 'Reports pending', icon: FileText },
        { label: 'Overdue SLA', value: metrics.jobs_overdue ?? 0, detail: 'Needs attention', icon: AlertTriangle },
      ]
    } else if (trackerRole === 'report_staff') {
      jobMetrics = [
        { label: 'Stage 4: Drafting Queue', value: metrics.report_staff_queue_count ?? metrics.my_queue_count ?? 0, detail: 'Reports to draft', icon: FileText },
        { label: 'Pending Review', value: metrics.jobs_pending_review ?? 0, detail: 'Sent for review', icon: Eye },
        { label: 'Total Reports', value: metrics.total_reports ?? 0, detail: 'All time', icon: ClipboardList },
        { label: 'Today Reports', value: metrics.today_reports ?? 0, detail: 'Completed today', icon: CheckCircle2 },
      ]
    } else if (trackerRole === 'technical') {
      jobMetrics = [
        { label: 'Stage 5: Review Queue', value: metrics.technical_queue_count ?? metrics.my_queue_count ?? 0, detail: 'Reports to review', icon: Eye },
        { label: 'Pending Approval', value: metrics.jobs_pending_approval ?? 0, detail: 'Awaiting approval', icon: ThumbsUp },
        { label: 'Active Jobs', value: metrics.jobs_active ?? 0, detail: 'Across all stages', icon: Briefcase },
        { label: 'Stuck > 2 Days', value: metrics.jobs_stuck ?? 0, detail: 'Needs escalation', icon: AlertTriangle },
      ]
    } else if (trackerRole === 'manager') {
      jobMetrics = [
        { label: 'Stage 7: Payment Pending', value: metrics.manager_queue_count ?? metrics.my_queue_count ?? 0, detail: 'Invoiced jobs', icon: IndianRupee },
        { label: 'Total Billed (₹)', value: metrics.total_amount ?? 0, detail: 'All time billed', icon: BarChart3 },
        { label: 'Today Revenue (₹)', value: metrics.today_balance_amount ?? 0, detail: 'Today total', icon: TrendingUp },
        { label: 'Overdue Payments', value: metrics.jobs_overdue ?? 0, detail: 'Payment followups', icon: AlertTriangle },
      ]
    } else {
      jobMetrics = [
        { label: 'My Queue', value: metrics.my_queue_count ?? 0, detail: 'Jobs assigned', icon: ClipboardList },
        { label: 'Active Jobs', value: metrics.jobs_active ?? 0, detail: 'Across system', icon: Briefcase },
      ]
    }

    return (
      <section className="metric-strip" style={{ gridTemplateColumns: `repeat(${Math.min(jobMetrics.length, 7)}, minmax(0, 1fr))` }}>
        {jobMetrics.map((m) => (
          <MetricCard key={m.label} label={m.label} value={m.value} detail={m.detail} icon={m.icon} />
        ))}
      </section>
    )
  }

  // ─── ANALYTICS (Admin/Manager) ────────────────────────────────────────
  const renderAnalytics = () => {
    if (!shouldShowWidget(trackerRole, 'analytics')) return null

    return (
      <DashboardAnalyticsWidget
        trends={trends}
        monthExpenses={monthExpenses}
        trackingSummary={trackingSummary}
        recentActivities={recentActivities}
        period={period}
        fromDate={fromDate}
        toDate={toDate}
        onPeriodChange={handlePeriodChange}
      />
    )
  }

  // ─── RENDER ───────────────────────────────────────────────────────────
  void renderMyQueue
  void renderMyTasks
  void renderRoleQueueCounts

  return (
    <div className="dash-page">
      {renderWelcome()}
      {renderJobMetrics()}
      {render8StagePipeline()}
      {renderMasterJobsControlTable()}
      {renderAttentionNeeded()}
      {renderFinancialSnapshot()}
      {renderAnalytics()}

      {/* Embedded RegistrationWizard Modal for direct Dashboard job management */}
      {showWizard && (
        <div className="modal-overlay" onClick={() => setShowWizard(false)}>
          <div className="modal-content modal-lg" onClick={(e) => e.stopPropagation()}>
            <RegistrationWizard
              editingId={editingReg?.id ?? null}
              initial={editingReg ? (editingReg as any) : {
                uid_no: '',
                received_date: new Date().toISOString().slice(0, 10),
                agency_name: '',
                reporting_address: '',
                mobile_no: '',
                name_of_work: '',
                total_payment: '',
                advance_payment: '',
                balance_dues: '',
                assign_to: 'self',
                remark: '',
                current_stage: '1. Registered',
                currently_with: '',
                priority: 'Medium',
                payment_status: 'Not Invoiced',
              }}
              onSaved={async () => {
                setShowWizard(false)
                setEditingReg(null)
                await refresh()
              }}
              onCancel={() => {
                setShowWizard(false)
                setEditingReg(null)
              }}
              onGenerateUid={async () => {
                const res = await api.registrations()
                return `NAMO-${new Date().getFullYear()}-${(res.data?.length ?? 0) + 1}`
              }}
              generatingUid={false}
            />
          </div>
        </div>
      )}
    </div>
  )
}
