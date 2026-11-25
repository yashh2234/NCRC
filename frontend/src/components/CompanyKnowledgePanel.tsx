import { useCallback, useEffect, useState } from 'react'
import { BookOpen, Check, Pencil, Plus, RefreshCw, Trash2, X } from 'lucide-react'
import { Modal } from './Modal'
import { Pill } from './HrBits'
import { Req } from './ui'
import { knowledgeApi, type Knowledge } from '../lib/proposals'
import { stamp } from '../lib/hr'

/** Administration (full admins): what the proposal AI knows about the company. */
export function CompanyKnowledgePanel() {
  const [list, setList] = useState<Knowledge[]>([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [showPages, setShowPages] = useState(false)
  const [query, setQuery] = useState('')
  const [edit, setEdit] = useState<{ id: number | null; title: string; content: string } | null>(null)

  const load = useCallback(() => knowledgeApi.list().then(setList).catch((e: Error) => setError(e.message)), [])
  useEffect(() => { void load() }, [load])

  const run = async (action: () => Promise<unknown>, done = '') => {
    setBusy(true)
    setError('')
    setNotice('')
    try { await action(); setNotice(done); setEdit(null) } catch (e) { setError((e as Error).message) } finally { setBusy(false); void load() }
  }

  const q = query.trim().toLowerCase()
  const fits = (k: Knowledge) => !q || `${k.title} ${k.content}`.toLowerCase().includes(q)
  const pending = list.filter((k) => k.status === 'pending')
  const facts = list.filter((k) => k.kind === 'fact' && k.status !== 'pending' && fits(k))
  const pages = list.filter((k) => k.kind === 'website')
  const lastRead = pages.map((p) => p.updated_at ?? '').sort().at(-1)

  return (
    <section className="surface" style={{ marginBottom: 16 }}>
      <div className="surface-heading">
        <div>
          <p className="section-label"><BookOpen size={12} style={{ verticalAlign: '-1px' }} /> AI</p>
          <h2>Company knowledge for proposals</h2>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-outline" disabled={busy} onClick={() => void run(async () => { const r = await knowledgeApi.refresh(); window.setTimeout(() => setNotice(r.message)) })}><RefreshCw size={15} /> {busy ? 'Please wait…' : 'Refresh from website'}</button>
          <button type="button" className="btn btn-primary" onClick={() => setEdit({ id: null, title: '', content: '' })}><Plus size={15} /> Add fact</button>
        </div>
      </div>
      <p className="text-muted" style={{ margin: '0 0 12px', fontSize: '0.8rem' }}>
        The proposal AI is given the facts below, the fitting pages of namotech.in ({pages.length} pages{lastRead ? `, read ${stamp(lastRead)}` : ''}; read again every week) and similar earlier proposals. What users suggest is used only after you approve it.
      </p>
      {error ? <p role="alert" className="hr-error">{error}</p> : null}
      {notice ? <p style={{ color: '#15803d', margin: '0 0 10px' }}>{notice}</p> : null}

      {pending.length ? (
        <ul className="hr-list" style={{ marginBottom: 14, padding: '4px 12px', borderRadius: 10, background: '#fffbeb' }}>
          {pending.map((k) => (
            <li key={k.id}>
              <span><Pill color="#b45309" background="#fef3c7">To approve</Pill><small className="hr-muted" style={{ display: 'block' }}>{k.created_by}</small></span>
              <span><strong>{k.title}</strong><span style={{ display: 'block', whiteSpace: 'pre-wrap' }}>{k.content}</span></span>
              <span style={{ whiteSpace: 'nowrap' }}>
                <button type="button" className="btn btn-success btn-sm" disabled={busy} onClick={() => void run(() => knowledgeApi.decide(k.id, true))}><Check size={14} /> Approve</button>{' '}
                <button type="button" className="icon-button" title="Edit and approve" onClick={() => setEdit({ id: k.id, title: k.title, content: k.content })}><Pencil size={14} /></button>
                <button type="button" className="icon-button" title="Reject" onClick={() => void run(() => knowledgeApi.remove(k.id))}><X size={14} /></button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="hr-bar">
        <input className="input" style={{ width: 260 }} placeholder="Search…" aria-label="Search company knowledge" value={query} onChange={(e) => setQuery(e.target.value)} />
        <button type="button" className="ghost-button" onClick={() => setShowPages((s) => !s)}>{showPages ? 'Hide' : 'Show'} website pages</button>
      </div>
      <ul className="hr-list" style={{ maxHeight: 420, overflowY: 'auto' }}>
        {facts.length === 0 ? <li className="hr-muted">No facts {q ? 'match' : 'yet'}. Add e.g. the standard payment terms, validity of proposals or empanelments.</li> : null}
        {facts.map((k) => (
          <li key={k.id}>
            <span><Pill color="#15803d" background="#dcfce7">Fact</Pill></span>
            <span><strong>{k.title}</strong><span style={{ display: 'block', whiteSpace: 'pre-wrap' }}>{k.content}</span></span>
            <span style={{ whiteSpace: 'nowrap' }}>
              <button type="button" className="icon-button" title="Edit" onClick={() => setEdit({ id: k.id, title: k.title, content: k.content })}><Pencil size={14} /></button>
              <button type="button" className="icon-button" title="Delete" onClick={() => { if (window.confirm(`Delete “${k.title}”?`)) void run(() => knowledgeApi.remove(k.id)) }}><Trash2 size={14} /></button>
            </span>
          </li>
        ))}
        {showPages ? pages.filter(fits).map((k) => (
          <li key={k.id} style={{ opacity: k.status === 'approved' ? 1 : 0.5 }}>
            <span><Pill color="#1d4ed8" background="#dbeafe">Website</Pill></span>
            <span><a href={k.url ?? '#'} target="_blank" rel="noreferrer"><strong>{k.title}</strong></a><span className="hr-muted" style={{ display: 'block' }}>{k.content.slice(0, 160)}…</span></span>
            <label className="checkbox-label" style={{ whiteSpace: 'nowrap' }}><input type="checkbox" checked={k.status === 'approved'} disabled={busy} onChange={(e) => void run(() => knowledgeApi.decide(k.id, e.target.checked))} /> Use</label>
          </li>
        )) : null}
      </ul>

      {edit ? (
        <Modal title={edit.id ? 'Edit fact' : 'Add fact'} subtitle="Company knowledge" size={560} onClose={() => setEdit(null)} saving={busy}
          onSubmit={(e) => { e.preventDefault(); void run(() => (edit.id ? knowledgeApi.update(edit.id, edit.title, edit.content) : knowledgeApi.add(edit.title, edit.content)), 'Saved.') }}>
          <div className="hr-form">
            <label className="wide"><span>About<Req /></span><input className="input" required maxLength={190} value={edit.title} placeholder="e.g. Standard payment terms" onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></label>
            <label className="wide"><span>Fact<Req /></span><textarea className="input" required rows={5} maxLength={3000} value={edit.content} onChange={(e) => setEdit({ ...edit, content: e.target.value })} /></label>
          </div>
        </Modal>
      ) : null}
    </section>
  )
}
