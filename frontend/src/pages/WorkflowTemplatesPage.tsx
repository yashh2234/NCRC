import { useState, useEffect, type FormEvent } from 'react'
import { Settings, Plus, Trash2, Edit3, ArrowRight, Circle, X } from 'lucide-react'
import { request } from '../lib/api'
import type { WorkflowTemplate, WorkflowStage, WorkflowTransition } from '../lib/types'

const emptyTemplate = { name: '', description: '', is_active: true }
const emptyStage: { name: string; slug: string; sort_order: number; sla_hours: number | null; is_start: boolean; is_end: boolean; color: string } = { name: '', slug: '', sort_order: 0, sla_hours: null, is_start: false, is_end: false, color: '#6b7280' }
const emptyTransition = { from_stage_id: 0, to_stage_id: 0, name: '', requires_approval: false }

export function WorkflowTemplatesPage() {
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate | null>(null)
  const [stages, setStages] = useState<WorkflowStage[]>([])
  const [transitions, setTransitions] = useState<WorkflowTransition[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [showTemplateForm, setShowTemplateForm] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<WorkflowTemplate | null>(null)
  const [templateForm, setTemplateForm] = useState(emptyTemplate)

  const [showStageForm, setShowStageForm] = useState(false)
  const [editingStage, setEditingStage] = useState<WorkflowStage | null>(null)
  const [stageForm, setStageForm] = useState(emptyStage)

  const [showTransitionForm, setShowTransitionForm] = useState(false)
  const [editingTransition, setEditingTransition] = useState<WorkflowTransition | null>(null)
  const [transitionForm, setTransitionForm] = useState(emptyTransition)

  useEffect(() => { loadTemplates() }, [])

  const loadTemplates = async () => {
    setLoading(true)
    try {
      const data = await request<WorkflowTemplate[]>('/workflow/templates')
      setTemplates(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates')
    } finally { setLoading(false) }
  }

  const loadTemplateDetail = async (template: WorkflowTemplate) => {
    setSelectedTemplate(template)
    try {
      const data = await request<WorkflowTemplate>(`/workflow/templates/${template.id}`)
      setStages(data.stages ?? [])
      setTransitions(data.transitions ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load template details')
    }
  }

  const handleTemplateSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      if (editingTemplate) {
        await request(`/workflow/templates/${editingTemplate.id}`, {
          method: 'PUT', body: JSON.stringify(templateForm),
        })
      } else {
        await request('/workflow/templates', {
          method: 'POST', body: JSON.stringify(templateForm),
        })
      }
      setShowTemplateForm(false)
      setEditingTemplate(null)
      setTemplateForm(emptyTemplate)
      await loadTemplates()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save template')
    }
  }

  const handleStageSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!selectedTemplate) return
    setError('')
    try {
      if (editingStage) {
        await request(`/workflow/stages/${editingStage.id}`, {
          method: 'PUT', body: JSON.stringify(stageForm),
        })
      } else {
        await request(`/workflow/templates/${selectedTemplate.id}/stages`, {
          method: 'POST', body: JSON.stringify(stageForm),
        })
      }
      setShowStageForm(false)
      setEditingStage(null)
      setStageForm(emptyStage)
      await loadTemplateDetail(selectedTemplate)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save stage')
    }
  }

  const handleTransitionSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!selectedTemplate) return
    setError('')
    try {
      if (editingTransition) {
        await request(`/workflow/transitions/${editingTransition.id}`, {
          method: 'PUT', body: JSON.stringify(transitionForm),
        })
      } else {
        await request(`/workflow/templates/${selectedTemplate.id}/transitions`, {
          method: 'POST', body: JSON.stringify(transitionForm),
        })
      }
      setShowTransitionForm(false)
      setEditingTransition(null)
      setTransitionForm(emptyTransition)
      await loadTemplateDetail(selectedTemplate)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save transition')
    }
  }

  const deleteTemplate = async (t: WorkflowTemplate) => {
    if (!window.confirm(`Delete template "${t.name}"?`)) return
    try {
      await request(`/workflow/templates/${t.id}`, { method: 'DELETE' })
      if (selectedTemplate?.id === t.id) {
        setSelectedTemplate(null)
        setStages([])
        setTransitions([])
      }
      await loadTemplates()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete template')
    }
  }

  const deleteStage = async (s: WorkflowStage) => {
    if (!selectedTemplate || !window.confirm(`Delete stage "${s.name}"?`)) return
    try {
      await request(`/workflow/stages/${s.id}`, { method: 'DELETE' })
      await loadTemplateDetail(selectedTemplate)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete stage')
    }
  }

  const deleteTransition = async (t: WorkflowTransition) => {
    if (!selectedTemplate || !window.confirm(`Delete transition "${t.name}"?`)) return
    try {
      await request(`/workflow/transitions/${t.id}`, { method: 'DELETE' })
      await loadTemplateDetail(selectedTemplate)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete transition')
    }
  }

  const beginEditTemplate = (t: WorkflowTemplate) => {
    setEditingTemplate(t)
    setTemplateForm({ name: t.name, description: t.description ?? '', is_active: t.is_active })
    setShowTemplateForm(true)
  }

  const beginEditStage = (s: WorkflowStage) => {
    setEditingStage(s)
    setStageForm({
      name: s.name, slug: s.slug, sort_order: s.sort_order,
      sla_hours: s.sla_hours, is_start: s.is_start, is_end: s.is_end, color: s.color,
    })
    setShowStageForm(true)
  }

  const beginEditTransition = (t: WorkflowTransition) => {
    setEditingTransition(t)
    setTransitionForm({
      from_stage_id: t.from_stage_id, to_stage_id: t.to_stage_id,
      name: t.name, requires_approval: t.requires_approval,
    })
    setShowTransitionForm(true)
  }

  const moveStageUp = async (s: WorkflowStage) => {
    const idx = stages.findIndex((x) => x.id === s.id)
    if (idx <= 0) return
    const prev = stages[idx - 1]
    await request(`/workflow/stages/${s.id}`, { method: 'PUT', body: JSON.stringify({ sort_order: prev.sort_order }) })
    await request(`/workflow/stages/${prev.id}`, { method: 'PUT', body: JSON.stringify({ sort_order: s.sort_order }) })
    if (selectedTemplate) await loadTemplateDetail(selectedTemplate)
  }

  const moveStageDown = async (s: WorkflowStage) => {
    const idx = stages.findIndex((x) => x.id === s.id)
    if (idx < 0 || idx >= stages.length - 1) return
    const next = stages[idx + 1]
    await request(`/workflow/stages/${s.id}`, { method: 'PUT', body: JSON.stringify({ sort_order: next.sort_order }) })
    await request(`/workflow/stages/${next.id}`, { method: 'PUT', body: JSON.stringify({ sort_order: s.sort_order }) })
    if (selectedTemplate) await loadTemplateDetail(selectedTemplate)
  }

  const seedWorkflow = async () => {
    try {
      await request('/workflow/seed', { method: 'POST' })
      await loadTemplates()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to seed workflow')
    }
  }

  const stageById = (id: number) => stages.find((s) => s.id === id)

  return (
    <div className="two-column" style={{ height: 'calc(100vh - 64px)' }}>
      <section className="surface" style={{ overflow: 'auto' }}>
        <div className="surface-heading">
          <div>
            <p className="section-label">Configuration</p>
            <h2>Workflow Templates</h2>
          </div>
          <Settings size={20} />
        </div>

        <div className="user-toolbar">
          <button className="ghost-button" onClick={() => { setEditingTemplate(null); setTemplateForm(emptyTemplate); setShowTemplateForm(true) }} type="button">
            <Plus size={18} /> New Template
          </button>
          <button className="ghost-button" onClick={() => void seedWorkflow()} type="button">
            Seed Default
          </button>
          <span className="sync-pill">{templates.length} templates</span>
        </div>

        {error ? <div className="error-banner">{error}</div> : null}

        {loading ? <p style={{ padding: 24, textAlign: 'center', color: '#65737d' }}>Loading...</p> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {templates.map((t) => (
              <div
                key={t.id}
                onClick={() => void loadTemplateDetail(t)}
                className="role-card"
                style={{ cursor: 'pointer', border: selectedTemplate?.id === t.id ? '2px solid #138a6b' : '1px solid #e8eef1' }}
              >
                <div className="surface-heading" style={{ marginBottom: 0 }}>
                  <div>
                    <strong>{t.name}</strong>
                    {t.is_active ? <span className="sync-pill" style={{ marginLeft: 8, background: '#d1fae5', color: '#0a5c3c' }}>Active</span> : null}
                  </div>
                  <div className="row-actions">
                    <button className="icon-button" onClick={(e) => { e.stopPropagation(); beginEditTemplate(t) }} type="button" title="Edit"><Edit3 size={16} /></button>
                    <button className="icon-button" onClick={(e) => { e.stopPropagation(); void deleteTemplate(t) }} type="button" title="Delete"><Trash2 size={16} /></button>
                  </div>
                </div>
                <small style={{ color: '#65737d' }}>{t.description || 'No description'}</small>
              </div>
            ))}
            {templates.length === 0 ? <p style={{ textAlign: 'center', color: '#65737d', padding: 32 }}>No workflow templates yet. Click "Seed Default" to create one.</p> : null}
          </div>
        )}
      </section>

      {selectedTemplate ? (
        <section className="surface" style={{ overflow: 'auto' }}>
          <div className="surface-heading">
            <div>
              <p className="section-label">{selectedTemplate.name}</p>
              <h2>Stages & Transitions</h2>
            </div>
          </div>

          {/* Stage list */}
          <div className="user-toolbar">
            <strong style={{ fontSize: '0.88rem' }}>Stages ({stages.length})</strong>
            <button className="ghost-button" onClick={() => { setEditingStage(null); setStageForm({ ...emptyStage, sort_order: stages.length }); setShowStageForm(true) }} type="button">
              <Plus size={16} /> Add Stage
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 24 }}>
            {stages.map((s) => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: '1px solid #e8eef1', borderRadius: 8, background: '#fbfcfd' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <button className="icon-button" onClick={() => void moveStageUp(s)} type="button" disabled={stages.indexOf(s) === 0} style={{ fontSize: '0.6rem', lineHeight: 1, padding: 2 }}>▲</button>
                  <button className="icon-button" onClick={() => void moveStageDown(s)} type="button" disabled={stages.indexOf(s) === stages.length - 1} style={{ fontSize: '0.6rem', lineHeight: 1, padding: 2 }}>▼</button>
                </div>
                <Circle size={14} fill={s.color} stroke={s.color} />
                <strong style={{ flex: 1, fontSize: '0.88rem' }}>{s.name}</strong>
                {s.is_start ? <span className="sync-pill" style={{ background: '#dbeafe', color: '#1e40af' }}>Start</span> : null}
                {s.is_end ? <span className="sync-pill" style={{ background: '#d1fae5', color: '#0a5c3c' }}>End</span> : null}
                {s.sla_hours ? <span className="sync-pill">{s.sla_hours}h SLA</span> : null}
                <code style={{ fontSize: '0.72rem', color: '#65737d' }}>{s.slug}</code>
                <div className="row-actions">
                  <button className="icon-button" onClick={() => beginEditStage(s)} type="button" title="Edit"><Edit3 size={14} /></button>
                  <button className="icon-button" onClick={() => void deleteStage(s)} type="button" title="Delete"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
            {stages.length === 0 ? <p style={{ color: '#65737d', padding: 16 }}>No stages defined. Add at least a start stage.</p> : null}
          </div>

          {/* Transition list */}
          <div className="user-toolbar" style={{ marginTop: 12 }}>
            <strong style={{ fontSize: '0.88rem' }}>Transitions ({transitions.length})</strong>
            <button className="ghost-button" onClick={() => { setEditingTransition(null); setTransitionForm(emptyTransition); setShowTransitionForm(true) }} type="button">
              <Plus size={16} /> Add Transition
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {transitions.map((t) => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: '1px solid #e8eef1', borderRadius: 8 }}>
                <span className="sync-pill" style={{ background: stageById(t.from_stage_id)?.color ?? '#6b7280', color: '#fff' }}>
                  {stageById(t.from_stage_id)?.name ?? '?'}
                </span>
                <ArrowRight size={14} />
                <span className="sync-pill" style={{ background: stageById(t.to_stage_id)?.color ?? '#6b7280', color: '#fff' }}>
                  {stageById(t.to_stage_id)?.name ?? '?'}
                </span>
                <strong style={{ flex: 1, fontSize: '0.84rem' }}>{t.name}</strong>
                {t.requires_approval ? <span className="sync-pill" style={{ background: '#fef3c7', color: '#92400e' }}>Approval</span> : null}
                <div className="row-actions">
                  <button className="icon-button" onClick={() => beginEditTransition(t)} type="button" title="Edit"><Edit3 size={14} /></button>
                  <button className="icon-button" onClick={() => void deleteTransition(t)} type="button" title="Delete"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
            {transitions.length === 0 ? <p style={{ color: '#65737d', padding: 16 }}>No transitions defined. Add transitions to connect stages.</p> : null}
          </div>
        </section>
      ) : null}

      {/* Template form modal */}
      {showTemplateForm ? (
        <div className="modal-overlay" onClick={() => setShowTemplateForm(false)}>
          <form className="surface" style={{ width: 480, maxHeight: '90vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()} onSubmit={handleTemplateSubmit}>
            <div className="surface-heading">
              <h2>{editingTemplate ? 'Edit Template' : 'New Template'}</h2>
              <button className="icon-button" onClick={() => setShowTemplateForm(false)} type="button"><X size={18} /></button>
            </div>
            <label>
              Name *
              <input value={templateForm.name} onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })} placeholder="e.g. Standard Lab Workflow" required />
            </label>
            <label>
              Description
              <textarea value={templateForm.description} onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })} placeholder="Optional description" rows={3} />
            </label>
            <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={templateForm.is_active} onChange={(e) => setTemplateForm({ ...templateForm, is_active: e.target.checked })} style={{ width: 'auto', minHeight: 'auto' }} />
              Active
            </label>
            <div className="form-actions">
              <button className="ghost-button" onClick={() => setShowTemplateForm(false)} type="button">Cancel</button>
              <button type="submit">{editingTemplate ? 'Update' : 'Create'}</button>
            </div>
          </form>
        </div>
      ) : null}

      {/* Stage form modal */}
      {showStageForm ? (
        <div className="modal-overlay" onClick={() => setShowStageForm(false)}>
          <form className="surface" style={{ width: 480 }} onClick={(e) => e.stopPropagation()} onSubmit={handleStageSubmit}>
            <div className="surface-heading">
              <h2>{editingStage ? 'Edit Stage' : 'New Stage'}</h2>
              <button className="icon-button" onClick={() => setShowStageForm(false)} type="button"><X size={18} /></button>
            </div>
            <label>
              Name *
              <input value={stageForm.name} onChange={(e) => setStageForm({ ...stageForm, name: e.target.value })} placeholder="e.g. Lab Testing" required />
            </label>
            <label>
              Slug *
              <input value={stageForm.slug} onChange={(e) => setStageForm({ ...stageForm, slug: e.target.value.replace(/\s+/g, '-').toLowerCase() })} placeholder="e.g. lab-testing" required />
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label>
                SLA Hours
                <input type="number" value={stageForm.sla_hours ?? ''} onChange={(e) => setStageForm({ ...stageForm, sla_hours: e.target.value ? Number(e.target.value) : null })} placeholder="e.g. 24" min={0} />
              </label>
              <label>
                Color
                <input type="color" value={stageForm.color} onChange={(e) => setStageForm({ ...stageForm, color: e.target.value })} style={{ height: 38, padding: 2 }} />
              </label>
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
              <label style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <input type="checkbox" checked={stageForm.is_start} onChange={(e) => setStageForm({ ...stageForm, is_start: e.target.checked })} style={{ width: 'auto', minHeight: 'auto' }} />
                Start Stage
              </label>
              <label style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <input type="checkbox" checked={stageForm.is_end} onChange={(e) => setStageForm({ ...stageForm, is_end: e.target.checked })} style={{ width: 'auto', minHeight: 'auto' }} />
                End Stage
              </label>
            </div>
            <div className="form-actions">
              <button className="ghost-button" onClick={() => setShowStageForm(false)} type="button">Cancel</button>
              <button type="submit">{editingStage ? 'Update' : 'Create'}</button>
            </div>
          </form>
        </div>
      ) : null}

      {/* Transition form modal */}
      {showTransitionForm ? (
        <div className="modal-overlay" onClick={() => setShowTransitionForm(false)}>
          <form className="surface" style={{ width: 480 }} onClick={(e) => e.stopPropagation()} onSubmit={handleTransitionSubmit}>
            <div className="surface-heading">
              <h2>{editingTransition ? 'Edit Transition' : 'New Transition'}</h2>
              <button className="icon-button" onClick={() => setShowTransitionForm(false)} type="button"><X size={18} /></button>
            </div>
            <label>
              From Stage *
              <select value={transitionForm.from_stage_id} onChange={(e) => setTransitionForm({ ...transitionForm, from_stage_id: Number(e.target.value) })} required>
                <option value={0}>Select stage</option>
                {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <label>
              To Stage *
              <select value={transitionForm.to_stage_id} onChange={(e) => setTransitionForm({ ...transitionForm, to_stage_id: Number(e.target.value) })} required>
                <option value={0}>Select stage</option>
                {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <label>
              Transition Name *
              <input value={transitionForm.name} onChange={(e) => setTransitionForm({ ...transitionForm, name: e.target.value })} placeholder="e.g. Start Testing" required />
            </label>
            <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={transitionForm.requires_approval} onChange={(e) => setTransitionForm({ ...transitionForm, requires_approval: e.target.checked })} style={{ width: 'auto', minHeight: 'auto' }} />
              Requires Approval
            </label>
            <div className="form-actions">
              <button className="ghost-button" onClick={() => setShowTransitionForm(false)} type="button">Cancel</button>
              <button type="submit">{editingTransition ? 'Update' : 'Create'}</button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  )
}
