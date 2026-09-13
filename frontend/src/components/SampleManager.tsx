import { useState, useEffect } from 'react'
import { Plus, X, Trash2, Edit2, Save } from 'lucide-react'
import { request } from '../lib/api'
import type { Sample } from '../lib/types'

interface SampleManagerProps { jobId: number }

export function SampleManager({ jobId }: SampleManagerProps) {
  const [samples, setSamples] = useState<Sample[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState({
    sample_name: '', sample_type: '', description: '',
    quantity: '', unit: '', condition: '',
    received_date: '', remarks: '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadSamples() }, [jobId])

  const loadSamples = async () => {
    setLoading(true)
    try {
      const d = await request<{ data: Sample[] } | Sample[]>(`/jobs/${jobId}/samples`)
      setSamples(Array.isArray(d) ? d : d.data)
    } catch {} finally { setLoading(false) }
  }

  const resetForm = () => setForm({
    sample_name: '', sample_type: '', description: '',
    quantity: '', unit: '', condition: '',
    received_date: '', remarks: '',
  })

  const saveSample = async () => {
    setSaving(true)
    try {
      const body = Object.fromEntries(Object.entries(form).filter(([_, v]) => v))
      if (editingId) {
        await request(`/samples/${editingId}`, { method: 'PUT', body: JSON.stringify(body) })
      } else {
        await request(`/jobs/${jobId}/samples`, { method: 'POST', body: JSON.stringify(body) })
      }
      resetForm()
      setShowForm(false)
      setEditingId(null)
      await loadSamples()
    } catch (e) { alert(e instanceof Error ? e.message : 'Failed') }
    finally { setSaving(false) }
  }

  const editSample = (s: Sample) => {
    setForm({
      sample_name: s.sample_name ?? '', sample_type: s.sample_type ?? '',
      description: s.description ?? '', quantity: s.quantity ?? '',
      unit: s.unit ?? '', condition: s.condition ?? '',
      received_date: s.received_date ?? '', remarks: s.remarks ?? '',
    })
    setEditingId(s.id)
    setShowForm(true)
  }

  const deleteSample = async (s: Sample) => {
    if (!window.confirm('Delete this sample?')) return
    await request(`/samples/${s.id}`, { method: 'DELETE' })
    await loadSamples()
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: '0.85rem', color: '#65737d' }}>{samples.length} sample(s)</span>
        {!showForm ? (
          <button className="ghost-button" onClick={() => { resetForm(); setEditingId(null); setShowForm(true) }} type="button">
            <Plus size={14} /> Add Sample
          </button>
        ) : null}
      </div>

      {showForm ? (
        <div style={{ padding: 12, border: '1px solid #e8eef1', borderRadius: 8, marginBottom: 12, background: '#fbfcfd' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <input value={form.sample_name} onChange={e => setForm(f => ({ ...f, sample_name: e.target.value }))} placeholder="Sample name" />
            <input value={form.sample_type} onChange={e => setForm(f => ({ ...f, sample_type: e.target.value }))} placeholder="Sample type" />
            <input value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} placeholder="Quantity" />
            <input value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} placeholder="Unit (kg, L, pcs)" />
            <input value={form.condition} onChange={e => setForm(f => ({ ...f, condition: e.target.value }))} placeholder="Condition" />
            <input type="date" value={form.received_date} onChange={e => setForm(f => ({ ...f, received_date: e.target.value }))} />
          </div>
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Description..." rows={2} style={{ marginTop: 8 }} />
          <textarea value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} placeholder="Remarks..." rows={2} style={{ marginTop: 8 }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="ghost-button" onClick={() => void saveSample()} type="button" disabled={saving}>
              <Save size={14} /> {saving ? 'Saving...' : editingId ? 'Update' : 'Save'}
            </button>
            <button className="ghost-button" onClick={() => { setShowForm(false); setEditingId(null); resetForm() }} type="button"><X size={14} /> Cancel</button>
          </div>
        </div>
      ) : null}

      {loading ? <p style={{ color: '#65737d', fontSize: '0.85rem' }}>Loading...</p> : null}

      {!loading && samples.length === 0 && !showForm ? (
        <p style={{ color: '#65737d', fontSize: '0.85rem' }}>No samples registered. Add one to start.</p>
      ) : null}

      <div style={{ display: 'grid', gap: 8 }}>
        {samples.map(s => (
          <div key={s.id} style={{ padding: '10px 14px', border: '1px solid #e8eef1', borderRadius: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <strong style={{ fontSize: '0.88rem' }}>{s.sample_name || s.sample_type || 'Sample #' + s.id}</strong>
                {s.quantity ? <span className="sync-pill" style={{ marginLeft: 8 }}>{s.quantity}{s.unit ? ` ${s.unit}` : ''}</span> : null}
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button className="ghost-button" onClick={() => editSample(s)} type="button" style={{ padding: '2px 6px' }}><Edit2 size={12} /></button>
                <button className="ghost-button" onClick={() => void deleteSample(s)} type="button" style={{ padding: '2px 6px', color: '#ef4444' }}><Trash2 size={12} /></button>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: '0.78rem', color: '#65737d' }}>
              {s.condition ? <span>Condition: {s.condition}</span> : null}
              {s.received_date ? <span>Received: {new Date(s.received_date).toLocaleDateString()}</span> : null}
            </div>
            {s.description ? <p style={{ fontSize: '0.78rem', color: '#4a5b66', marginTop: 4 }}>{s.description}</p> : null}
            {s.remarks ? <p style={{ fontSize: '0.78rem', color: '#4a5b66', marginTop: 2 }}>Note: {s.remarks}</p> : null}
          </div>
        ))}
      </div>
    </div>
  )
}
