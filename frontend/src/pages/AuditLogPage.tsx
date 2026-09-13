import { useCallback, useEffect, useState } from 'react'
import { History } from 'lucide-react'
import { api } from '../lib/api'
import type { AuditLogEntry } from '../lib/types'

export function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [localError, setLocalError] = useState('')
  const [actionFilter, setActionFilter] = useState('')

  const loadLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (actionFilter) params.action = actionFilter
      const data = await api.auditLogs(params)
      setLogs(data.data)
    } catch {
      setLocalError('Unable to load audit logs')
    } finally {
      setLoading(false)
    }
  }, [actionFilter])

  useEffect(() => { void loadLogs() }, [loadLogs])

  const actions = [...new Set(logs.map((l) => l.action))]

  return (
    <div className="single-column">
      <section className="surface">
        <div className="surface-heading">
          <div>
            <p className="section-label">History</p>
            <h2>Audit log</h2>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <History size={18} />
            <span className="sync-pill">{logs.length} entries</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          {['', ...actions].map((a) => (
            <button
              key={a || 'all'}
              type="button"
              onClick={() => setActionFilter(a)}
              style={{
                padding: '6px 14px',
                borderRadius: 20,
                border: `1px solid ${actionFilter === a ? '#327268' : '#d0d7de'}`,
                background: actionFilter === a ? '#edf6f4' : 'transparent',
                fontSize: '0.82rem',
                cursor: 'pointer',
                fontWeight: actionFilter === a ? 700 : 500,
              }}
            >
              {a || 'All'}
            </button>
          ))}
        </div>

        {localError ? <div className="error-banner">{localError}</div> : null}

        {loading ? (
          <p className="empty-state">Loading...</p>
        ) : logs.length === 0 ? (
          <p className="empty-state">No audit log entries found.</p>
        ) : (
          <div className="report-stack">
            {logs.map((entry) => (
              <article className="report-row" key={entry.id}>
                <div>
                  <strong>{entry.action}</strong>
                  <span>{entry.user_name} {entry.description ? `- ${entry.description}` : ''}</span>
                  <small>
                    {entry.model_type ? `${entry.model_type}#${entry.model_id}` : ''} | {entry.ip_address ?? ''} | {entry.created_at ?? ''}
                  </small>
                </div>
                <div className="row-actions">
                  <span className="sync-pill">{entry.action}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}