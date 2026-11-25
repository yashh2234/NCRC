import { useEffect, useMemo, useState } from 'react'
import { FolderOpen, Mail, Search } from 'lucide-react'
import { mailApi, type MailAccessUser } from '../lib/mail'
import { canUserAccess, defaultFeaturesForRole } from '../lib/roleConfig'
import type { TrackerRole } from '../lib/types'

const PANELS = {
  mail: {
    icon: Mail, label: 'Mail', title: 'Who can open Mail',
    text: 'Users switched on see the Mail button, can read and send from the office mailbox, and get a bell notification when new mail arrives. Admins always have access.',
  },
  documents_site: {
    icon: FolderOpen, label: 'Documents', title: 'Who sees the Documents button',
    text: 'Users switched on see the Documents button left of Mail; it opens documents.namotech.in in a new tab, where they sign in with their document login. Admins always see it.',
  },
}

/** Administration: choose which users can open the office mailbox / see the Documents button. */
export function MailAccessPanel({ module = 'mail' }: { module?: keyof typeof PANELS }) {
  const panel = PANELS[module]
  const Icon = panel.icon
  const [users, setUsers] = useState<MailAccessUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [savingId, setSavingId] = useState<number | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    mailApi.access()
      .then(({ data }) => setUsers(data))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const hasMail = (u: MailAccessUser) => canUserAccess({ ...u, tracker_role: u.tracker_role as TrackerRole }, module)

  const toggle = async (u: MailAccessUser) => {
    const enable = !hasMail(u)
    setSavingId(u.id)
    try {
      const { data } = await mailApi.setAccess(u.id, enable, defaultFeaturesForRole(u.tracker_role as TrackerRole), module)
      setUsers((list) => list.map((x) => x.id === u.id ? { ...x, allowed_modules: data.allowed_modules } : x))
    } catch (e) {
      window.alert((e as Error).message)
    } finally {
      setSavingId(null)
    }
  }

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return users.filter((u) => !q || `${u.name} ${u.username} ${u.email}`.toLowerCase().includes(q))
  }, [users, query])
  const withAccess = users.filter(hasMail).length

  return (
    <section className="surface" style={{ marginBottom: 16 }}>
      <div className="surface-heading">
        <div>
          <p className="section-label"><Icon size={12} style={{ verticalAlign: '-1px' }} /> {panel.label}</p>
          <h2>{panel.title} ({withAccess}/{users.length})</h2>
        </div>
        <div style={{ position: 'relative', width: 240, maxWidth: '100%' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input className="input" style={{ paddingLeft: 30 }} placeholder="Search users…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search users" />
        </div>
      </div>
      <p className="text-muted" style={{ margin: '0 0 12px', fontSize: '0.8rem' }}>
        {panel.text}
      </p>
      {error ? <p style={{ color: '#b91c1c' }}>{error}</p> : loading ? <p className="text-muted">Loading…</p> : (
        <div className="mail-access-grid">
          {shown.map((u) => {
            const on = hasMail(u)
            return (
              <label key={u.id} className={`mail-access-item${on ? ' on' : ''}${u.is_active ? '' : ' inactive'}`} title={u.is_admin ? 'Admins always have access' : undefined}>
                <input type="checkbox" checked={on} disabled={u.is_admin || savingId === u.id} onChange={() => void toggle(u)} />
                <span className="mail-access-item__text">
                  <strong>{u.name}</strong>
                  <small>{u.is_admin ? 'Admin · always' : u.email || u.username}{u.is_active ? '' : ' · inactive'}</small>
                </span>
              </label>
            )
          })}
          {shown.length === 0 ? <p className="text-muted">No users match.</p> : null}
        </div>
      )}
    </section>
  )
}
