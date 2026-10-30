import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Check, X, Play, FileText, UserCheck, History, RotateCcw, Pencil, Printer } from 'lucide-react'
import { api } from '../lib/api'
import { Timeline } from '../components/Timeline'
import { WorkflowStatusBadge } from '../components/WorkflowStatusBadge'
import { JobDetailPage } from './JobDetailPage'
import { ReportEditPage } from './ReportEditPage'
import { EXCEL_TEMPLATE_OPTIONS } from '../components/ExcelLabReportEditor'

import type { CubeReport } from '../lib/types'

interface ReportTypeInfo {
  key: string
  label: string
  total: number
  pending: number
  testing: number
  generated: number
  assigned_to_me: number
  is_template?: boolean
  template_key?: string
}

const STATUS_FLOW: Record<string, { label: string; color: string; next: string[] }> = {
  Pending: { label: 'Pending', color: '#e8a838', next: ['Testing'] },
  Testing: { label: 'Testing', color: '#3b82f6', next: ['Report Generated'] },
  'Report Generated': { label: 'Report Generated', color: '#8b5cf6', next: ['Complete'] },
  Complete: { label: 'Complete', color: '#22c55e', next: [] },
  Cancel: { label: 'Cancel', color: '#ef4444', next: [] },
}

export function ReportsPage({ defaultType }: { defaultType?: string }) {
  const [types, setTypes] = useState<ReportTypeInfo[]>([])
  const [activeType, setActiveType] = useState<string>(defaultType || '')
  const [reports, setReports] = useState<CubeReport[]>([])
  const [users, setUsers] = useState<Array<{ id: number; firstname: string; lastname: string }>>([])
  const [loading, setLoading] = useState(true)
  const [localError, setLocalError] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [totalRecords, setTotalRecords] = useState(0)
  const [assigning, setAssigning] = useState<number | null>(null)
  const [timelineReportId, setTimelineReportId] = useState<number | null>(null)
  const [timelineData, setTimelineData] = useState<Array<{ event: string; timestamp: string | null; icon: string; user?: string }>>([])
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null)
  const [editingReportId, setEditingReportId] = useState<number | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createForm, setCreateForm] = useState({
    report_type: 'cc_cube', template: 'cc_cube', uid_no: '', customer_details: '', agency_name: '',
    material_details: '', sample_date: '', sample_tested_date: '', ulr_no: '', reference_no: '',
  })

  const handlePrint = async (reportId: number) => {
    try {
      await api.downloadReportPdf(activeType, reportId)
    } catch {
      setLocalError('Failed to print report')
    }
  }

  const loadTypes = useCallback(async () => {
    try {
      const data = await api.reportTypes()
      setTypes(data.data)
      if (data.data.length > 0 && !activeType && !defaultType) {
        setActiveType(data.data[0].key)
      }
    } catch {
      setLocalError('Failed to load types')
    }
  }, [activeType, defaultType])

  useEffect(() => {
    if (defaultType && defaultType !== activeType) {
      setActiveType(defaultType)
    }
  }, [defaultType])

  const loadReports = useCallback(async () => {
    if (!activeType) return
    const selectedType = types.find((type) => type.key === activeType)
    if (selectedType?.is_template) {
      setReports([])
      setTotalRecords(0)
      setLastPage(1)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      if (startDate) params.set('start_date', startDate)
      if (endDate) params.set('end_date', endDate)
      if (search.trim()) params.set('search', search.trim())
      params.set('page', String(page))
      const data = await api.reports(`${activeType}?${params.toString()}` as any)
      setReports(data.data)
      setLastPage(data.last_page)
      setTotalRecords(data.count)
    } catch {
      setLocalError('Unable to load reports')
    } finally {
      setLoading(false)
    }
  }, [activeType, statusFilter, startDate, endDate, search, page, types])

  const loadUsers = useCallback(async () => {
    try {
      const data = await api.users()
      setUsers(data.data as any)
    } catch {}
  }, [])

  useEffect(() => { void loadTypes() }, [loadTypes])
  useEffect(() => { void loadReports() }, [loadReports])
  useEffect(() => { void loadUsers() }, [loadUsers])

  useEffect(() => {
    if (timelineReportId === null) return
    api.reportTimeline(timelineReportId).then((d) => setTimelineData(d.data)).catch(() => {})
  }, [timelineReportId])

  const handleApprove = async (reportId: number) => {
    try {
      await api.approveReport(reportId)
      await loadReports()
    } catch {
      setLocalError('Approval failed')
    }
  }

  const handleReapprove = async (reportId: number) => {
    try {
      await api.reapproveReport(reportId)
      await loadReports()
    } catch {
      setLocalError('Reapprove failed')
    }
  }

  const handleCancel = async (reportId: number) => {
    try {
      await api.cancelReport(reportId)
      await loadReports()
    } catch {
      setLocalError('Cancel failed')
    }
  }

  const handleStartTesting = async (reportId: number) => {
    try {
      await api.startTesting(reportId)
      await loadReports()
    } catch {
      setLocalError('Start testing failed')
    }
  }

  const handleGenerateReport = async (reportId: number) => {
    try {
      await api.generateReport(reportId)
      await loadReports()
    } catch {
      setLocalError('Generate report failed')
    }
  }

  const handleAssign = async (reportId: number, userId: number) => {
    try {
      await api.assignReport(reportId, userId)
      setAssigning(null)
      await loadReports()
    } catch {
      setLocalError('Assign failed')
    }
  }

  const activeTypeInfo = types.find((t) => t.key === activeType)

  const updateCreate = (field: string, value: string) => setCreateForm((previous) => ({ ...previous, [field]: value }))
  const handleCreate = async (event: FormEvent) => {
    event.preventDefault()
    setCreating(true)
    setLocalError('')
    try {
      const payload = { ...createForm, lab_data: { _template: createForm.template } }
      if (createForm.report_type === 'cc_cube') await api.createCubeReport(payload)
      else await api.createLabReport(createForm.report_type, payload)
      setShowCreate(false)
      await loadTypes()
      await loadReports()
    } catch {
      setLocalError('Unable to create lab report')
    } finally {
      setCreating(false)
    }
  }

  const statusSteps = ['Pending', 'Testing', 'Report Generated', 'Complete']

  const renderActions = (report: CubeReport) => {
    const flow = STATUS_FLOW[report.status ?? '']
    if (!flow) return null

    const actions: React.ReactNode[] = []

    if (report.status === 'Pending') {
      actions.push(
        <button
          key="assign"
          className="icon-button"
          onClick={() => setAssigning(assigning === report.iReportId ? null : report.iReportId)}
          type="button"
          title="Assign to lab tech"
        >
          <UserCheck size={17} />
        </button>,
      )
    }

    if (report.status === 'Testing') {
      actions.push(
        <button key="start" className="icon-button" onClick={() => void handleStartTesting(report.iReportId)} type="button" title="Start testing">
          <Play size={17} />
        </button>,
        <button key="gen" className="icon-button" onClick={() => void handleGenerateReport(report.iReportId)} type="button" title="Generate report">
          <FileText size={17} />
        </button>,
      )
    }

    if (report.status === 'Report Generated') {
      actions.push(
        <button key="appr" className="icon-button" onClick={() => void handleApprove(report.iReportId)} type="button" title="Approve">
          <Check size={17} />
        </button>,
      )
    }

    if (report.status === 'Cancel') {
      actions.push(
        <button key="reappr" className="icon-button" onClick={() => void handleReapprove(report.iReportId)} type="button" title="Reapprove">
          <RotateCcw size={17} />
        </button>,
      )
    }

    actions.push(
      <button key="timeline" className="icon-button" onClick={() => setTimelineReportId(report.iReportId)} type="button" title="View timeline">
        <History size={17} />
      </button>,
    )

    if (!['Complete', 'Cancel'].includes(report.status ?? '')) {
      actions.push(
        <button key="cancel" className="icon-button" onClick={() => void handleCancel(report.iReportId)} type="button" title="Cancel">
          <X size={17} />
        </button>,
      )
    }

    // Print and Edit are available for most reports
    actions.push(
      <button key="print" className="icon-button" onClick={() => void handlePrint(report.iReportId)} type="button" title="Print report">
        <Printer size={17} />
      </button>,
      <button key="edit" className="icon-button" onClick={() => setEditingReportId(report.iReportId)} type="button" title="Edit report">
        <Pencil size={17} />
      </button>,
    )

    return actions
  }

  if (selectedJobId) {
    return <JobDetailPage jobId={selectedJobId} onBack={() => setSelectedJobId(null)} />
  }

  if (editingReportId) {
    return <ReportEditPage type={activeType} reportId={editingReportId} onBack={() => { setEditingReportId(null); void loadReports() }} />
  }

  return (
    <div>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'nowrap', overflowX: 'auto', padding: '0 2px 12px' }}>
          <input
            type="search"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search reports"
            aria-label="Search reports"
            style={{ width: 220, flex: '0 0 220px', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: '0.82rem' }}
          />
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
            aria-label="Filter reports by status"
            style={{ width: 190, flex: '0 0 190px', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', fontSize: '0.82rem' }}
          >
            <option value="">All statuses</option>
            {statusSteps.map(step => {
              const count = step === 'Pending'
                ? activeTypeInfo?.pending
                : step === 'Testing'
                  ? activeTypeInfo?.testing
                  : step === 'Report Generated'
                    ? activeTypeInfo?.generated
                    : undefined
              return <option key={step} value={step}>{step}{count !== undefined ? ` (${count})` : ''}</option>
            })}
          </select>
          <span style={{ color: '#64748b', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>From</span>
          <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setPage(1) }} style={{ flex: '0 0 140px', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: '0.82rem' }} />
          <span style={{ color: '#64748b', fontSize: '0.82rem' }}>to</span>
          <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setPage(1) }} style={{ flex: '0 0 140px', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: '0.82rem' }} />
          {(startDate || endDate || statusFilter || search) && (
            <button type="button" onClick={() => { setStartDate(''); setEndDate(''); setStatusFilter(''); setSearch(''); setPage(1) }} style={{ flex: '0 0 auto', padding: '8px 10px', borderRadius: 6, border: '1px solid #d0d7de', background: 'transparent', fontSize: '0.82rem', cursor: 'pointer' }}>
              Clear
            </button>
          )}
        </div>

        <section className="surface" style={{ marginBottom: 16 }}>
          <div className="surface-heading">
            <div>
              <p className="section-label">Report types</p>
              <h2>All tests</h2>
            </div>
          </div>
          <select
            value={activeType}
            onChange={(event) => { setActiveType(event.target.value); setPage(1) }}
            aria-label="Select lab test"
            className="input"
            style={{ width: 280, maxWidth: '100%' }}
          >
            <option value="" disabled>Select a test</option>
            {types.map((type) => (
              <option key={type.key} value={type.key}>
                {type.label}
              </option>
            ))}
          </select>
        </section>

        <section className="surface" style={{ width: '100%', boxSizing: 'border-box' }}>
          <div className="surface-heading">
            <div>
              <p className="section-label">{activeTypeInfo?.label ?? 'Reports'}</p>
              <h2>Report queue <span className="sync-pill" style={{ marginLeft: 8, verticalAlign: 'middle' }}>{activeTypeInfo?.total ?? 0} total tests</span></h2>
            </div>
            <button type="button" className="btn btn-primary" onClick={() => setShowCreate(true)} style={{ whiteSpace: 'nowrap' }}>+ Add lab report</button>
          </div>

          {localError ? <div className="error-banner">{localError}</div> : null}

        {activeTypeInfo?.is_template ? (
          <div className="empty-state">
            <p><strong>{activeTypeInfo.label}</strong> is available as an Excel lab-report format.</p>
            <p>Choose this format inside a report’s Lab testing screen. Existing reports are listed under their report type.</p>
          </div>
        ) : loading ? (
          <p className="empty-state">Loading reports...</p>
        ) : reports.length === 0 ? (
          <p className="empty-state">No {activeTypeInfo?.label?.toLowerCase() ?? ''} reports found.</p>
        ) : (
          <div className="report-stack">
            {reports.map((report) => {
              const statusInfo = STATUS_FLOW[report.status ?? ''] ?? { label: report.status ?? 'Unknown', color: '#999' }
              return (
                <article className="report-row" key={report.iReportId}>
                  <div>
                    <strong>{report.uid_no}</strong>
                    <WorkflowStatusBadge uidNo={report.uid_no} compact />
                    <span>{report.agency_name}</span>
                    <small>{(report as any).job_id ? <span className="link" onClick={() => setSelectedJobId((report as any).job_id)} style={{ cursor: 'pointer', textDecoration: 'underline' }}>Job #{ (report as any).job_id}</span> : ''}{report.material_details ? ` | ${report.material_details}` : ''}{report.create_date ? ` | ${report.create_date}` : ''}</small>
                  </div>
                  <div className="row-actions">
                    <span
                      className="status-tag"
                      style={{
                        background: `${statusInfo.color}20`,
                        color: statusInfo.color,
                        border: `1px solid ${statusInfo.color}40`,
                      }}
                    >
                      {statusInfo.label}
                    </span>
                    {renderActions(report)}
                  </div>
                  {assigning === report.iReportId ? (
                    <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 6, flexWrap: 'wrap', padding: '8px 0', borderTop: '1px solid #e5eaed' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, alignSelf: 'center' }}>Assign to:</span>
                      {users.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => void handleAssign(report.iReportId, u.id)}
                          style={{ padding: '4px 10px', borderRadius: 16, border: '1px solid #d0d7de', background: 'transparent', fontSize: '0.78rem', cursor: 'pointer' }}
                        >
                          {u.firstname} {u.lastname}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </article>
              )
            })}
          </div>
        )}

        {!loading && totalRecords > 0 ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 18 }}>
            <button
              type="button"
              className="ghost-button"
              disabled={page === 1}
              onClick={() => setPage(current => Math.max(1, current - 1))}
            >
              Previous
            </button>
            <span style={{ fontSize: '0.82rem', color: '#64748b' }}>
              Showing {totalRecords === 0 ? 0 : ((page - 1) * 50) + 1}-{Math.min(page * 50, totalRecords)} of {totalRecords} records
            </span>
            <button
              type="button"
              className="primary-button"
              disabled={page >= lastPage}
              onClick={() => setPage(current => Math.min(lastPage, current + 1))}
            >
              Next
            </button>
          </div>
        ) : null}
        </section>
      </div>
      {showCreate ? (
        <div onClick={() => setShowCreate(false)} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <form className="surface" onClick={(event) => event.stopPropagation()} onSubmit={handleCreate} style={{ width: 680, maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="surface-heading">
              <div><p className="section-label">Laboratory</p><h2>Add lab report</h2></div>
              <button type="button" className="ghost-button" onClick={() => setShowCreate(false)}>Close</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label>Report type<select className="input" value={createForm.report_type} onChange={(event) => updateCreate('report_type', event.target.value)}>
                {types.filter((type) => !type.is_template).map((type) => <option key={type.key} value={type.key}>{type.label}</option>)}
              </select></label>
              <label>Report format<select className="input" value={createForm.template} onChange={(event) => updateCreate('template', event.target.value)}>
                {EXCEL_TEMPLATE_OPTIONS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select></label>
              {([
                ['uid_no', 'UID No.'], ['ulr_no', 'ULR No.'], ['customer_details', 'Customer name & address'],
                ['agency_name', 'Agency name'], ['reference_no', 'Reference no.'], ['material_details', 'Material details'],
                ['sample_date', 'Sample receipt date'], ['sample_tested_date', 'Sample tested date'],
              ] as const).map(([key, label]) => (
                <label key={key}>{label}<input className="input" required={['uid_no', 'customer_details', 'agency_name', 'material_details', 'sample_date', 'sample_tested_date'].includes(key)} type={key.includes('date') ? 'date' : 'text'} value={createForm[key]} onChange={(event) => updateCreate(key, event.target.value)} /></label>
              ))}
            </div>
            <button type="submit" className="btn btn-primary" disabled={creating}>{creating ? 'Creating...' : 'Create pending lab report'}</button>
          </form>
        </div>
      ) : null}

      {timelineReportId !== null ? (
        <Timeline entries={timelineData} onClose={() => { setTimelineReportId(null); setTimelineData([]) }} />
      ) : null}
    </div>
  )
}