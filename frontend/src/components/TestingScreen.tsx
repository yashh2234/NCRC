import { useCallback, useEffect, useState } from 'react'
import { X, Save, FileText } from 'lucide-react'
import { api } from '../lib/api'

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
  const [globalFields, setGlobalFields] = useState({ size_of_cube: '150', age_of_specimen: '28', location: '' })

  const loadDetails = useCallback(async () => {
    try {
      const data = await api.reportDetail(reportType, reportId)
      const rows: DetailRow[] = (data.details as any[]).length > 0
        ? (data.details as any[]).map((d: any) => ({
            set_count: d.set_count,
            load_1: d.load_1,
            load_2: d.load_2,
            load_3: d.load_3,
            comp_strength_1: d.comp_strength_1,
            comp_strength_2: d.comp_strength_2,
            comp_strength_3: d.comp_strength_3,
            avg_comp_strength: d.avg_comp_strength,
            is_code_comp_strength: d.is_code_comp_strength,
            size_of_cube: d.size_of_cube,
            age_of_specimen: d.age_of_specimen,
            location: d.location,
          }))
        : [{}]
      setDetails(rows)
      if (rows.length > 0) {
        setGlobalFields({
          size_of_cube: rows[0].size_of_cube || '150',
          age_of_specimen: rows[0].age_of_specimen || '28',
          location: rows[0].location || '',
        })
      }
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

  const addSet = () => {
    setDetails((prev) => [...prev, { ...globalFields }])
  }

  const removeSet = (index: number) => {
    setDetails((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSave = async (markComplete: boolean) => {
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const payload = {
        details: details.map((d) => ({
          ...d,
          size_of_cube: globalFields.size_of_cube,
          age_of_specimen: globalFields.age_of_specimen,
          location: globalFields.location,
        })),
        mark_complete: markComplete,
      }
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16, padding: 12, background: '#f8fafb', borderRadius: 8 }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                Size of Cube
                <input type="text" className="input" value={globalFields.size_of_cube} onChange={(e) => setGlobalFields((p) => ({ ...p, size_of_cube: e.target.value }))} style={{ display: 'block', width: '100%', marginTop: 4 }} />
              </label>
              <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                Age of Specimen (days)
                <input type="text" className="input" value={globalFields.age_of_specimen} onChange={(e) => setGlobalFields((p) => ({ ...p, age_of_specimen: e.target.value }))} style={{ display: 'block', width: '100%', marginTop: 4 }} />
              </label>
              <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                Location
                <input type="text" className="input" value={globalFields.location} onChange={(e) => setGlobalFields((p) => ({ ...p, location: e.target.value }))} style={{ display: 'block', width: '100%', marginTop: 4 }} />
              </label>
            </div>

            {details.map((row, i) => (
              <div key={i} style={{ border: '1px solid #e5eaed', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <strong style={{ fontSize: '0.88rem' }}>Set #{i + 1}</strong>
                  {details.length > 1 ? (
                    <button className="icon-button" onClick={() => removeSet(i)} type="button" title="Remove set" style={{ color: '#ef4444' }}>
                      <X size={15} />
                    </button>
                  ) : null}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  <label style={{ fontSize: '0.78rem' }}>
                    Load 1<input type="text" className="input" value={row.load_1 ?? ''} onChange={(e) => updateDetail(i, 'load_1', e.target.value)} style={{ display: 'block', width: '100%', marginTop: 2 }} />
                  </label>
                  <label style={{ fontSize: '0.78rem' }}>
                    Load 2<input type="text" className="input" value={row.load_2 ?? ''} onChange={(e) => updateDetail(i, 'load_2', e.target.value)} style={{ display: 'block', width: '100%', marginTop: 2 }} />
                  </label>
                  <label style={{ fontSize: '0.78rem' }}>
                    Load 3<input type="text" className="input" value={row.load_3 ?? ''} onChange={(e) => updateDetail(i, 'load_3', e.target.value)} style={{ display: 'block', width: '100%', marginTop: 2 }} />
                  </label>
                  <label style={{ fontSize: '0.78rem' }}>
                    Comp Strength 1<input type="text" className="input" value={row.comp_strength_1 ?? ''} onChange={(e) => updateDetail(i, 'comp_strength_1', e.target.value)} style={{ display: 'block', width: '100%', marginTop: 2 }} />
                  </label>
                  <label style={{ fontSize: '0.78rem' }}>
                    Comp Strength 2<input type="text" className="input" value={row.comp_strength_2 ?? ''} onChange={(e) => updateDetail(i, 'comp_strength_2', e.target.value)} style={{ display: 'block', width: '100%', marginTop: 2 }} />
                  </label>
                  <label style={{ fontSize: '0.78rem' }}>
                    Comp Strength 3<input type="text" className="input" value={row.comp_strength_3 ?? ''} onChange={(e) => updateDetail(i, 'comp_strength_3', e.target.value)} style={{ display: 'block', width: '100%', marginTop: 2 }} />
                  </label>
                  <label style={{ fontSize: '0.78rem' }}>
                    Avg Comp Strength<input type="text" className="input" value={row.avg_comp_strength ?? ''} onChange={(e) => updateDetail(i, 'avg_comp_strength', e.target.value)} style={{ display: 'block', width: '100%', marginTop: 2 }} />
                  </label>
                  <label style={{ fontSize: '0.78rem' }}>
                    Is Code Strength<input type="text" className="input" value={row.is_code_comp_strength ?? ''} onChange={(e) => updateDetail(i, 'is_code_comp_strength', e.target.value)} style={{ display: 'block', width: '100%', marginTop: 2 }} />
                  </label>
                  <label style={{ fontSize: '0.78rem' }}>
                    Set Count<input type="number" className="input" value={row.set_count ?? ''} onChange={(e) => updateDetail(i, 'set_count', e.target.value)} style={{ display: 'block', width: '100%', marginTop: 2 }} />
                  </label>
                </div>
              </div>
            ))}

            <button type="button" className="ghost-button" onClick={addSet} style={{ marginBottom: 16 }}>
              + Add set
            </button>

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
