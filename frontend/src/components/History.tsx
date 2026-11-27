import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRight, Check, CircleDollarSign, FilePlus2, History as HistoryIcon, Paperclip, Pencil, RotateCcw, Send, Trash2, Undo2, X, XCircle } from 'lucide-react'
import { request } from '../lib/api'

/** Kinds of records with a history (backend Timeline::TYPES) */
export type HistoryType =
  | 'Inquiry' | 'Proposal' | 'Quotation' | 'Tender' | 'WorkOrder'
  | 'Bill' | 'PerformaInvoice' | 'PurchaseOrder' | 'DailyExpense'
  | 'Registration' | 'Report' | 'UlrLink' | 'OutsourceAssignment' | 'Vendor'

interface Entry {
  id: number
  action: string
  event: string
  timestamp: string | null
  user: string | null
  changes: Array<{ label: string; from: string; to: string }>
}

const LOOK: Record<string, { icon: typeof Check; color: string; bg: string }> = {
  created: { icon: FilePlus2, color: '#2563eb', bg: '#dbeafe' },
  updated: { icon: Pencil, color: '#475569', bg: '#e2e8f0' },
  approval: { icon: Send, color: '#b45309', bg: '#fef3c7' },
  approved: { icon: Check, color: '#15803d', bg: '#dcfce7' },
  sent_back: { icon: Undo2, color: '#b91c1c', bg: '#fee2e2' },
  payment: { icon: CircleDollarSign, color: '#15803d', bg: '#dcfce7' },
  cancelled: { icon: XCircle, color: '#b91c1c', bg: '#fee2e2' },
  restored: { icon: RotateCcw, color: '#2563eb', bg: '#dbeafe' },
  deleted: { icon: Trash2, color: '#b91c1c', bg: '#fee2e2' },
  attachment: { icon: Paperclip, color: '#7c3aed', bg: '#ede9fe' },
  status: { icon: ArrowRight, color: '#0369a1', bg: '#e0f2fe' },
}

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : '')
const dayOf = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : '')

/** Clock button for a row / card: opens the record's history */
export function HistoryButton({ type, id, title, className = 'icon-button' }: { type: HistoryType; id: number | string; title: string; className?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className={className} title="History" aria-label={`History of ${title}`} onClick={(e) => { e.stopPropagation(); setOpen(true) }}><HistoryIcon size={16} /></button>
      {open ? <HistoryPanel type={type} id={Number(id)} title={title} onClose={() => setOpen(false)} /> : null}
    </>
  )
}

/** What happened to a record, newest first: from the right on a computer, the whole screen on a phone */
export function HistoryPanel({ type, id, title, onClose }: { type: HistoryType; id: number; title: string; onClose: () => void }) {
  const [entries, setEntries] = useState<Entry[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    request<{ data: Entry[] }>(`/timeline/${type}/${id}`).then((r) => setEntries(r.data)).catch((e: Error) => setError(e.message))
  }, [type, id])
  const closeRef = useRef(onClose)
  useEffect(() => { closeRef.current = onClose })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRef.current() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // The date heading shows above the first step of each day
  const rows = (entries ?? []).map((e, i, all) => ({ e, day: dayOf(e.timestamp), newDay: i === 0 || dayOf(all[i - 1].timestamp) !== dayOf(e.timestamp) }))
  // On the page body: list rows and cards do not style it or get its clicks
  return createPortal(
    <div className="history-overlay" onClick={(e) => { e.stopPropagation(); onClose() }}>
      <aside className="history-panel" role="dialog" aria-modal="true" aria-label={`History of ${title.replace(/(\s*·\s*)+$/, '')}`} onClick={(e) => e.stopPropagation()}>
        <header className="history-panel__head">
          <div>
            <span className="history-panel__kicker"><HistoryIcon size={13} /> History</span>
            <h2>{title.replace(/(\s*·\s*)+$/, '')}</h2>
          </div>
          <button type="button" className="history-panel__close" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </header>
        <div className="history-panel__body">
          {error ? <p className="history-panel__error">{error}</p> : null}
          {entries === null && !error ? <p className="history-panel__empty">Loading…</p> : null}
          {entries && entries.length === 0 ? (
            <p className="history-panel__empty">Nothing recorded yet. Changes made from now on show here.</p>
          ) : null}
          <ol className="history-list">
            {rows.map(({ e, day, newDay }) => {
              const look = LOOK[e.action] ?? LOOK.updated
              const Icon = look.icon
              return (
                <li key={e.id}>
                  {newDay ? <div className="history-day">{day}</div> : null}
                  <div className="history-item">
                    <span className="history-item__dot" style={{ color: look.color, background: look.bg }}><Icon size={14} /></span>
                    <div className="history-item__main">
                      <div className="history-item__row">
                        <strong>{e.event}</strong>
                        <span>{when(e.timestamp).split(', ').at(-1)}</span>
                      </div>
                      {e.user ? <span className="history-item__by">by {e.user}</span> : null}
                      {e.changes.length ? (
                        <dl className="history-changes">
                          {e.changes.map((c, k) => (
                            <div key={k}>
                              <dt>{c.label}</dt>
                              <dd><span className="from">{c.from || '-'}</span> <ArrowRight size={12} /> <span className="to">{c.to || '-'}</span></dd>
                            </div>
                          ))}
                        </dl>
                      ) : null}
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
        </div>
      </aside>
    </div>,
    document.body,
  )
}
