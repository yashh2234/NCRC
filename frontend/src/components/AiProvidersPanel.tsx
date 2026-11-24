import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, Bot } from 'lucide-react'
import { KEY_PAGES, aiProvidersApi, type AiProvider } from '../lib/aiProviders'
import { formatDateTime } from '../lib/inquiries'

type Row = AiProvider & { api_key: string; remove_key: boolean }

const toRows = (list: AiProvider[]): Row[] => list.map((p) => ({ ...p, api_key: '', remove_key: false }))

function StatusText({ row }: { row: Row }) {
  const [text, color] = !row.has_key ? ['No key', '#64748b']
    : !row.enabled ? ['Off', '#64748b']
      : row.paused_until ? [`Resting till ${formatDateTime(row.paused_until)}${row.last_error ? ` · ${row.last_error}` : ''}`, '#b45309']
        : row.last_error ? [row.last_error, '#b91c1c']
          : row.last_ok_at ? [`Working · last used ${formatDateTime(row.last_ok_at)}`, '#15803d'] : ['Not tested yet', '#64748b']
  return <span style={{ color, fontSize: '0.8rem', fontWeight: 600 }}>{text}</span>
}

/** Administration (full admins): keys and order of the free AI services. */
export function AiProvidersPanel() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState('')
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    aiProvidersApi.list().then((list) => setRows(toRows(list))).catch((e: Error) => setError(e.message)).finally(() => setLoading(false))
  }, [])

  const patch = (i: number, changes: Partial<Row>) => {
    setRows((list) => list.map((r, idx) => (idx === i ? { ...r, ...changes } : r)))
    setDirty(true)
    setNotice('')
  }
  const move = (i: number, by: -1 | 1) => {
    setRows((list) => {
      const next = [...list]
      next.splice(i + by, 0, ...next.splice(i, 1))
      return next
    })
    setDirty(true)
  }

  const save = async () => {
    setBusy('save')
    setError('')
    try {
      const list = await aiProvidersApi.save(rows.map(({ provider, api_key, remove_key, model, enabled }) => ({ provider, api_key: api_key.trim(), remove_key, model: model.trim(), enabled })))
      setRows(toRows(list))
      setDirty(false)
      setNotice('Saved.')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy('')
    }
  }

  const test = async (row: Row) => {
    setBusy(row.provider)
    setError('')
    setNotice('')
    try {
      const { ok, data } = await aiProvidersApi.test(row.provider)
      setRows((list) => list.map((r) => (r.provider === row.provider ? { ...r, ...data } : r)))
      setNotice(ok ? `${row.label} is working.` : '')
      if (!ok) setError(`${row.label}: ${data.last_error ?? 'no answer'}`)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy('')
    }
  }

  return (
    <section className="surface" style={{ marginBottom: 16 }}>
      <div className="surface-heading">
        <div>
          <p className="section-label"><Bot size={12} style={{ verticalAlign: '-1px' }} /> AI</p>
          <h2>Free AI keys</h2>
        </div>
        <button type="button" className="btn btn-primary" disabled={!dirty || Boolean(busy)} onClick={() => void save()}>{busy === 'save' ? 'Saving…' : 'Save'}</button>
      </div>
      <p className="text-muted" style={{ margin: '0 0 12px', fontSize: '0.8rem' }}>
        The first one is asked; when it is full or not answering, the next. No feature uses them at the moment; Proposals and Tenders keep their own key.
        Free services may use what is sent to improve their products.
      </p>
      {error ? <p role="alert" style={{ color: '#b91c1c', margin: '0 0 10px' }}>{error}</p> : null}
      {notice ? <p style={{ color: '#15803d', margin: '0 0 10px' }}>{notice}</p> : null}
      {loading ? <p className="text-muted">Loading…</p> : (
        <div style={{ display: 'grid', gap: 10 }}>
          {rows.map((row, i) => (
            <div key={row.provider} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 12, display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <strong style={{ minWidth: 150 }}>{i + 1}. {row.label}</strong>
                <span style={{ flex: 1, minWidth: 160 }}><StatusText row={row} /></span>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.84rem' }}>
                  <input type="checkbox" checked={row.enabled} onChange={(e) => patch(i, { enabled: e.target.checked })} style={{ width: 'auto', margin: 0 }} /> On
                </label>
                <button type="button" className="icon-button" title="Ask earlier" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={14} /></button>
                <button type="button" className="icon-button" title="Ask later" disabled={i === rows.length - 1} onClick={() => move(i, 1)}><ArrowDown size={14} /></button>
                <button type="button" className="btn btn-outline btn-sm" title={dirty ? 'Save first' : undefined} disabled={!row.has_key || dirty || Boolean(busy)} onClick={() => void test(row)}>{busy === row.provider ? 'Testing…' : 'Test'}</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10, alignItems: 'start' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}><span>API key (<a href={KEY_PAGES[row.provider]} target="_blank" rel="noreferrer">get a free key</a>)</span>
                  <input className="input" type="password" autoComplete="new-password" value={row.api_key} placeholder={row.remove_key ? 'Will be removed' : row.has_key ? `Saved (…${row.key_end}). Leave empty to keep it` : 'Paste the key'} onChange={(e) => patch(i, { api_key: e.target.value, remove_key: false })} />
                </label>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Model (empty = chosen automatically)
                  <input className="input" value={row.model} placeholder="Automatic" onChange={(e) => patch(i, { model: e.target.value })} />
                </label>
              </div>
              {row.has_key && !row.remove_key ? <button type="button" className="ghost-button" style={{ justifySelf: 'start', fontSize: '0.8rem' }} onClick={() => patch(i, { remove_key: true, api_key: '' })}>Remove key</button> : null}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
