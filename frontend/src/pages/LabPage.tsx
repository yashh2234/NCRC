import { useCallback, useEffect, useState } from 'react'
import { FlaskConical, Play, FileText } from 'lucide-react'
import { api } from '../lib/api'
import { TestingScreen } from '../components/TestingScreen'

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