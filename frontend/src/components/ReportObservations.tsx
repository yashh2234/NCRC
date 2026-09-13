import { useState } from 'react'
import { Plus, X, Save, FlaskConical } from 'lucide-react'
import { request } from '../lib/api'

interface ObservationRow {
  parameter: string
  value: string
  unit: string
  spec: string
  result: string
}

interface ReportObservationsProps {
  reportId: number
  existing: ObservationRow[] | null
  onSaved: () => void
}

export function ReportObservations({ reportId, existing, onSaved }: ReportObservationsProps) {
  const [rows, setRows] = useState<ObservationRow[]>(existing ?? [{ parameter: '', value: '', unit: '', spec: '', result: '' }])
  const [saving, setSaving] = useState(false)

  const addRow = () => setRows(r => [...r, { parameter: '', value: '', unit: '', spec: '', result: '' }])

  const updateRow = (idx: number, field: keyof ObservationRow, val: string) => {
    setRows(r => r.map((row, i) => i === idx ? { ...row, [field]: val } : row))
  }

  const removeRow = (idx: number) => {
    if (rows.length <= 1) return
    setRows(r => r.filter((_, i) => i !== idx))
  }

  const save = async () => {
    setSaving(true)
    try {
      await request(`/report-workflow/${reportId}/observations`, {
        method: 'POST',
        body: JSON.stringify({ observations: rows.filter(r => r.parameter) }),
      })
      onSaved()
    } catch (e) { alert(e instanceof Error ? e.message : 'Failed') }
    finally { setSaving(false) }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <strong style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 4 }}>
          <FlaskConical size={14} /> Test Observations
        </strong>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="ghost-button" onClick={addRow} type="button" style={{ fontSize: '0.76rem' }}>
            <Plus size={12} /> Add Row
          </button>
          <button className="ghost-button" onClick={() => void save()} type="button" disabled={saving} style={{ fontSize: '0.76rem' }}>
            <Save size={12} /> {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 4 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr auto', gap: 4, fontSize: '0.7rem', color: '#65737d', fontWeight: 600, padding: '0 4px' }}>
          <span>Parameter</span><span>Value</span><span>Unit</span><span>Spec</span><span>Result</span><span />
        </div>
        {rows.map((row, idx) => (
          <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr auto', gap: 4 }}>
            <input value={row.parameter} onChange={e => updateRow(idx, 'parameter', e.target.value)} placeholder="Parameter" style={{ fontSize: '0.78rem', padding: '4px 6px' }} />
            <input value={row.value} onChange={e => updateRow(idx, 'value', e.target.value)} placeholder="Value" style={{ fontSize: '0.78rem', padding: '4px 6px' }} />
            <input value={row.unit} onChange={e => updateRow(idx, 'unit', e.target.value)} placeholder="Unit" style={{ fontSize: '0.78rem', padding: '4px 6px' }} />
            <input value={row.spec} onChange={e => updateRow(idx, 'spec', e.target.value)} placeholder="Spec" style={{ fontSize: '0.78rem', padding: '4px 6px' }} />
            <select value={row.result} onChange={e => updateRow(idx, 'result', e.target.value)} style={{ fontSize: '0.78rem', padding: '4px 6px' }}>
              <option value="">Select</option>
              <option value="pass">Pass</option>
              <option value="fail">Fail</option>
              <option value="n/a">N/A</option>
            </select>
            <button className="ghost-button" onClick={() => removeRow(idx)} type="button" style={{ padding: '4px', color: '#ef4444' }} disabled={rows.length <= 1}>
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
