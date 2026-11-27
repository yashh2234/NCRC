import { fullUlr } from '../lib/labFormats'
import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Mail, Pencil, Printer, Trash2 } from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { documentMailUrl, openMailWindow } from '../lib/mailTab'
import { canUserAccess } from '../lib/roleConfig'
import { ReportEditPage } from './ReportEditPage'
import { ReportCreatePage } from './ReportCreatePage'

import type { CubeReport } from '../lib/types'
import { Modal } from '../components/Modal'
import { Pagination } from '../components/Pagination'
import { DateRangeFilter } from '../components/DateRangeFilter'
import { formatDisplayDate } from '../lib/utils'
import { Select } from '../components/Select'
import { HistoryButton } from '../components/History'

interface ReportTypeInfo {
  key: string
  label: string
  total: number
  pending: number
  testing: number
  generated: number
  assigned_to_me: number
  is_template?: boolean
  is_all?: boolean
  template_key?: string
}

/** List rows also say which report type they are (needed when "All tests" or a format is selected) */
type ReportRow = CubeReport & { report_type?: string; type_label?: string; format_label?: string | null }

/** Status labels coloured like the old software (Pending orange, Complete green, Cancel red). */
const STATUS_COLORS: Record<string, string> = {
  Pending: '#f39c12',
  Testing: '#3b82f6',
  'Report Generated': '#8b5cf6',
  Complete: '#00a65a',
  Cancel: '#dd4b39',
}

