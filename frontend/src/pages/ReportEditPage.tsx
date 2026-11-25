import { useEffect, useState } from 'react'
import { ArrowLeft, CheckCircle2, FileText, Mail, Play, Printer, RotateCcw, Save, XCircle } from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { documentMailUrl, openMailWindow } from '../lib/mailTab'
import { canUserAccess } from '../lib/roleConfig'
import { formatDateForInput } from '../lib/utils'
import { UIDDocumentDrawer } from '../components/UIDDocumentDrawer'
import { Modal } from '../components/Modal'
import { LabHeaderFields } from '../components/LabHeaderFields'
import { CUBE_MATERIALS, cubeMaterialPatch, fullUlr } from '../lib/labFormats'
import { ExcelLabReportEditor, resolveExcelTemplateKey } from '../components/ExcelLabReportEditor'

interface DetailRow {
  set_count?: number
  load_1?: string
  load_2?: string
  load_3?: string
  comp_strength_1?: string
  comp_strength_2?: string
  comp_strength_3?: string
  avg_comp_strength?: string
  is_code_comp_strength?: string
  size_of_cube?: string
  age_of_specimen?: string
  location?: string
  date_of_casting?: string
  date_of_testing?: string
}

export function ReportEditPage({ type, reportId, onBack }: { type: string; reportId: number; onBack: () => void }) {
  const [report, setReport] = useState<any>(null)
  const [details, setDetails] = useState<DetailRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [showDrawer, setShowDrawer] = useState(false)
  const [labData, setLabData] = useState<Record<string, string>>({})
  const [templateKey, setTemplateKey] = useState('')
  const [confirmApprove, setConfirmApprove] = useState(false)
  const { user } = useAuth()
  const canApprove = canUserAccess(user, 'report_approve')
  const canMail = canUserAccess(user, 'mail')

  // State for core fields
  const [coreFields, setCoreFields] = useState<any>({})

  useEffect(() => {
    api.reportDetail(type, reportId)
      .then((data: any) => {
        setReport(data.report)
        setLabData((data.report as any).lab_data || {})
        setTemplateKey((data.report as any).lab_data?._template || resolveExcelTemplateKey(type, (data.report as any).material_details || ''))
        const detailsTestingDate = (data.details as any[])[0]?.date_of_testing
        const initialTestingDate = (data.report as any).sample_tested_date || detailsTestingDate
        setCoreFields({
          reference_no: (data.report as any).reference_no || '',
          work_order_no: (data.report as any).work_order_no || '',
          source_location: (data.report as any).source_location || '',
          customer_details: (data.report as any).customer_details || '',
          material_details: (data.report as any).material_details || '',
          environment_condition: (data.report as any).environment_condition || '',
          sampled_by: (data.report as any).sampled_by || '',
          sample_date: formatDateForInput((data.report as any).sample_date),
          sample_tested_date: formatDateForInput(initialTestingDate),
          dispatch_date: formatDateForInput((data.report as any).dispatch_date),
        })

        const rows: DetailRow[] = (data.details as any[]).length > 0
          ? (data.details as any[]).map((d: any) => ({ ...d }))
          : [{ set_count: 1 }]
        setDetails(rows)
      })
      .catch(() => setError('Failed to load report'))
      .finally(() => setLoading(false))
  }, [type, reportId])

  const updateCore = (field: string, value: string) => setCoreFields((p: any) => ({ ...p, [field]: value }))
  
  const updateDetail = (index: number, field: string, value: string) => {
    setDetails((prev) => prev.map((d, i) => (i === index ? { ...d, [field]: value } : d)))
  }

  const updateLabData = (field: string, value: string) => {
    setLabData((previous) => ({ ...previous, [field]: value }))
  }

  const handleSave = async (markComplete: boolean = false) => {
    setError('')
    setMessage('')
    try {
      await api.updateReport(type, reportId, { ...coreFields, lab_data: { ...labData, _template: templateKey } })
      
      const payload = {
        details,
        mark_complete: markComplete,
      }
      await api.saveObservations(type, reportId, payload as any)
      
      const wasApproved = report?.status === 'Complete'
      const now: any = await api.reportDetail(type, reportId)
      setReport(now.report)
      setMessage(wasApproved && now.report.status !== 'Complete' ? 'Report saved. It was changed after approval, so it needs approval again (it is now under Lab Reports).' : 'Report saved successfully')
      return true
    } catch {
      setError('Failed to save changes')
      return false
    }
  }

  const handleApprove = async () => {
    setConfirmApprove(false)
    try {
      // What is on the screen is what gets approved
      if (!(await handleSave(false))) return
      await api.approveReport(reportId)
      setMessage('Report approved. It can be printed and mailed, and is under Final Reports.')
      await refreshStatus()
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Approval failed')
    }
  }

  const handleCancel = async () => {
    if (!window.confirm('Are you sure you want to cancel this report?')) return
    try {
      await api.cancelReport(reportId, 'Cancelled from edit screen')
      setMessage('Report cancelled')
      setTimeout(onBack, 1000)
    } catch {
      setError('Cancellation failed')
    }
  }

  // Workflow steps (moved here from the Reports list, which now matches the old software)
  const refreshStatus = async () => {
    try {
      const data: any = await api.reportDetail(type, reportId)
      setReport(data.report)
    } catch { /* keep current */ }
  }

  const runStep = async (step: () => Promise<unknown>, done: string, failed: string) => {
    setError('')
    setMessage('')
    try {
      await step()
      setMessage(done)
      await refreshStatus()
    } catch {
      setError(failed)
    }
  }

  const handlePrint = async () => {
    try {
      await api.printLabReport(type, reportId)
    } catch {
      setError('Print failed')
    }
  }

  if (loading) return <div className="surface" style={{ padding: 40, textAlign: 'center' }}>Loading...</div>

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 24 }}>
      <div className="surface" style={{ padding: '28px 36px' }}>
      {error && <div className="error-banner">{error}</div>}
      {message && <div className="success-banner">{message}</div>}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <h2 style={{ background: '#ff6600', padding: '8px 24px', color: '#fff', fontSize: '1.25rem', opacity: 0.8, borderRadius: 4, margin: 0 }}>
            UID No.- {report?.uid_no}
          </h2>
          {report?.cancel_remark && (
            <span style={{ color: 'red', fontWeight: 600 }}>Cancel Remark: {report.cancel_remark}</span>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowDrawer(true)}
          className="btn"
          style={{ background: '#2563eb', color: '#fff', fontSize: '0.85rem', fontWeight: 600, padding: '8px 16px', borderRadius: 6 }}
        >
          📂 Document Repository & Version History
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', alignItems: 'center' }}>
          <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>ULR No.</span>
          <input type="text" className="input" value={fullUlr(report?.ulr_no, report?.create_date)} disabled style={{ background: '#f5f7f9' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', alignItems: 'center' }}>
          <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>Name & Address of Customer</span>
          <input type="text" className="input" value={coreFields.customer_details} onChange={(e) => updateCore('customer_details', e.target.value)} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', alignItems: 'center' }}>
          <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>Name Of Agency</span>
          <input type="text" className="input" value={report?.agency_name || ''} disabled style={{ background: '#f5f7f9' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', alignItems: 'center' }}>
          <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>Reference No.</span>
          <input type="text" className="input" value={coreFields.reference_no} onChange={(e) => updateCore('reference_no', e.target.value)} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', alignItems: 'center' }}>
          <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>Material Identification Details.</span>
          {templateKey === 'cc_cube' ? (
            <select className="input" value={coreFields.material_details} onChange={(e) => {
              updateCore('material_details', e.target.value)
              setLabData((prev) => ({ ...prev, ...cubeMaterialPatch(e.target.value, prev, details as Array<Record<string, unknown>>) }))
            }}>
              {/* Older reports keep the text they have */}
              {[...new Set([report?.material_details || '', coreFields.material_details, ...CUBE_MATERIALS])].filter((m) => m || !coreFields.material_details).map((m) => <option key={m} value={m}>{m || 'Select'}</option>)}
            </select>
          ) : (
            <input type="text" className="input" value={coreFields.material_details} onChange={(e) => updateCore('material_details', e.target.value)} />
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', alignItems: 'center' }}>
          <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>Name Of Work</span>
          <input type="text" className="input" value={coreFields.source_location} onChange={(e) => updateCore('source_location', e.target.value)} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', alignItems: 'center' }}>
          <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>Work Order No..</span>
          <input type="text" className="input" value={coreFields.work_order_no} onChange={(e) => updateCore('work_order_no', e.target.value)} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', alignItems: 'center' }}>
          <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>Date Of Sample Receipt</span>
          <input type="date" className="input" value={coreFields.sample_date} onChange={(e) => updateCore('sample_date', e.target.value)} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', alignItems: 'center' }}>
          <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>Date Of Sample Tested</span>
          <input
            type="date"
            className="input"
            value={coreFields.sample_tested_date || ''}
            onChange={(e) => {
              const val = e.target.value
              updateCore('sample_tested_date', val)
              if (details.length > 0) {
                updateDetail(0, 'date_of_testing', val)
              }
            }}
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', alignItems: 'center' }}>
          <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>Sampled By /Condition Of Sample</span>
          <input type="text" className="input" value={coreFields.sampled_by} onChange={(e) => updateCore('sampled_by', e.target.value)} />
        </div>
        <LabHeaderFields gap={0} formatKey={templateKey} labData={labData} details={details as Array<Record<string, unknown>>} updateLabData={updateLabData} environment={(
        <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', alignItems: 'center' }}>
          <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>Environment Condition.</span>
          <input type="text" className="input" value={coreFields.environment_condition} onChange={(e) => updateCore('environment_condition', e.target.value)} />
        </div>
        )} />
        <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', alignItems: 'center' }}>
          <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>Dispatch Date</span>
          <input type="date" className="input" value={coreFields.dispatch_date} onChange={(e) => updateCore('dispatch_date', e.target.value)} />
        </div>
      </div>

      </div>

      <div className="surface lab-results-card">
      <ExcelLabReportEditor
        reportType={type}
        material={coreFields.material_details}
        details={details}
        labData={labData}
        templateKey={templateKey}
        updateDetail={updateDetail}
        updateLabData={updateLabData}
      />

      </div>

      <div className="surface" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: '18px 36px', alignItems: 'center' }}>
        <button type="button" className="btn btn-outline" onClick={onBack}>
          <ArrowLeft size={15} /> Back
        </button>
        <div style={{ flex: '1 1 auto' }} />
        <button type="button" className="btn btn-outline" onClick={() => void handlePrint()}>
          <Printer size={15} /> {report?.status === 'Complete' ? 'Print' : 'Print draft'}
        </button>
        {canMail && report?.status === 'Complete' && (
          <button type="button" className="btn btn-outline" onClick={() => openMailWindow(documentMailUrl('report', reportId, false, type))}>
            <Mail size={15} /> Mail
          </button>
        )}
        {report?.status === 'Testing' && (
          <>
            <button type="button" className="btn btn-outline" onClick={() => void runStep(() => api.startTesting(reportId), 'Testing started', 'Start testing failed')}>
              <Play size={15} /> Start Testing
            </button>
            <button type="button" className="btn btn-violet" onClick={() => void runStep(() => api.generateReport(reportId), 'Report generated', 'Generate report failed')}>
              <FileText size={15} /> Generate Report
            </button>
          </>
        )}
        {report?.status === 'Cancel' && (
          <button type="button" className="btn btn-outline" onClick={() => void runStep(() => api.reapproveReport(reportId), 'Report reapproved', 'Reapprove failed')}>
            <RotateCcw size={15} /> Reapprove
          </button>
        )}
        {canApprove && report?.status !== 'Complete' && report?.status !== 'Cancel' && (
          <button type="button" className="btn btn-success" onClick={() => setConfirmApprove(true)}>
            <CheckCircle2 size={15} /> Approve Report
          </button>
        )}
        {report?.status !== 'Cancel' && (
          <button type="button" className="btn btn-warning" onClick={() => void handleCancel()}>
            <XCircle size={15} /> Cancel Report
          </button>
        )}
        <button type="button" className="btn btn-primary" onClick={() => void handleSave(false)}>
          <Save size={15} /> Save Changes
        </button>
      </div>

      {confirmApprove ? (
        <Modal title="Approve Report" size="sm" onClose={() => setConfirmApprove(false)} onSave={() => void handleApprove()} saveLabel="Approve" cancelLabel="Close">
          <p style={{ margin: 0 }}>Do you really want to approve the report for UID <strong>{report?.uid_no}</strong>?</p>
        </Modal>
      ) : null}

      <UIDDocumentDrawer
        uidNo={report?.uid_no || ''}
        isOpen={showDrawer}
        onClose={() => setShowDrawer(false)}
      />
    </div>
  )
}
