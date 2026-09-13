import { useState, useEffect } from 'react'
import { Plus, Check, X, Play, RotateCcw, Trash2, User, Truck, Clock } from 'lucide-react'
import { request } from '../lib/api'
import type { JobAssignment } from '../lib/types'

interface AssignmentManagerProps {
  jobId: number
}

interface Department { id: number; name: string }
interface Vendor { id: number; vendor_name: string }

export function AssignmentManager({ jobId }: AssignmentManagerProps) {
  const [assignments, setAssignments] = useState<JobAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [departments, setDepartments] = useState<Department[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [form, setForm] = useState<{
    department_id: string; assigned_to: string; assignment_type: string;
    vendor_id: string; priority: string; due_date: string; notes: string;
  }>({
    department_id: '', assigned_to: '', assignment_type: 'internal',
    vendor_id: '', priority: 'normal', due_date: '', notes: '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadAssignments(); loadRefData() }, [jobId])

  const loadAssignments = async () => {
    setLoading(true)
    try { const d = await request<{data: JobAssignment[]} | JobAssignment[]>(`/jobs/${jobId}/assignments`); setAssignments(Array.isArray(d) ? d : d.data) }
    catch {} finally { setLoading(false) }
  }

  const loadRefData = async () => {
    try {
      const [deptData, vendData] = await Promise.all([
        request<{ data: Department[] } | Department[]>('/departments'),
        request<{ data: Vendor[] } | Vendor[]>('/vendors'),
      ])
      setDepartments(Array.isArray(deptData) ? deptData : deptData.data)
      setVendors(Array.isArray(vendData) ? vendData : vendData.data)
    } catch {}
  }

  const createAssignment = async () => {
    setSaving(true)
    try {
      const body: Record<string, string> = {
        assignment_type: form.assignment_type,
        priority: form.priority,
      }
      if (form.department_id) body.department_id = form.department_id
      if (form.assigned_to) body.assigned_to = form.assigned_to
      if (form.vendor_id) body.vendor_id = form.vendor_id
      if (form.due_date) body.due_date = form.due_date
      if (form.notes) body.notes = form.notes
      await request(`/jobs/${jobId}/assignments`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
      setShowForm(false)
      setForm({ department_id: '', assigned_to: '', assignment_type: 'internal', vendor_id: '', priority: 'normal', due_date: '', notes: '' })
      await loadAssignments()
    } catch (e) { alert(e instanceof Error ? e.message : 'Failed') }
    finally { setSaving(false) }
  }

  const updateStatus = async (a: JobAssignment, status: string) => {
    await request(`/jobs/assignments/${a.id}`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    })
    await loadAssignments()
  }

  const deleteAssignment = async (a: JobAssignment) => {
    if (!window.confirm('Delete this assignment?')) return
    await request(`/jobs/assignments/${a.id}`, { method: 'DELETE' })
    await loadAssignments()
  }

  const STATUS_BTN: Record<string, { color: string; label: string; icon: React.FC<{size: number}> }> = {
    pending: { color: '#6b7280', label: 'Pending', icon: Clock },
    in_progress: { color: '#92400e', label: 'In Progress', icon: Play },
    completed: { color: '#065f46', label: 'Completed', icon: Check },
    cancelled: { color: '#991b1b', label: 'Cancelled', icon: X },
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: '0.85rem', color: '#65737d' }}>{assignments.length} assignment(s)</span>
        {!showForm ? (
          <button className="ghost-button" onClick={() => setShowForm(true)} type="button">
            <Plus size={14} /> New Assignment
          </button>
        ) : null}
      </div>

      {showForm ? (
        <div style={{ padding: 12, border: '1px solid #e8eef1', borderRadius: 8, marginBottom: 12, background: '#fbfcfd' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <select value={form.department_id} onChange={e => setForm(f => ({ ...f, department_id: e.target.value }))}>
              <option value="">Department</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <input type="number" value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))} placeholder="User ID" />
            <select value={form.assignment_type} onChange={e => setForm(f => ({ ...f, assignment_type: e.target.value }))}>
              <option value="internal">Internal</option>
              <option value="outsource">Outsource</option>
            </select>
            {form.assignment_type === 'outsource' ? (
              <select value={form.vendor_id} onChange={e => setForm(f => ({ ...f, vendor_id: e.target.value }))}>
                <option value="">Vendor</option>
                {vendors.map(v => <option key={v.id} value={v.id}>{v.vendor_name}</option>)}
              </select>
            ) : <span />}
            <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
            <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
          </div>
          <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notes..." rows={2} style={{ marginTop: 8 }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="ghost-button" onClick={() => void createAssignment()} type="button" disabled={saving}>
              <Plus size={14} /> {saving ? 'Saving...' : 'Create'}
            </button>
            <button className="ghost-button" onClick={() => setShowForm(false)} type="button"><X size={14} /> Cancel</button>
          </div>
        </div>
      ) : null}

      {loading ? <p style={{ color: '#65737d', fontSize: '0.85rem' }}>Loading...</p> : null}

      {!loading && assignments.length === 0 && !showForm ? (
        <p style={{ color: '#65737d', fontSize: '0.85rem' }}>No assignments. Create one to start.</p>
      ) : null}

      <div style={{ display: 'grid', gap: 8 }}>
        {assignments.map(a => {
          const st = STATUS_BTN[a.status] ?? STATUS_BTN.pending
          return (
            <div key={a.id} style={{ padding: '10px 14px', border: '1px solid #e8eef1', borderRadius: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <strong style={{ fontSize: '0.85rem' }}>{a.department?.name ?? 'General'}</strong>
                  {a.assigned_user ? <span style={{ fontSize: '0.82rem', color: '#65737d' }}><User size={12} /> {a.assigned_user.name}</span> : null}
                  {a.vendor ? <span style={{ fontSize: '0.82rem', color: '#65737d' }}><Truck size={12} /> {a.vendor.vendor_name}</span> : null}
                </div>
                <span className="sync-pill" style={{ background: `${st.color}20`, color: st.color, fontSize: '0.72rem' }}>{a.status.replace(/_/g, ' ')}</span>
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: '0.78rem', color: '#65737d' }}>
                <span style={{ textTransform: 'capitalize' }}>{a.assignment_type}</span>
                <span style={{ textTransform: 'capitalize' }}>Priority: {a.priority}</span>
                {a.due_date ? <span>Due: {new Date(a.due_date).toLocaleDateString()}</span> : null}
              </div>
              {a.notes ? <p style={{ fontSize: '0.78rem', color: '#4a5b66', marginTop: 4 }}>{a.notes}</p> : null}
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                {a.status === 'pending' ? (
                  <button className="ghost-button" onClick={() => void updateStatus(a, 'in_progress')} type="button" style={{ fontSize: '0.72rem' }}><Play size={11} /> Start</button>
                ) : null}
                {a.status === 'in_progress' ? (
                  <button className="ghost-button" onClick={() => void updateStatus(a, 'completed')} type="button" style={{ fontSize: '0.72rem', color: '#065f46' }}><Check size={11} /> Complete</button>
                ) : null}
                {(a.status === 'pending' || a.status === 'in_progress') ? (
                  <button className="ghost-button" onClick={() => void updateStatus(a, 'cancelled')} type="button" style={{ fontSize: '0.72rem', color: '#991b1b' }}><X size={11} /> Cancel</button>
                ) : null}
                {a.status === 'completed' ? (
                  <button className="ghost-button" onClick={() => void updateStatus(a, 'in_progress')} type="button" style={{ fontSize: '0.72rem' }}><RotateCcw size={11} /> Reopen</button>
                ) : null}
                <button className="ghost-button" onClick={() => void deleteAssignment(a)} type="button" style={{ fontSize: '0.72rem', color: '#ef4444', marginLeft: 'auto' }}><Trash2 size={11} /></button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
