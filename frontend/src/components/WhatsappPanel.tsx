import { useEffect, useState } from 'react'
import { ClipboardCopy, MessageCircle, Plus, Trash2 } from 'lucide-react'
import { api, request } from '../lib/api'
import { formatDateTime } from '../lib/inquiries'

interface Sender { number: string; user_id: number | null }

interface Settings {
  enabled: boolean
  has_secret: boolean
  verify_token: string
  phone_number_id: string
  senders: Sender[]
  verified_at: string | null
  last_message_at: string | null
  last_problem: string | null
  last_problem_at: string | null
}

const small: React.CSSProperties = { fontSize: '0.8rem', fontWeight: 600 }

/** Administration (full admins): inquiries sent as WhatsApp messages to the office's WhatsApp Business number. */
export function WhatsappPanel() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [users, setUsers] = useState<Array<{ id: number; name: string }>>([])
  const [secret, setSecret] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    request<{ data: Settings }>('/whatsapp/settings').then(({ data }) => setSettings(data)).catch((e: Error) => setError(e.message))
    api.assignableUsers().then(({ data }) => setUsers(data)).catch(() => setUsers([]))
  }, [])

  const patch = (changes: Partial<Settings>) => { setSettings((s) => (s ? { ...s, ...changes } : s)); setNotice('') }
  const setSender = (i: number, changes: Partial<Sender>) => settings && patch({ senders: settings.senders.map((s, idx) => (idx === i ? { ...s, ...changes } : s)) })

  const save = async () => {
    if (!settings) return
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const { enabled, phone_number_id, senders } = settings
      const { data } = await request<{ data: Settings }>('/whatsapp/settings', { method: 'PUT', body: JSON.stringify({ enabled, phone_number_id: phone_number_id.trim(), senders, app_secret: secret.trim() }) })
      setSettings(data)
      setSecret('')
      setNotice('Saved.')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const copy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => setNotice('Copied.')).catch(() => setError('Could not copy. Select the text and copy it.'))
  }

  const callback = `${window.location.origin}/api/whatsapp/webhook`
  const copyField = (label: string, value: string) => (
    <label style={small}><span>{label}</span>
      <span style={{ display: 'flex', gap: 6 }}>
        <input className="input" readOnly value={value} onFocus={(e) => e.target.select()} style={{ background: '#f8fafc' }} />
        <button type="button" className="icon-button" title={`Copy ${label.toLowerCase()}`} onClick={() => copy(value)}><ClipboardCopy size={15} /></button>
      </span>
    </label>
  )

  return (
    <section className="surface" style={{ marginBottom: 16 }}>
      <div className="surface-heading">
        <div>
          <p className="section-label"><MessageCircle size={12} style={{ verticalAlign: '-1px' }} /> WhatsApp</p>
          <h2>Inquiries from WhatsApp</h2>
        </div>
        <button type="button" className="btn btn-primary" disabled={!settings || saving} onClick={() => void save()}>{saving ? 'Saving…' : 'Save'}</button>
      </div>
      <p className="text-muted" style={{ margin: '0 0 12px', fontSize: '0.8rem' }}>
        A message from an allowed number to the office’s WhatsApp Business number is saved as an inquiry. Unclear ones are saved as “Needs check”. Other numbers are ignored, and no WhatsApp reply is sent (Meta charges for replies); the bell shows what was saved.
      </p>
      {error ? <p role="alert" style={{ color: '#b91c1c', margin: '0 0 10px' }}>{error}</p> : null}
      {notice ? <p style={{ color: '#15803d', margin: '0 0 10px' }}>{notice}</p> : null}
      {!settings ? (error ? null : <p className="text-muted">Loading…</p>) : (
        <div style={{ display: 'grid', gap: 14 }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.86rem', fontWeight: 600 }}>
            <input type="checkbox" checked={settings.enabled} onChange={(e) => patch({ enabled: e.target.checked })} style={{ width: 'auto', margin: 0 }} /> Switched on
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, alignItems: 'start' }}>
            {copyField('Callback URL (for Meta)', callback)}
            {copyField('Verify token (for Meta)', settings.verify_token)}
            <label style={small}><span>App secret (from Meta)</span>
              <input className="input" type="password" autoComplete="new-password" value={secret} placeholder={settings.has_secret ? 'Saved. Leave empty to keep it' : 'App settings → Basic → App secret'} onChange={(e) => setSecret(e.target.value)} />
            </label>
            <label style={small}><span>Phone number ID (from Meta)</span>
              <input className="input" inputMode="numeric" value={settings.phone_number_id} placeholder="WhatsApp → API setup" onChange={(e) => patch({ phone_number_id: e.target.value })} />
            </label>
          </div>

          <div>
            <p style={{ ...small, margin: '0 0 6px' }}>Allowed numbers</p>
            {settings.senders.map((s, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                <input className="input" type="tel" style={{ width: 220 }} aria-label={`Sender ${i + 1} number`} placeholder="Mobile number" value={s.number} onChange={(e) => setSender(i, { number: e.target.value })} />
                <select className="input" style={{ width: 220 }} aria-label={`Sender ${i + 1} user`} value={s.user_id ?? ''} onChange={(e) => setSender(i, { user_id: e.target.value ? Number(e.target.value) : null })}>
                  <option value="">Counts as user…</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
                <button type="button" className="icon-button" title="Remove number" onClick={() => patch({ senders: settings.senders.filter((_, idx) => idx !== i) })}><Trash2 size={15} /></button>
              </div>
            ))}
            <button type="button" className="ghost-button" onClick={() => patch({ senders: [...settings.senders, { number: '', user_id: null }] })}><Plus size={14} /> Add number</button>
          </div>

          <p className="text-muted" style={{ margin: 0, fontSize: '0.8rem' }}>
            {settings.verified_at ? `Address checked by Meta ${formatDateTime(settings.verified_at)}` : 'Meta has not checked the address yet'}
            {' · '}{settings.last_message_at ? `last message ${formatDateTime(settings.last_message_at)}` : 'no message yet'}
            {settings.last_problem ? <span style={{ color: '#b45309' }}>{` · ${settings.last_problem} (${formatDateTime(settings.last_problem_at)})`}</span> : null}
          </p>
        </div>
      )}
    </section>
  )
}