/** dd-mm-yyyy, numbers only. */
const showDate = (value: string | null | undefined) => (value ? formatDisplayDate(value).replace(/\//g, '-') : '-')

export function ReportsPage({ defaultType }: { defaultType?: string }) {
  const [types, setTypes] = useState<ReportTypeInfo[]>([])
  const [activeType, setActiveType] = useState<string>(defaultType || '')
  const [reports, setReports] = useState<ReportRow[]>([])
  const [loading, setLoading] = useState(true)
  const [localError, setLocalError] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [totalRecords, setTotalRecords] = useState(0)
  const [removing, setRemoving] = useState<ReportRow | null>(null)
  const { user } = useAuth()
  const canMail = canUserAccess(user, 'mail')
  const canApprove = canUserAccess(user, 'report_approve')
  const [approving, setApproving] = useState<ReportRow | null>(null)
  const [approvingBusy, setApprovingBusy] = useState(false)
  const [removingBusy, setRemovingBusy] = useState(false)
  const [editing, setEditing] = useState<{ id: number; type: string } | null>(null)
  // "All tests" and format selections mix types, so each row acts with its own report type
  const rowType = (report: ReportRow) => report.report_type || activeType
  const openReport = (report: ReportRow) => setEditing({ id: report.iReportId, type: rowType(report) })
  const [showCreate, setShowCreate] = useState(false)
  const handlePrint = async (report: ReportRow) => {
    try {
      await api.printLabReport(rowType(report), report.iReportId)
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
  }, [activeType, statusFilter, startDate, endDate, search, page])

  useEffect(() => { void loadTypes() }, [loadTypes])
  useEffect(() => { void loadReports() }, [loadReports])

  // Old software: trash button -> "Remove Report / Do you really want to remove?"
  const confirmRemove = async () => {
    if (!removing) return
    setRemovingBusy(true)
    try {
      await api.deleteReport(rowType(removing), removing.iReportId)
      setRemoving(null)
      await loadTypes()
      await loadReports()
    } catch {
      setLocalError('Failed to remove report')
    } finally {
      setRemovingBusy(false)
    }
  }

  const confirmApprove = async () => {
    if (!approving) return
    setApprovingBusy(true)
    try {
      await api.approveReport(approving.iReportId)
      setApproving(null)
      setLocalError('')
      await loadTypes()
      await loadReports()
    } catch (e) {
      setApproving(null)
      setLocalError(e instanceof Error && e.message ? e.message : 'Could not approve the report')
    } finally {
      setApprovingBusy(false)
    }
  }

  const activeTypeInfo = types.find((t) => t.key === activeType)
  const isCube = activeType === 'cc_cube'
  const mixed = activeType === 'all' || activeType.startsWith('template:')

  const statusSteps = ['Pending', 'Testing', 'Report Generated', 'Complete']

  if (showCreate) {
    return (
      <ReportCreatePage
        types={types}
        defaultType={activeType}
        onBack={() => setShowCreate(false)}
        onCreated={() => { setShowCreate(false); void loadTypes(); void loadReports() }}
      />
    )
  }

  if (editing) {
    return <ReportEditPage type={editing.type} reportId={editing.id} onBack={() => { setEditing(null); void loadReports() }} />
  }

  return (
    <div>
      <div style={{ minWidth: 0 }}>
        {/* Test type, search, status and dates in one box */}
        <section className="surface" style={{ marginBottom: 16, padding: 14 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <Select
            value={activeType}
            onChange={(event) => { setActiveType(event.target.value); setPage(1) }}
            aria-label="Select lab test"
            style={{ flex: '0 1 220px', minWidth: 170, padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', fontSize: '0.82rem' }}
          >
            <option value="" disabled>Select a test</option>
            {types.map((type) => (
              <option key={type.key} value={type.key}>
                {type.label}
              </option>
            ))}
          </Select>
          <input
            type="search"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search reports"
            aria-label="Search reports"
            style={{ flex: '1 1 200px', minWidth: 160, padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: '0.82rem' }}
          />
          <Select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
            aria-label="Filter reports by status"
            style={{ flex: '0 1 190px', minWidth: 150, padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', fontSize: '0.82rem' }}
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
              return <option key={step} value={step}>{step === 'Complete' ? 'Approved' : step}{count !== undefined ? ` (${count})` : ''}</option>
            })}
          </Select>
          <DateRangeFilter start={startDate} end={endDate} onApply={(start, end) => { setStartDate(start); setEndDate(end); setPage(1) }} />
          {(statusFilter || search) && (
            <button type="button" onClick={() => { setStartDate(''); setEndDate(''); setStatusFilter(''); setSearch(''); setPage(1) }} style={{ flex: '0 0 auto', padding: '8px 10px', borderRadius: 6, border: '1px solid #d0d7de', background: 'transparent', fontSize: '0.82rem', cursor: 'pointer' }}>
              Clear
            </button>
          )}
          </div>
        </section>

        <section className="surface" style={{ width: '100%', boxSizing: 'border-box' }}>
          <div className="surface-heading">
            <div>
              <p className="section-label">{activeTypeInfo?.label ?? 'Reports'}</p>
              <h2>All Reports</h2>
            </div>
            <button type="button" className="btn btn-primary" onClick={() => setShowCreate(true)} style={{ whiteSpace: 'nowrap' }}>+ Add lab report</button>
          </div>

          {localError ? <div className="error-banner">{localError}</div> : null}

        {loading ? (
          <p className="empty-state">Loading reports...</p>
        ) : reports.length === 0 ? (
          <p className="empty-state">No {activeTypeInfo?.is_all ? '' : `${activeTypeInfo?.label?.toLowerCase() ?? ''} `}reports found.</p>
        ) : (
          <div className="table-card">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>UID No</th>
                    <th>ULR No</th>
                    {mixed ? <th>Test</th> : null}
                    <th>Name &amp; Address</th>
                    <th>Agency Name</th>
                    {isCube ? <th>Date of casting</th> : null}
                    {isCube ? <th>Date of testing</th> : null}
                    <th>Reference No.</th>
                    <th>Material Details</th>
                    <th>Location</th>
                    <th>Work order No.</th>
                    <th>Sample Date</th>
                    <th>Sample Tested Date</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((report) => {
                    const color = STATUS_COLORS[report.status ?? ''] ?? '#64748b'
                    return (
                      <tr key={report.iReportId}>
                        <td style={{ whiteSpace: 'nowrap' }}>{showDate(report.create_date)}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <button type="button" onClick={() => openReport(report)} title="Open report" style={{ background: 'none', border: 0, padding: 0, color: 'var(--color-primary, #2563eb)', fontWeight: 600, cursor: 'pointer', font: 'inherit' }}>
                            {report.uid_no}
                          </button>
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>{fullUlr(report.ulr_no, report.create_date) || '-'}</td>
                        {mixed ? <td style={{ whiteSpace: 'nowrap' }}>{report.format_label || report.type_label || '-'}</td> : null}
                        <td style={{ minWidth: 180 }}>{report.customer_details || '-'}</td>
                        <td style={{ minWidth: 140 }}>{report.agency_name || '-'}</td>
                        {isCube ? <td style={{ whiteSpace: 'nowrap' }}>{showDate(report.date_of_casting)}</td> : null}
                        {isCube ? <td style={{ whiteSpace: 'nowrap' }}>{showDate(report.date_of_testing)}</td> : null}
                        <td>{report.reference_no || '-'}</td>
                        <td>{report.material_details || '-'}</td>
                        <td style={{ minWidth: 180 }}>{report.source_location || '-'}</td>
                        <td>{report.work_order_no || '-'}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>{showDate(report.sample_date)}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>{showDate(report.sample_tested_date)}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <span className="status-tag" style={{ background: `${color}1f`, color, border: `1px solid ${color}55` }}>{report.status === 'Complete' ? 'Approved' : report.status || '-'}</span>
                        </td>
                        <td style={{ whiteSpace: 'nowrap', textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', gap: 6 }}>
                            {canApprove && report.status !== 'Complete' && report.status !== 'Cancel' ? <button className="icon-button" onClick={() => setApproving(report)} type="button" title="Approve report" aria-label={`Approve report ${report.uid_no}`}><CheckCircle2 size={16} /></button> : null}
                            <button className="icon-button" onClick={() => void handlePrint(report)} type="button" title={report.status === 'Complete' ? 'Print report' : 'Print draft (not approved yet)'} aria-label={`Print report ${report.uid_no}`}><Printer size={16} /></button>
                            {canMail && report.status === 'Complete' ? <button className="icon-button" onClick={() => openMailWindow(documentMailUrl('report', report.iReportId, false, rowType(report)))} type="button" title="Mail the PDF" aria-label={`Mail report ${report.uid_no}`}><Mail size={16} /></button> : null}
                            <HistoryButton type="Report" id={report.iReportId} title={`Lab report ${report.uid_no ?? ''}`} />
                            <button className="icon-button" onClick={() => openReport(report)} type="button" title="Edit report" aria-label={`Edit report ${report.uid_no}`}><Pencil size={16} /></button>
                            <button className="icon-button" onClick={() => setRemoving(report)} type="button" title="Remove report" aria-label={`Remove report ${report.uid_no}`}><Trash2 size={16} /></button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loading && totalRecords > 0 ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginTop: 18 }}>
            <span style={{ fontSize: '0.82rem', color: '#64748b' }}>
              Showing {totalRecords === 0 ? 0 : ((page - 1) * 50) + 1}-{Math.min(page * 50, totalRecords)} of {totalRecords} records
            </span>
            <Pagination page={page} lastPage={lastPage} onChange={setPage} />
          </div>
        ) : null}
        </section>
      </div>

      {approving ? (
        <Modal title="Approve Report" size="sm" onClose={() => setApproving(null)} onSave={() => void confirmApprove()} saveLabel="Approve" cancelLabel="Close" saving={approvingBusy}>
          <p style={{ margin: 0 }}>Approve the report for UID <strong>{approving.uid_no}</strong>? It then moves to Final Reports and prints without DRAFT, with its QR code.</p>
        </Modal>
      ) : null}

      {removing ? (
        <Modal title="Remove Report" size="sm" onClose={() => setRemoving(null)} onSave={() => void confirmRemove()} saveLabel="Remove" cancelLabel="Close" saving={removingBusy}>
          <p style={{ margin: 0 }}>Do you really want to remove the report for UID <strong>{removing.uid_no}</strong>? This deletes it and its test data.</p>
        </Modal>
      ) : null}
    </div>
  )
}