import { FileText, User, Play, Check, X, Clock, History } from 'lucide-react'

export interface TimelineEntry {
  event: string
  timestamp: string | null
  icon: string
  user?: string
  note?: string | null
}

interface TimelineProps {
  entries: TimelineEntry[]
  uidNo?: string
  onClose: () => void
}

const iconMap: Record<string, React.ReactNode> = {
  file: <FileText size={15} style={{ color: 'var(--color-primary)' }} />,
  file_text: <FileText size={15} style={{ color: '#0891b2' }} />,
  user: <User size={15} style={{ color: '#2563eb' }} />,
  play: <Play size={15} style={{ color: '#059669' }} />,
  check: <Check size={15} style={{ color: '#16a34a' }} />,
  x: <X size={15} style={{ color: '#dc2626' }} />,
  audit: <History size={15} style={{ color: '#7c3aed' }} />,
}

export function Timeline({ entries, uidNo, onClose }: TimelineProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: 540 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose} type="button">
          <X size={18} />
        </button>

        {/* Header */}
        <div style={{ paddingBottom: 16, marginBottom: 20, borderBottom: '1px solid var(--color-border-light)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span className="section-label" style={{ margin: 0 }}>Audit Trail</span>
            {uidNo ? (
              <span className="uid-link" style={{ fontSize: '0.8rem', padding: '2px 8px', background: 'var(--color-primary-tint)', borderRadius: 6 }}>
                {uidNo}
              </span>
            ) : null}
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Activity & Handover Timeline</h2>
          <p style={{ fontSize: '0.78rem', color: 'var(--gray-400)', marginTop: 2 }}>
            Complete audit trail of stage transitions, handovers, and operations.
          </p>
        </div>

        {entries.length === 0 ? (
          <div className="empty-state" style={{ padding: 40 }}>
            <History size={32} style={{ color: 'var(--gray-300)', margin: '0 auto 8px', display: 'block' }} />
            <strong style={{ display: 'block', color: 'var(--gray-700)' }}>No history logged yet</strong>
            <p style={{ fontSize: '0.78rem', color: 'var(--gray-400)', marginTop: 4 }}>
              Stage transitions and updates will appear here automatically.
            </p>
          </div>
        ) : (
          <div style={{ position: 'relative', paddingLeft: 32, maxHeight: '60vh', overflowY: 'auto', paddingRight: 8 }}>
            {/* Connecting line */}
            <div style={{
              position: 'absolute',
              left: 14,
              top: 14,
              bottom: 14,
              width: 2,
              background: 'var(--color-border-light)',
            }} />

            {entries.map((entry, i) => (
              <div key={i} style={{ position: 'relative', paddingBottom: 22 }}>
                {/* Node icon circle */}
                <div
                  style={{
                    position: 'absolute',
                    left: -32,
                    top: 0,
                    width: 30,
                    height: 30,
                    borderRadius: '50%',
                    background: 'var(--color-surface)',
                    border: '2px solid var(--color-border)',
                    boxShadow: 'var(--shadow-xs)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 2,
                  }}
                >
                  {iconMap[entry.icon] ?? <Clock size={14} style={{ color: 'var(--gray-400)' }} />}
                </div>

                {/* Content card */}
                <div style={{
                  background: 'var(--gray-50)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '10px 14px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <strong style={{ fontSize: '0.86rem', color: 'var(--gray-900)' }}>
                      {entry.event}
                    </strong>
                    {entry.timestamp ? (
                      <span style={{ fontSize: '0.72rem', color: 'var(--gray-400)', whiteSpace: 'nowrap', fontFamily: 'var(--font-data)' }}>
                        {new Date(entry.timestamp).toLocaleString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    ) : null}
                  </div>

                  {entry.user ? (
                    <div style={{ fontSize: '0.74rem', color: 'var(--gray-500)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <User size={12} style={{ color: 'var(--color-primary)' }} />
                      <span>Action by: <strong>{entry.user}</strong></span>
                    </div>
                  ) : null}

                  {entry.note ? (
                    <div style={{
                      fontSize: '0.76rem',
                      color: 'var(--gray-600)',
                      marginTop: 6,
                      padding: '6px 10px',
                      background: 'var(--color-surface)',
                      borderRadius: 6,
                      border: '1px solid var(--color-border-light)',
                      fontStyle: 'italic',
                    }}>
                      "{entry.note}"
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
