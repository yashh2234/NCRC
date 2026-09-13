import { useState, useEffect } from 'react'
import { ArrowLeft, Circle, ArrowRight, Clock, User, Check, Send, Activity, Ban, Box, Briefcase, Calendar, AlertTriangle, RotateCcw, Users, FileText, CreditCard, Truck } from 'lucide-react'
import { request } from '../lib/api'
import type { Job, WorkflowTransition } from '../lib/types'
import { ReportWorkflow } from '../components/ReportWorkflow'
import { AssignmentManager } from '../components/AssignmentManager'
import { SampleManager } from '../components/SampleManager'
import { BillingSection } from '../components/BillingSection'
import { DispatchSection } from '../components/DispatchSection'
import { TestResultManager } from '../components/TestResultManager'
import { DocumentManager } from '../components/DocumentManager'

interface JobDetailPageProps { jobId: number; onBack: () => void }

const STATUS_COLORS: Record<string, string> = { active: '#10b981', pending: '#6b7280', completed: '#3b82f6', cancelled: '#ef4444', on_hold: '#f59e0b' }
const PRIORITY_COLORS: Record<string, string> = { low: '#6b7280', normal: '#3b82f6', high: '#f59e0b', urgent: '#ef4444' }

function SectionCard({ title, icon: Icon, children, defaultOpen = true }: { title: string; icon: React.FC<{ size?: number }>; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="surface" style={{ marginBottom: 16 }}>
      <div className="surface-heading" onClick={() => setOpen(!open)} style={{ cursor: 'pointer' }}>
        <div>
          <p className="section-label">{title}</p>
          <h2>{title}</h2>
        </div>
        <Icon size={20} />
      </div>
      {open ? <div style={{ padding: '0 20px 20px' }}>{children}</div> : null}
    </div>
  )
}

