import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { formatDateForInput } from '../lib/utils'
import { CubeTable } from '../components/TestResultTables/CubeTable'
import { CoreTable } from '../components/TestResultTables/CoreTable'
import { BeamTable } from '../components/TestResultTables/BeamTable'
import { BitumenCoreTable } from '../components/TestResultTables/BitumenCoreTable'
import { BitumenLooseTable } from '../components/TestResultTables/BitumenLooseTable'
import { BricksTable } from '../components/TestResultTables/BricksTable'
import { FerroCoverTable } from '../components/TestResultTables/FerroCoverTable'
import { InterlockingTilesTable } from '../components/TestResultTables/InterlockingTilesTable'
import { MainholeCoverTable } from '../components/TestResultTables/MainholeCoverTable'
import { MesTable } from '../components/TestResultTables/MesTable'
import { SandTable } from '../components/TestResultTables/SandTable'
import { WaterTable } from '../components/TestResultTables/WaterTable'
import { GenericTable } from '../components/TestResultTables/GenericTable'
import { UIDDocumentDrawer } from '../components/UIDDocumentDrawer'

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

  // State for core fields
  const [coreFields, setCoreFields] = useState<any>({})

  useEffect(() => {
    api.reportDetail(type, reportId)
      .then((data: any) => {
        setReport(data.report)
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

  const handleSave = async (markComplete: boolean = false) => {
    setError('')
    setMessage('')
    try {
      await api.updateReport(type, reportId, coreFields)
      
      const payload = {
        details,
        mark_complete: markComplete,
      }
      await api.saveObservations(type, reportId, payload as any)
      
      setMessage('Report saved successfully')
    } catch {
      setError('Failed to save changes')
    }
  }

  const handleApprove = async () => {
    try {
      await api.approveReport(reportId)
      setMessage('Report approved successfully')
      setTimeout(onBack, 1000)
    } catch {
      setError('Approval failed')
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

  const handlePrint = async () => {
    try {
      await api.downloadReportPdf(type, reportId)
    } catch {
      setError('Print failed')
    }
  }

  if (loading) return <div className="surface" style={{ padding: 40, textAlign: 'center' }}>Loading...</div>

  return (
    <div className="surface" style={{ padding: 24 }}>
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, marginBottom: 32 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', alignItems: 'center' }}>
          <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>ULR No.</span>
          <input type="text" className="input" value={report?.ulr_no || ''} disabled style={{ background: '#f5f7f9' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', alignItems: 'center' }}>
          <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>Name & Address of Costumer</span>
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
          <input type="text" className="input" value={coreFields.material_details} onChange={(e) => updateCore('material_details', e.target.value)} />
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
        <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', alignItems: 'center' }}>
          <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>Environment Condition.</span>
          <input type="text" className="input" value={coreFields.environment_condition} onChange={(e) => updateCore('environment_condition', e.target.value)} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', alignItems: 'center' }}>
          <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>Dispatch Date</span>
          <input type="date" className="input" value={coreFields.dispatch_date} onChange={(e) => updateCore('dispatch_date', e.target.value)} />
        </div>
      </div>

      {type === 'cc_cube' ? (
        <CubeTable details={details} updateDetail={updateDetail} />
      ) : type === 'cc_core' ? (
        <CoreTable details={details} updateDetail={updateDetail} />
      ) : type === 'cc_beam' ? (
        <BeamTable details={details} updateDetail={updateDetail} />
      ) : type === 'bitumen_core' ? (
        <BitumenCoreTable details={details} updateDetail={updateDetail} />
      ) : type === 'bitumen_loose' ? (
        <BitumenLooseTable details={details} updateDetail={updateDetail} />
      ) : type === 'bricks' ? (
        <BricksTable details={details} updateDetail={updateDetail} />
      ) : type === 'ferro_cover' ? (
        <FerroCoverTable details={details} updateDetail={updateDetail} />
      ) : type === 'interlocking' ? (
        <InterlockingTilesTable details={details} updateDetail={updateDetail} />
      ) : type === 'mainhole_cover' ? (
        <MainholeCoverTable details={details} updateDetail={updateDetail} />
      ) : type === 'mes' ? (
        <MesTable details={details} updateDetail={updateDetail} />
      ) : type === 'sand' ? (
        <SandTable details={details} updateDetail={updateDetail} />
      ) : type === 'water' ? (
        <WaterTable details={details} updateDetail={updateDetail} />
      ) : (
        <GenericTable type={type} details={details} />
      )}

      <div style={{ display: 'flex', gap: 12, marginTop: 24, padding: '16px 0', borderTop: '1px solid #dfe6ea', alignItems: 'center' }}>
        <button type="button" onClick={() => void handlePrint()} style={{ padding: '8px 16px', background: '#fff', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', fontSize: '0.9rem' }}>
          Print
        </button>
        {report?.status === 'Report Generated' && (
          <button type="button" onClick={() => void handleApprove()} style={{ padding: '8px 16px', background: '#00a65a', color: '#fff', border: '1px solid #008d4c', borderRadius: 4, cursor: 'pointer', fontSize: '0.9rem' }}>
            Approved Report
          </button>
        )}
        {report?.status !== 'Cancel' && (
          <button type="button" onClick={() => void handleCancel()} style={{ padding: '8px 16px', background: '#f39c12', color: '#fff', border: '1px solid #e08e0b', borderRadius: 4, cursor: 'pointer', fontSize: '0.9rem' }}>
            Cancel Report
          </button>
        )}
        <button type="button" onClick={() => void handleSave(false)} style={{ padding: '8px 16px', background: '#3c8dbc', color: '#fff', border: '1px solid #367fa9', borderRadius: 4, cursor: 'pointer', fontSize: '0.9rem' }}>
          Save Changes
        </button>
        <button type="button" onClick={onBack} style={{ padding: '8px 16px', background: '#fff', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', fontSize: '0.9rem' }}>
          Back
        </button>
      </div>

      <UIDDocumentDrawer
        uidNo={report?.uid_no || ''}
        isOpen={showDrawer}
        onClose={() => setShowDrawer(false)}
      />
    </div>
  )
}
