import { useCallback, useEffect, useState } from 'react'
import { X, Save, FileText } from 'lucide-react'
import { api } from '../lib/api'
import { ExcelLabReportEditor, resolveExcelTemplateKey } from './ExcelLabReportEditor'

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
}

interface TestingScreenProps {
  reportId: number
  reportType: string
  uid_no: string
  agencyName: string
  onClose: () => void
  onComplete: () => void
}

export function TestingScreen({ reportId, reportType, uid_no, agencyName, onClose, onComplete }: TestingScreenProps) {
  const [details, setDetails] = useState<DetailRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [material, setMaterial] = useState('')
  const [labData, setLabData] = useState<Record<string, string>>({})
  const [templateKey, setTemplateKey] = useState('')

  const loadDetails = useCallback(async () => {
    try {
      const data = await api.reportDetail(reportType, reportId)
      setMaterial((data.report as any).material_details || '')
      setLabData((data.report as any).lab_data || {})
      setTemplateKey((data.report as any).lab_data?._template || resolveExcelTemplateKey(reportType, (data.report as any).material_details || ''))
      const rows: DetailRow[] = (data.details as any[]).length > 0
        ? (data.details as any[]).map((d: any) => ({ ...d }))
        : [{}]
      setDetails(rows)
    } catch {
      setError('Failed to load report details')
    } finally {
      setLoading(false)
    }
  }, [reportId, reportType])

  useEffect(() => { void loadDetails() }, [loadDetails])

  const updateDetail = (index: number, field: string, value: string) => {
    setDetails((prev) => prev.map((d, i) => (i === index ? { ...d, [field]: value } : d)))
  }

  const handleSave = async (markComplete: boolean) => {
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const payload = {
        details,
        mark_complete: markComplete,
      }
      await api.updateReport(reportType, reportId, { lab_data: { ...labData, _template: templateKey } })
      await api.saveObservations(reportType, reportId, payload as any)
      setMessage(markComplete ? 'Report generated successfully' : 'Draft saved')
      if (markComplete) {
        setTimeout(() => onComplete(), 800)
      }
    } catch {
      setError('Failed to save observations')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
    }}>
      <div style={{
        background: '#fff', borderRadius: 12, padding: 24, minWidth: 640, maxWidth: 800,
        maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 16px 48px rgba(0,0,0,0.15)',
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Testing: {uid_no}</h3>
            <span style={{ fontSize: '0.82rem', color: '#65737d' }}>{agencyName} | {reportType}</span>
          </div>
          <button className="icon-button" onClick={onClose} type="button"><X size={18} /></button>
        </div>

        {error ? <div className="error-banner">{error}</div> : null}
        {message ? <div className="success-banner">{message}</div> : null}

        {loading ? (
          <p style={{ textAlign: 'center', padding: 32, color: '#65737d' }}>Loading details...</p>
        ) : (
          <>
            <ExcelLabReportEditor
              reportType={reportType}
              material={material}
              details={details}
              labData={labData}
              templateKey={templateKey}
              updateDetail={updateDetail}
              updateLabData={(field, value) => setLabData((previous) => ({ ...previous, [field]: value }))}
            />

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', borderTop: '1px solid #e5eaed', paddingTop: 16 }}>
              <button type="button" className="ghost-button" onClick={() => void handleSave(false)} disabled={saving}>
                <Save size={16} /> {saving ? 'Saving...' : 'Save Draft'}
              </button>
              <button type="button" className="ghost-button" onClick={() => void handleSave(true)} disabled={saving} style={{ background: '#327268', color: '#fff' }}>
                <FileText size={16} /> {saving ? 'Saving...' : 'Save & Generate Report'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
