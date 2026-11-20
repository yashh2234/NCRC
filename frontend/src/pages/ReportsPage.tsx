import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Pencil, Printer, Trash2 } from 'lucide-react'
import { api } from '../lib/api'
import { ReportEditPage } from './ReportEditPage'
import { EXCEL_TEMPLATE_OPTIONS } from '../components/ExcelLabReportEditor'

import type { CubeReport } from '../lib/types'
import { Req } from '../components/ui'
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

/** Fields the create-lab-report form will not submit without. */
const CREATE_REQUIRED: string[] = ['uid_no', 'customer_details', 'agency_name', 'material_details', 'sample_date', 'sample_tested_date']

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
  const [creating, setCreating] = useState(false)
  const [createForm, setCreateForm] = useState({
    report_type: 'cc_cube', template: 'cc_cube', uid_no: '', customer_details: '', agency_name: '',
    material_details: '', sample_date: '', sample_tested_date: '', ulr_no: '', reference_no: '',
    source_location: '', work_order_no: '',
  })
  const [uidSuggestions, setUidSuggestions] = useState<Array<{ uid_no: string; agency_name: string; name_of_work: string }>>([])
  const [linkedUlrs, setLinkedUlrs] = useState<string[]>([])
  const pickedUidRef = useRef('')
  const filledUidRef = useRef('')

  // Add lab report: UID suggestions while typing (same search as Add ULR).
  useEffect(() => {
    const q = createForm.uid_no.trim()
    if (!showCreate || q.length < 2 || createForm.uid_no === pickedUidRef.current) {
      setUidSuggestions([])
      return
    }
    const timer = window.setTimeout(async () => {
      try {
        const res = await api.searchRegistrationUids(q)
        setUidSuggestions(res.data)
      } catch {
        setUidSuggestions([])
      }
    }, 250)
    return () => window.clearTimeout(timer)
  }, [showCreate, createForm.uid_no])

  /**
   * Same as the old cubereport getClientDetails: fill Customer (reporting address), Agency,
   * Name of work and Work order no. from the registration. ULR is never filled; the UID's
   * linked ULRs are only offered as suggestions.
   */
  const fillFromUid = async (rawUid: string) => {
    const uid = rawUid.trim()
    if (!uid || uid === filledUidRef.current) return
    filledUidRef.current = uid
    try {
      const [details, links] = await Promise.all([
        api.ulrClientDetails(uid),
        api.ulrLinksFiltered({ uid_no: uid }).catch(() => ({ data: [] })),
      ])
      if (filledUidRef.current !== uid) return
      const reg = details.data
      if (reg) {
        setCreateForm((previous) => ({
          ...previous,
          customer_details: reg.reporting_address || '',
          agency_name: reg.agency_name || '',
          source_location: reg.name_of_work || '',
          work_order_no: reg.work_order_no || '',
        }))
      }
      const same = links.data.filter((l) => l.uid_no.trim().toLowerCase() === uid.toLowerCase()).map((l) => l.ulr_no)
      setLinkedUlrs([...new Set(same)])
    } catch {
      // leave the fields for manual entry
    }
  }

  const pickUid = (uid: string) => {
    pickedUidRef.current = uid
    updateCreate('uid_no', uid)
    setUidSuggestions([])
    void fillFromUid(uid)
  }

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
      {showCreate ? (
        <Modal title="Add lab report" subtitle="Laboratory" onClose={() => setShowCreate(false)} size={680} onSubmit={handleCreate} saving={creating} saveLabel="Create pending lab report">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label>Report type<select className="input" value={createForm.report_type} onChange={(event) => updateCreate('report_type', event.target.value)}>
                {types.filter((type) => !type.is_template).map((type) => <option key={type.key} value={type.key}>{type.label}</option>)}
              </select></label>
              <label>Report format<select className="input" value={createForm.template} onChange={(event) => updateCreate('template', event.target.value)}>
                {EXCEL_TEMPLATE_OPTIONS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select></label>
              {/* UID: search registrations; picking one fills the details like the old software */}
              <label style={{ position: 'relative' }}>
                <span>UID No.<Req /></span>
                <input
                  className="input"
                  required
                  autoComplete="off"
                  placeholder="Type to search UID"
                  value={createForm.uid_no}
                  onChange={(event) => updateCreate('uid_no', event.target.value)}
                  onBlur={() => { setUidSuggestions([]); void fillFromUid(createForm.uid_no) }}
                />
                {uidSuggestions.length > 0 && (
                  <div style={{ position: 'absolute', zIndex: 20, top: '100%', left: 0, right: 0, marginTop: 4, maxHeight: 240, overflowY: 'auto', background: '#fff', border: '1px solid #cbd5e1', borderRadius: 6, boxShadow: '0 8px 20px rgba(15,23,42,0.18)' }}>
                    {uidSuggestions.map((s) => (
                      <button
                        key={s.uid_no}
                        type="button"
                        // mousedown + preventDefault: picks on the first click, before the input blurs
                        onMouseDown={(event) => { event.preventDefault(); pickUid(s.uid_no) }}
                        style={{ display: 'block', width: '100%', padding: '8px 10px', border: 0, borderBottom: '1px solid #f1f5f9', background: '#fff', textAlign: 'left', cursor: 'pointer', color: '#1e293b' }}
                      >
                        <strong>{s.uid_no}</strong>
                        <span style={{ display: 'block', marginTop: 2, fontSize: '0.75rem', color: '#64748b' }}>{s.agency_name || s.name_of_work || 'Registration'}</span>
                      </button>
                    ))}
                  </div>
                )}
              </label>
              {/* ULR stays manual: the UID's linked ULRs (Manage ULR) are only offered as suggestions */}
              <label>
                <span>ULR No.{createForm.report_type === 'cc_cube' ? <Req /> : null}</span>
                <input
                  className="input"
                  list="create-report-ulrs"
                  autoComplete="off"
                  required={createForm.report_type === 'cc_cube'}
                  placeholder={linkedUlrs.length ? 'Pick a linked ULR or type' : 'Enter ULR No.'}
                  value={createForm.ulr_no}
                  onChange={(event) => updateCreate('ulr_no', event.target.value)}
                />
                <datalist id="create-report-ulrs">
                  {linkedUlrs.map((ulr) => <option key={ulr} value={ulr} />)}
                </datalist>
              </label>
              {([
                ['customer_details', 'Customer name & address'], ['agency_name', 'Agency name'],
                ['source_location', 'Name of work'], ['work_order_no', 'Work order no.'],
                ['reference_no', 'Reference no.'], ['material_details', 'Material details'],
                ['sample_date', 'Sample receipt date'], ['sample_tested_date', 'Sample tested date'],
              ] as const).map(([key, label]) => (
                <label key={key}><span>{label}{CREATE_REQUIRED.includes(key) ? <Req /> : null}</span><input className="input" required={CREATE_REQUIRED.includes(key)} type={key.includes('date') ? 'date' : 'text'} value={createForm[key]} onChange={(event) => updateCreate(key, event.target.value)} /></label>
              ))}
            </div>
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