export function JobDetailPage({ jobId, onBack }: JobDetailPageProps) {
  const [job, setJob] = useState<Job | null>(null)
  const [allowedTransitions, setAllowedTransitions] = useState<WorkflowTransition[]>([])
  const [loading, setLoading] = useState(true)
  const [transitioning, setTransitioning] = useState(false)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [assignUserId, setAssignUserId] = useState<number | null>(null)

  useEffect(() => { loadJob() }, [jobId])

  const loadJob = async () => {
    setLoading(true)
    try {
      const [jobData, transitionsData] = await Promise.all([
        request<Job>(`/jobs/${jobId}`),
        request<WorkflowTransition[]>(`/jobs/${jobId}/allowed-transitions`),
      ])
      setJob(jobData)
      setAllowedTransitions(transitionsData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load job')
    } finally { setLoading(false) }
  }

  const handleTransition = async (transitionId: number) => {
    setTransitioning(true)
    setError('')
    try {
      const result = await request<{ message: string; job: Job }>(`/jobs/${jobId}/transition`, {
        method: 'POST',
        body: JSON.stringify({ transition_id: transitionId, notes }),
      })
      setJob(result.job)
      setNotes('')
      await loadAllowedTransitions()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transition failed')
    } finally { setTransitioning(false) }
  }

  const loadAllowedTransitions = async () => {
    try {
      const data = await request<WorkflowTransition[]>(`/jobs/${jobId}/allowed-transitions`)
      setAllowedTransitions(data)
    } catch {}
  }

  const handleAssign = async () => {
    if (!assignUserId) return
    try {
      await request(`/jobs/${jobId}/assign`, { method: 'POST', body: JSON.stringify({ user_id: assignUserId }) })
      setAssignUserId(null)
      await loadJob()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Assignment failed')
    }
  }

  const handleCancel = async () => {
    const reason = window.prompt('Reason for cancellation:')
    if (reason === null) return
    try {
      await request(`/jobs/${jobId}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) })
      await loadJob()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cancellation failed')
    }
  }

  if (loading) {
    return (
      <div className="surface" style={{ padding: 32 }}>
        <p style={{ textAlign: 'center', color: '#65737d' }}>Loading job details...</p>
      </div>
    )
  }

  if (!job) {
    return (
      <div className="surface" style={{ padding: 32 }}>
        <p style={{ textAlign: 'center', color: '#ef4444' }}>Job not found</p>
        <button className="ghost-button" onClick={onBack} type="button">Back to Jobs</button>
      </div>
    )
  }

  const timeline = job.timeline ?? []
  const stageTracking = job.stage_tracking ?? []
  const workflowStages = job.workflow_template?.stages ?? []
  const currentStageId = job.current_stage_id

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button className="ghost-button" onClick={onBack} type="button">
          <ArrowLeft size={16} /> Back to Jobs
        </button>
        <span style={{ color: '#65737d' }}>/</span>
        <span style={{ fontWeight: 600 }}>Job #{job.uid_no}</span>
      </div>

      {/* Header */}
      <div className="surface" style={{ marginBottom: 16 }}>
        <div className="surface-heading">
          <div>
            <p className="section-label">{job.uid_no}</p>
            <h2>{job.title ?? 'Untitled Job'}</h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className="sync-pill" style={{ background: `${PRIORITY_COLORS[job.priority] || '#6b7280'}20`, color: PRIORITY_COLORS[job.priority] || '#6b7280' }}>{job.priority}</span>
            <span className="sync-pill" style={{ background: `${STATUS_COLORS[job.status] || '#6b7280'}20`, color: STATUS_COLORS[job.status] || '#6b7280' }}>{job.status}</span>
            {job.current_stage ? (
              <span className="sync-pill" style={{ background: `${job.current_stage.color}20`, color: job.current_stage.color, border: `1px solid ${job.current_stage.color}40` }}>
                <Circle size={8} fill={job.current_stage.color} stroke={job.current_stage.color} style={{ marginRight: 4 }} />
                {job.current_stage.name}
              </span>
            ) : null}
            {job.due_at ? (
              <span className="sync-pill" style={{ background: '#fef3c7', color: '#92400e' }}>
                <Calendar size={12} style={{ marginRight: 4 }} />
                Due: {new Date(job.due_at).toLocaleDateString()}
              </span>
            ) : null}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, padding: '0 20px 16px' }}>
          {job.client ? (
            <div><span style={{ fontSize: '0.72rem', color: '#65737d', display: 'block' }}>Client</span><strong>{job.client.company_name}</strong></div>
          ) : null}
          {job.assigned_user ? (
            <div><span style={{ fontSize: '0.72rem', color: '#65737d', display: 'block' }}>Assigned To</span><strong style={{ display: 'flex', alignItems: 'center', gap: 4 }}><User size={14} /> {job.assigned_user.name}</strong></div>
          ) : null}
          {job.started_at ? (
            <div><span style={{ fontSize: '0.72rem', color: '#65737d', display: 'block' }}>Started</span><strong>{new Date(job.started_at).toLocaleDateString()}</strong></div>
          ) : null}
          {job.completed_at ? (
            <div><span style={{ fontSize: '0.72rem', color: '#65737d', display: 'block' }}>Completed</span><strong>{new Date(job.completed_at).toLocaleDateString()}</strong></div>
          ) : null}
          {job.active_stage_tracking?.sla_deadline ? (
            <div>
              <span style={{ fontSize: '0.72rem', color: '#65737d', display: 'block' }}>SLA Deadline</span>
              <strong style={{ color: job.active_stage_tracking.is_overdue ? '#ef4444' : '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Clock size={14} />
                {job.active_stage_tracking.is_overdue
                  ? `${Math.floor(job.active_stage_tracking.overdue_minutes / 60)}h ${job.active_stage_tracking.overdue_minutes % 60}m overdue`
                  : new Date(job.active_stage_tracking.sla_deadline).toLocaleString()}
              </strong>
            </div>
          ) : null}
        </div>

        {workflowStages.length > 0 ? (
          <div style={{ padding: '0 20px 16px', overflow: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
              {workflowStages.map((stage, idx) => {
                const isCurrent = stage.id === currentStageId
                const isCompleted = stageTracking.some((st) => st.stage_id === stage.id && st.exited_at)
                return (
                  <div key={stage.id} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20,
                      background: isCurrent ? `${stage.color}20` : isCompleted ? `${stage.color}15` : '#f3f4f6',
                      border: `2px solid ${isCurrent ? stage.color : isCompleted ? stage.color : '#e5e7eb'}`,
                      fontWeight: isCurrent ? 700 : 500, fontSize: '0.75rem',
                      color: isCurrent || isCompleted ? stage.color : '#9ca3af', whiteSpace: 'nowrap',
                    }}>
                      <Circle size={8} fill={isCurrent || isCompleted ? stage.color : '#d1d5db'} stroke={stage.color} />
                      {stage.name}
                    </div>
                    {idx < workflowStages.length - 1 ? <ArrowRight size={12} style={{ margin: '0 3px', color: '#d1d5db', flexShrink: 0 }} /> : null}
                  </div>
                )
              })}
            </div>
          </div>
        ) : null}
      </div>

      {error ? <div className="error-banner" style={{ marginBottom: 16 }}>{error}</div> : null}

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
        {/* Left column */}
        <div>
          <SectionCard title="Timeline" icon={Activity}>
            {timeline.length === 0 ? <p style={{ color: '#65737d' }}>No timeline entries yet.</p> : (
              <div style={{ position: 'relative', paddingLeft: 24 }}>
                <div style={{ position: 'absolute', left: 11, top: 0, bottom: 0, width: 2, background: '#e8eef1' }} />
                {timeline.map((entry) => (
                  <div key={entry.id} style={{ position: 'relative', paddingBottom: 14 }}>
                    <div style={{ position: 'absolute', left: -19, top: 4, width: 12, height: 12, borderRadius: '50%', background: entry.to_stage?.color ?? '#6b7280', border: '2px solid #fff' }} />
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <strong style={{ fontSize: '0.85rem' }}>{entry.action}</strong>
                        <span style={{ fontSize: '0.7rem', color: '#65737d', whiteSpace: 'nowrap' }}>{entry.created_at ? new Date(entry.created_at).toLocaleString() : ''}</span>
                      </div>
                      {entry.user ? <span style={{ fontSize: '0.76rem', color: '#65737d' }}>by {entry.user.name}</span> : null}
                      {entry.notes ? <p style={{ fontSize: '0.78rem', color: '#4a5b66', marginTop: 2 }}>{entry.notes}</p> : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Samples" icon={Box}>
            <SampleManager jobId={jobId} />
          </SectionCard>

          <SectionCard title="Assignments" icon={Users}>
            <AssignmentManager jobId={jobId} />
          </SectionCard>

          <SectionCard title="Test Results" icon={Activity}>
            <TestResultManager jobId={jobId} />
          </SectionCard>

          <SectionCard title="Actions" icon={Send}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, padding: 12, background: '#f9fafb', borderRadius: 8 }}>
              <User size={16} />
              <strong style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>Assign to:</strong>
              <input type="number" value={assignUserId ?? ''} onChange={(e) => setAssignUserId(e.target.value ? Number(e.target.value) : null)} placeholder="User ID" style={{ width: 100, padding: '6px 10px', borderRadius: 6, border: '1px solid #dfe6ea', fontSize: '0.82rem' }} />
              <button className="ghost-button" onClick={() => void handleAssign()} type="button" disabled={!assignUserId}><Check size={14} /> Assign</button>
              <div style={{ flex: 1 }} />
              {job.status !== 'cancelled' ? <button className="ghost-button" onClick={() => void handleCancel()} type="button" style={{ color: '#ef4444' }}><Ban size={14} /> Cancel</button> : null}
            </div>

            {allowedTransitions.length > 0 ? (
              <div>
                <strong style={{ fontSize: '0.85rem', display: 'block', marginBottom: 8 }}>Stage Transitions</strong>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {allowedTransitions.map((t) => (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', border: '1px solid #e8eef1', borderRadius: 8, background: '#fbfcfd' }}>
                      <span className="sync-pill" style={{ background: t.from_stage?.color ?? '#6b7280', color: '#fff', fontSize: '0.72rem' }}>{t.from_stage?.name ?? '?'}</span>
                      <ArrowRight size={12} />
                      <span className="sync-pill" style={{ background: t.to_stage?.color ?? '#6b7280', color: '#fff', fontSize: '0.72rem' }}>{t.to_stage?.name ?? '?'}</span>
                      <strong style={{ flex: 1, fontSize: '0.82rem' }}>{t.name}</strong>
                      {t.requires_approval ? <span className="sync-pill" style={{ background: '#fef3c7', color: '#92400e', fontSize: '0.7rem' }}>Needs Approval</span> : null}
                      <button className="ghost-button" onClick={() => void handleTransition(t.id)} type="button" disabled={transitioning}>
                        <Send size={12} /> {transitioning ? '...' : 'Execute'}
                      </button>
                    </div>
                  ))}
                </div>
                <label style={{ marginTop: 12, fontSize: '0.82rem' }}>
                  Notes
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add notes for this transition..." rows={2} style={{ fontSize: '0.82rem' }} />
                </label>
              </div>
            ) : (
              <div style={{ padding: 16, textAlign: 'center', color: '#65737d', background: '#f9fafb', borderRadius: 8, fontSize: '0.85rem' }}>
                {job.status === 'completed' ? 'This job is completed.' : job.status === 'cancelled' ? 'This job has been cancelled.' : 'No transitions available from the current stage.'}
              </div>
            )}
          </SectionCard>
        </div>

        {/* Right column */}
        <div>
          <SectionCard title="Job Details" icon={Briefcase}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><span style={{ fontSize: '0.72rem', color: '#65737d', display: 'block' }}>UID</span><span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{job.uid_no}</span></div>
              <div><span style={{ fontSize: '0.72rem', color: '#65737d', display: 'block' }}>Template</span><span style={{ fontSize: '0.88rem' }}>{job.workflow_template?.name ?? '-'}</span></div>
              <div><span style={{ fontSize: '0.72rem', color: '#65737d', display: 'block' }}>Current Stage</span><span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{job.current_stage?.name ?? 'Not started'}</span></div>
              <div><span style={{ fontSize: '0.72rem', color: '#65737d', display: 'block' }}>Client</span><span style={{ fontSize: '0.88rem' }}>{job.client?.company_name ?? '-'}</span></div>
              <div><span style={{ fontSize: '0.72rem', color: '#65737d', display: 'block' }}>Created</span><span style={{ fontSize: '0.88rem' }}>{job.created_at ? new Date(job.created_at).toLocaleString() : '-'}</span></div>
              <div><span style={{ fontSize: '0.72rem', color: '#65737d', display: 'block' }}>Due</span><span style={{ fontSize: '0.88rem' }}>{job.due_at ? new Date(job.due_at).toLocaleString() : 'Not set'}</span></div>
            </div>
            {job.description ? (
              <div style={{ marginTop: 12 }}><span style={{ fontSize: '0.72rem', color: '#65737d', display: 'block' }}>Description</span><p style={{ margin: '4px 0', fontSize: '0.85rem' }}>{job.description}</p></div>
            ) : null}
          </SectionCard>

          <SectionCard title="Reports" icon={FileText} defaultOpen={true}>
            <ReportWorkflow jobId={jobId} />
          </SectionCard>

          <SectionCard title="Documents" icon={FileText} defaultOpen={false}>
            <DocumentManager jobId={jobId} />
          </SectionCard>

          <SectionCard title="Billing" icon={CreditCard} defaultOpen={true}>
            <BillingSection jobId={jobId} />
          </SectionCard>

          <SectionCard title="Dispatch" icon={Truck} defaultOpen={true}>
            <DispatchSection jobId={jobId} />
          </SectionCard>

          <SectionCard title="Stage History" icon={Activity} defaultOpen={false}>
            {stageTracking.length === 0 ? (
              <p style={{ color: '#65737d', fontSize: '0.85rem' }}>No stage history yet.</p>
            ) : (
              <div style={{ display: 'grid', gap: 6 }}>
                {stageTracking.map((st) => (
                  <div key={st.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', border: '1px solid #e8eef1', borderRadius: 8, fontSize: '0.82rem' }}>
                    <Circle size={8} fill={st.stage?.color ?? '#6b7280'} stroke={st.stage?.color ?? '#6b7280'} />
                    <strong style={{ flex: 1 }}>{st.stage?.name ?? 'Unknown'}</strong>
                    {st.entered_at ? <span style={{ color: '#65737d' }}>Entered: {new Date(st.entered_at).toLocaleString()}</span> : null}
                    {st.exited_at ? <span style={{ color: '#65737d' }}>Exited: {new Date(st.exited_at).toLocaleString()}</span> : <span style={{ color: '#10b981' }}>Current</span>}
                    {st.is_overdue ? <AlertTriangle size={14} style={{ color: '#ef4444' }} /> : null}
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button className="ghost-button" onClick={onBack} type="button"><ArrowLeft size={14} /> Back to Jobs</button>
        <button className="ghost-button" onClick={() => void loadJob()} type="button"><RotateCcw size={14} /> Refresh</button>
      </div>
    </div>
  )
}
