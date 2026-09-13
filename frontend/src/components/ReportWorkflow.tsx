import { useState, useEffect } from 'react'
import { FileText, Send, ThumbsUp, RotateCcw, Lock, CheckCircle, FlaskConical } from 'lucide-react'
import { request } from '../lib/api'
import { ReportObservations } from './ReportObservations'

interface ReportItem {
  id: number
  uid_no: string
  type: string
  status: string
  workflow_status: string
  created_at: string | null
  assigned_to: number | null
  approved_at: string | null
  observations: Record<string, unknown> | null
}

interface ReportWorkflowProps { jobId: number }

const STATUS_BADGES: Record<string, { bg: string; color: string }> = {
  draft: { bg: '#f3f4f6', color: '#6b7280' },
  under_review: { bg: '#fef3c7', color: '#92400e' },
  corrections_requested: { bg: '#fce7f3', color: '#9d174d' },
  approved: { bg: '#d1fae5', color: '#065f46' },
  locked: { bg: '#dbeafe', color: '#1e40af' },
}

export function ReportWorkflow({ jobId }: ReportWorkflowProps) {
  const [reports, setReports] = useState<ReportItem[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [expanded, setExpanded] = useState<number | null>(null)

  useEffect(() => { loadReports() }, [jobId])

  const loadReports = async () => {
    setLoading(true)
    try {
      const data = await request<{ data: ReportItem[] }>(`/jobs/${jobId}/reports`)
      setReports(data.data)
    } catch {} finally { setLoading(false) }
  }

  const createDraft = async () => {
    const reportType = window.prompt('Report type (e.g. cc_cube, sand, water):')
    if (!reportType) return
    setCreating(true)
    try {
      await request(`/jobs/${jobId}/reports/draft`, {
        method: 'POST',
        body: JSON.stringify({ report_type: reportType }),
      })
      await loadReports()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to create draft')
    } finally { setCreating(false) }
  }

  const handleAction = async (report: ReportItem, action: string) => {
    try {
      const endpoints: Record<string, string> = {
        submit: 'submit', approve: 'approve',
        correct: 'request-correction', lock: 'lock',
      }
      const body: Record<string, string> = {}
      if (action === 'correct') {
        const r = window.prompt('Correction remarks:')
        if (r) body.remarks = r
        else return
      }
      await request(`/report-workflow/${report.id}/${endpoints[action]}`, {
        method: 'POST', body: JSON.stringify(body),
      })
      await loadReports()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Action failed')
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: '0.85rem', color: '#65737d' }}>{reports.length} report(s)</span>
        <button className="ghost-button" onClick={() => void createDraft()} type="button" disabled={creating}>
          <FileText size={14} /> New Draft
        </button>
      </div>

      {loading ? <p style={{ color: '#65737d', fontSize: '0.85rem' }}>Loading...</p> : null}

      {!loading && reports.length === 0 ? (
        <p style={{ color: '#65737d', fontSize: '0.85rem' }}>No reports yet.</p>
      ) : null}

      <div style={{ display: 'grid', gap: 8 }}>
        {reports.map((r) => {
          const badge = STATUS_BADGES[r.workflow_status] ?? STATUS_BADGES.draft
          const isOpen = expanded === r.id
          return (
            <div key={r.id} style={{ padding: '10px 14px', border: '1px solid #e8eef1', borderRadius: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ fontSize: '0.85rem' }}>{r.type}</strong>
                  <span style={{ marginLeft: 8, fontSize: '0.78rem', color: '#65737d' }}>#{r.id}</span>
                </div>
                <span className="sync-pill" style={{ background: badge.bg, color: badge.color, fontSize: '0.72rem' }}>
                  {r.workflow_status.replace(/_/g, ' ')}
                </span>
              </div>

              <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                {(r.workflow_status === 'draft' || r.workflow_status === 'corrections_requested') ? (
                  <>
                    <button className="ghost-button" onClick={() => setExpanded(isOpen ? null : r.id)} type="button" style={{ fontSize: '0.76rem' }}>
                      <FlaskConical size={12} /> Observations
                    </button>
                    <button className="ghost-button" onClick={() => void handleAction(r, 'submit')} type="button" style={{ fontSize: '0.76rem' }}>
                      <Send size={12} /> Submit for Review
                    </button>
                  </>
                ) : null}

                {r.workflow_status === 'under_review' ? (
                  <>
                    <button className="ghost-button" onClick={() => void handleAction(r, 'approve')} type="button" style={{ fontSize: '0.76rem', color: '#065f46' }}>
                      <ThumbsUp size={12} /> Approve
                    </button>
                    <button className="ghost-button" onClick={() => void handleAction(r, 'correct')} type="button" style={{ fontSize: '0.76rem', color: '#9d174d' }}>
                      <RotateCcw size={12} /> Request Correction
                    </button>
                  </>
                ) : null}

                {r.workflow_status === 'approved' ? (
                  <button className="ghost-button" onClick={() => void handleAction(r, 'lock')} type="button" style={{ fontSize: '0.76rem', color: '#1e40af' }}>
                    <Lock size={12} /> Lock Report
                  </button>
                ) : null}

                {r.approved_at ? (
                  <span style={{ fontSize: '0.72rem', color: '#65737d', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <CheckCircle size={12} /> Approved {new Date(r.approved_at).toLocaleDateString()}
                  </span>
                ) : null}
              </div>

              {isOpen ? (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #e8eef1' }}>
                  <ReportObservations
                    reportId={r.id}
                    existing={r.observations as any}
                    onSaved={() => { setExpanded(null); loadReports() }}
                  />
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
