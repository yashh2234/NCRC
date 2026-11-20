import { useCallback, useEffect, useState } from 'react'
import { Pencil, Printer, Trash2 } from 'lucide-react'
import { api } from '../lib/api'
import { ReportEditPage } from './ReportEditPage'
import { ReportCreatePage } from './ReportCreatePage'

import type { CubeReport } from '../lib/types'
import { Modal } from '../components/Modal'
import { Pagination } from '../components/Pagination'
import { DateRangeFilter } from '../components/DateRangeFilter'
import { formatDisplayDate } from '../lib/utils'

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
  const [reports, setReports] = useState<CubeReport[]>([])
  const [loading, setLoading] = useState(true)
  const [localError, setLocalError] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [totalRecords, setTotalRecords] = useState(0)
  const [removing, setRemoving] = useState<CubeReport | null>(null)
  const [removingBusy, setRemovingBusy] = useState(false)
  const [editingReportId, setEditingReportId] = useState<number | null>(null)
  const [showCreate, setShowCreate] = useState(false)
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

  useEffect(() => { void loadTypes() }, [loadTypes])
  useEffect(() => { void loadReports() }, [loadReports])

  // Old software: trash button -> "Remove Report / Do you really want to remove?"
  const confirmRemove = async () => {
    if (!removing) return
    setRemovingBusy(true)
    try {
      await api.deleteReport(activeType, removing.iReportId)
      setRemoving(null)
      await loadTypes()
      await loadReports()
    } catch {
      setLocalError('Failed to remove report')
    } finally {
      setRemovingBusy(false)
    }
  }

  const activeTypeInfo = types.find((t) => t.key === activeType)
  const isCube = activeType === 'cc_cube'

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

  if (editingReportId) {
    return <ReportEditPage type={activeType} reportId={editingReportId} onBack={() => { setEditingReportId(null); void loadReports() }} />
  }

  return (
    <div>
      <div style={{ minWidth: 0 }}>
        {/* Test type, search, status and dates in one box */}
        <section className="surface" style={{ marginBottom: 16, padding: 14 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <select
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
          </select>
          <input
            type="search"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search reports"
            aria-label="Search reports"
            style={{ flex: '1 1 200px', minWidth: 160, padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: '0.82rem' }}
          />
          <select
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
              return <option key={step} value={step}>{step}{count !== undefined ? ` (${count})` : ''}</option>
            })}
          </select>
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
          <div className="table-card">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>UID No</th>
                    <th>ULR No</th>
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
                    <th style={{ textAlign: 'center' }}>Action</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((report) => {
                    const color = STATUS_COLORS[report.status ?? ''] ?? '#64748b'
                    return (
                      <tr key={report.iReportId}>
                        <td style={{ whiteSpace: 'nowrap' }}>{showDate(report.create_date)}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <button type="button" onClick={() => setEditingReportId(report.iReportId)} title="Open report" style={{ background: 'none', border: 0, padding: 0, color: 'var(--color-primary, #2563eb)', fontWeight: 600, cursor: 'pointer', font: 'inherit' }}>
                            {report.uid_no}
                          </button>
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>{report.ulr_no || '-'}</td>
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
                        <td style={{ whiteSpace: 'nowrap', textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', gap: 4 }}>
                            <button className="icon-button" onClick={() => void handlePrint(report.iReportId)} type="button" title="Print report" aria-label={`Print report ${report.uid_no}`}><Printer size={16} /></button>
                            <button className="icon-button" onClick={() => setEditingReportId(report.iReportId)} type="button" title="Edit report" aria-label={`Edit report ${report.uid_no}`}><Pencil size={16} /></button>
                            <button className="icon-button" onClick={() => setRemoving(report)} type="button" title="Remove report" aria-label={`Remove report ${report.uid_no}`} style={{ color: '#dc2626' }}><Trash2 size={16} /></button>
                          </div>
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <span className="status-tag" style={{ background: `${color}1f`, color, border: `1px solid ${color}55` }}>{report.status || '-'}</span>
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

      {removing ? (
        <Modal title="Remove Report" size="sm" onClose={() => setRemoving(null)} onSave={() => void confirmRemove()} saveLabel="Remove" cancelLabel="Close" saving={removingBusy}>
          <p style={{ margin: 0 }}>Do you really want to remove the report for UID <strong>{removing.uid_no}</strong>? This deletes it and its test data.</p>
        </Modal>
      ) : null}
    </div>
  )
}