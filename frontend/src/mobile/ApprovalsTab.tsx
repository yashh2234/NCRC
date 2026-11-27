import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, ChevronRight, Inbox, RefreshCw, X } from 'lucide-react'
import { approvalsApi, type ApprovalItem } from './mobileApi'
import { InboxReview } from './InboxReview'
import { hrApi } from '../lib/hr'

const IN_PLACE: ApprovalItem['kind'][] = ['quotation', 'bill', 'credit_note', 'performa']

const KIND_LABEL: Record<ApprovalItem['kind'], string> = {
  leave: 'Leave', attendance: 'Attendance', quotation: 'Quotations', bill: 'Invoices', credit_note: 'Credit notes', performa: 'Performa', report: 'Reports',
}

/** Everything waiting for this user to approve, in one list */
export function ApprovalsTab({ onOpen, onCount }: { onOpen: (module: string) => void; onCount: (n: number) => void }) {
  const [items, setItems] = useState<ApprovalItem[] | null>(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<string>('all')
  const [busy, setBusy] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<ApprovalItem | null>(null)
  const [reviewing, setReviewing] = useState<ApprovalItem | null>(null)

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await approvalsApi.list()
      setItems(res.data)
      onCount(res.data.length)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [onCount])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
    const back = () => { if (document.visibilityState === 'visible') void load() }
    document.addEventListener('visibilitychange', back)
    return () => document.removeEventListener('visibilitychange', back)
  }, [load])

  const kinds = useMemo(() => [...new Set((items ?? []).map((i) => i.kind))], [items])
  const shown = (items ?? []).filter((i) => filter === 'all' || i.kind === filter)

  const drop = (item: ApprovalItem) => setItems((list) => {
    const next = (list ?? []).filter((i) => i.key !== item.key)
    onCount(next.length)
    return next
  })
  /** Invoices, credit notes, performa and quotations open their review here; reports open the reports page */
  const review = (item: ApprovalItem) => (IN_PLACE.includes(item.kind) ? setReviewing(item) : onOpen(item.module))

  const decide = async (item: ApprovalItem, approve: boolean, remark = '') => {
    setBusy(item.key)
    setError('')
    try {
      if (item.kind === 'leave') await hrApi.decideLeave(item.id, approve, remark)
      else if (item.kind === 'attendance') await hrApi.decideCorrection(item.id, approve, remark)
      if ('vibrate' in navigator) navigator.vibrate(30)
      drop(item)
      setRejecting(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="m-page">
      <div className="m-page__head">
        <h1>Approvals</h1>
        <button type="button" className="m-icon-btn" onClick={() => { setItems(null); void load() }} aria-label="Refresh"><RefreshCw size={18} /></button>
      </div>

      {kinds.length > 1 ? (
        <div className="m-chips" role="tablist">
          <button type="button" className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>All · {items?.length ?? 0}</button>
          {kinds.map((k) => (
            <button type="button" key={k} className={filter === k ? 'active' : ''} onClick={() => setFilter(k)}>
              {KIND_LABEL[k]} · {items?.filter((i) => i.kind === k).length}
            </button>
          ))}
        </div>
      ) : null}

      {error ? <p className="m-error" role="alert">{error}</p> : null}
      {items === null && !error ? <div className="m-skeleton-list"><span /><span /><span /></div> : null}

      {items !== null && shown.length === 0 ? (
        <div className="m-empty">
          <Inbox size={40} />
          <strong>Nothing waits for you</strong>
          <span>New approvals show up here and on your phone.</span>
        </div>
      ) : null}

      <ul className="m-list">
        {shown.map((item) => (
          <li key={item.key} className="m-card m-approval">
            <button type="button" className="m-approval__main" onClick={() => !item.quick && review(item)} disabled={item.quick}>
              <span className={`m-tag m-tag--${item.kind}`}>{KIND_LABEL[item.kind]}</span>
              <strong>{item.title}</strong>
              {item.detail ? <span className="m-approval__detail">{item.detail}</span> : null}
              {item.since_human ? <span className="m-muted m-small">Waiting {item.since_human.replace(' ago', '')}</span> : null}
              {!item.quick ? <ChevronRight className="m-approval__chev" size={18} /> : null}
            </button>
            {item.quick ? (
              <div className="m-approval__actions">
                <button type="button" className="m-btn m-btn--ghost m-btn--danger-text" disabled={busy === item.key} onClick={() => setRejecting(item)}><X size={16} /> Reject</button>
                <button type="button" className="m-btn m-btn--success" disabled={busy === item.key} onClick={() => void decide(item, true)}><Check size={16} /> {busy === item.key ? 'Saving…' : 'Approve'}</button>
              </div>
            ) : (
              <div className="m-approval__actions">
                <button type="button" className="m-btn m-btn--primary" onClick={() => review(item)}>Review &amp; decide</button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {reviewing ? (
        <InboxReview item={reviewing} onClose={() => setReviewing(null)}
          onEdit={() => { setReviewing(null); onOpen(reviewing.module) }}
          onDecided={() => { setReviewing(null); drop(reviewing) }} />
      ) : null}
      {rejecting ? <RejectSheet item={rejecting} busy={busy === rejecting.key} onClose={() => setRejecting(null)} onReject={(remark) => void decide(rejecting, false, remark)} /> : null}
    </div>
  )
}

function RejectSheet({ item, busy, onClose, onReject }: { item: ApprovalItem; busy: boolean; onClose: () => void; onReject: (remark: string) => void }) {
  const [remark, setRemark] = useState('')
  const needed = item.kind === 'leave'
  return (
    <div className="m-sheet-backdrop" role="dialog" aria-modal="true" aria-label="Reject">
      <div className="m-sheet">
        <div className="m-sheet__head">
          <div><h2>Reject</h2><p>{item.title}</p></div>
          <button type="button" className="m-icon-btn" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>
        <div className="m-sheet__body">
          <label className="m-field">
            <span>Reason {needed ? '(needed)' : '(optional)'}</span>
            <textarea rows={3} maxLength={480} value={remark} onChange={(e) => setRemark(e.target.value)} autoFocus />
          </label>
        </div>
        <div className="m-sheet__foot">
          <button type="button" className="m-btn m-btn--danger m-btn--block" disabled={busy || (needed && !remark.trim())} onClick={() => onReject(remark.trim())}>
            {busy ? 'Saving…' : 'Reject'}
          </button>
        </div>
      </div>
    </div>
  )
}
