import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { FlaskConical, Play, FileText } from 'lucide-react'
import { api } from '../lib/api'
import { TestingScreen } from '../components/TestingScreen'
import { EXCEL_TEMPLATE_OPTIONS } from '../components/ExcelLabReportEditor'

interface AssignedReport {
  iReportId: number
  uid_no: string
  report_type: string
  create_date: string | null
  agency_name: string
  material_details: string | null
  status: string
}

const LABELS: Record<string, string> = {
  cc_cube: 'CC Cube',
  cc_core: 'Concrete Core',
  cc_beam: 'Concrete Beam',
  bitumen_core: 'Bitumen Core',
  bitumen_loose: 'Bitumen Loose',
  bricks: 'Bricks',
  ferro_cover: 'Ferro Cover',
  interlocking: 'Interlocking Tiles',
  mainhole_cover: 'Mainhole Cover',
  mes: 'MES',
  sand: 'Sand',
  water: 'Water',
}

export function LabPage() {
  const [reports, setReports] = useState<AssignedReport[]>([])
  const [loading, setLoading] = useState(true)
  const [localError, setLocalError] = useState('')
  const [message, setMessage] = useState('')
  const [testingReport, setTestingReport] = useState<AssignedReport | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createForm, setCreateForm] = useState({
    report_type: 'cc_cube',
    template: 'cc_cube',
    uid_no: '',
    ulr_no: '',
    customer_details: '',
    agency_name: '',
    reference_no: '',
    material_details: '',
    source_location: '',
    work_order_no: '',
    sample_date: '',
    sample_tested_date: '',
  })

  const loadAssigned = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.myAssigned()
      setReports(data.data as any)
    } catch {
      setLocalError('Unable to load assigned reports')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadAssigned() }, [loadAssigned])

  const handleGenerateReport = async (reportId: number) => {
    try {
      await api.generateReport(reportId)
      setMessage('Report generated')
      await loadAssigned()
    } catch {
      setLocalError('Generate report failed')
    }
  }

  const openTestingScreen = async (report: AssignedReport) => {
    await api.startTesting(report.iReportId).catch(() => {})
    setTestingReport(report)
  }

  const closeTestingScreen = () => {
    setTestingReport(null)
    void loadAssigned()
  }

  const updateCreate = (field: string, value: string) => setCreateForm((previous) => ({ ...previous, [field]: value }))

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault()
    setCreating(true)
    setLocalError('')
    try {
      const data = { ...createForm, lab_data: { _template: createForm.template } }
      if (createForm.report_type === 'cc_cube') {
        await api.createCubeReport(data)
      } else {
        await api.createLabReport(createForm.report_type, data)
      }
      setShowCreate(false)
      setMessage('Lab report created and placed in Pending status')
      await loadAssigned()
    } catch {
      setLocalError('Unable to create lab report')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="single-column">
      <section className="surface">
        <div className="surface-heading">
          <div>
            <p className="section-label">Laboratory</p>
            <h2>My assigned samples</h2>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <FlaskConical size={18} />
            <span className="sync-pill">{reports.length} assigned</span>
            <button type="button" className="btn btn-primary" onClick={() => setShowCreate(true)} style={{ whiteSpace: 'nowrap' }}>+ Add lab report</button>
          </div>
        </div>

        {localError ? <div className="error-banner">{localError}</div> : null}
        {message ? <div className="success-banner">{message}</div> : null}

        {loading ? (
          <p className="empty-state">Loading...</p>
        ) : reports.length === 0 ? (
          <p className="empty-state">No samples assigned to you.</p>
        ) : (
          <div className="report-stack">
            {reports.map((report) => (
              <article className="report-row" key={report.iReportId}>
                <div>
                  <strong>{report.uid_no}</strong>
                  <span>{report.agency_name}</span>
                  <small>
                    {LABELS[report.report_type] ?? report.report_type} | {report.material_details ?? 'N/A'} | {report.create_date ?? '-'}
                  </small>
                </div>
                <div className="row-actions">
                  <span className={`status-tag ${report.status?.toLowerCase().replaceAll(' ', '-')}`}>{report.status}</span>
                  {report.status === 'Testing' ? (
                    <>
                      <button className="icon-button" onClick={() => void openTestingScreen(report)} type="button" title="Enter testing">
                        <Play size={17} />
                      </button>
                      <button className="icon-button" onClick={() => void handleGenerateReport(report.iReportId)} type="button" title="Generate report">
                        <FileText size={17} />
                      </button>
                    </>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {showCreate ? (
        <div onClick={() => setShowCreate(false)} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <form className="surface" onClick={(event) => event.stopPropagation()} onSubmit={handleCreate} style={{ width: 680, maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="surface-heading">
              <div><p className="section-label">Laboratory</p><h2>Add lab report</h2></div>
              <button type="button" className="ghost-button" onClick={() => setShowCreate(false)}>Close</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label>Report type<select className="input" value={createForm.report_type} onChange={(event) => updateCreate('report_type', event.target.value)}>
                {Object.entries(LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select></label>
              <label>Excel format<select className="input" value={createForm.template} onChange={(event) => updateCreate('template', event.target.value)}>
                {EXCEL_TEMPLATE_OPTIONS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select></label>
              {([
                ['uid_no', 'UID No.'], ['ulr_no', 'ULR No.'], ['customer_details', 'Customer name & address'],
                ['agency_name', 'Agency name'], ['reference_no', 'Reference no.'], ['material_details', 'Material details'],
                ['source_location', 'Source / location'], ['work_order_no', 'Work order no.'], ['sample_date', 'Sample receipt date'],
                ['sample_tested_date', 'Sample tested date'],
              ] as const).map(([key, label]) => (
                <label key={key}>{label}<input className="input" required={['uid_no', 'customer_details', 'agency_name', 'material_details', 'sample_date', 'sample_tested_date'].includes(key)} type={key.includes('date') ? 'date' : 'text'} value={createForm[key]} onChange={(event) => updateCreate(key, event.target.value)} /></label>
              ))}
            </div>
            <button type="submit" className="btn btn-primary" disabled={creating}>{creating ? 'Creating...' : 'Create pending lab report'}</button>
          </form>
        </div>
      ) : null}

      {testingReport ? (
        <TestingScreen
          reportId={testingReport.iReportId}
          reportType={testingReport.report_type}
          uid_no={testingReport.uid_no}
          agencyName={testingReport.agency_name}
          onClose={closeTestingScreen}
          onComplete={closeTestingScreen}
        />
      ) : null}
    </div>
  )
}