import { useEffect, useMemo, useState } from 'react'
import { Search, ShieldCheck } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { mailApi, type MailAccessUser } from '../lib/mail'
import { BOX_FEATURES, canUserAccess, defaultFeaturesForRole, type BoxFeature } from '../lib/roleConfig'
import type { TrackerRole } from '../lib/types'

/** Administration: Mail, Documents and the approvals of every user in one table. */
export function AccessPanel() {
  // Users are added and changed below on the same page
  const { users: directory } = useAuth()
  const [users, setUsers] = useState<MailAccessUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState('')
  const [query, setQuery] = useState('')

  useEffect(() => {
    mailApi.access()
      .then(({ data }) => { setUsers(data); setError('') })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [directory])

  const has = (u: MailAccessUser, key: BoxFeature) => canUserAccess({ ...u, tracker_role: u.tracker_role as TrackerRole }, key)

  const toggle = async (u: MailAccessUser, key: BoxFeature) => {
    setSaving(`${u.id}-${key}`)
    try {
      const { data } = await mailApi.setAccess(u.id, !has(u, key), defaultFeaturesForRole(u.tracker_role as TrackerRole), key)
      setUsers((list) => list.map((x) => (x.id === u.id ? { ...x, allowed_modules: data.allowed_modules } : x)))
    } catch (e) {
      window.alert((e as Error).message)
    } finally {
      setSaving('')
    }
  }

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return users.filter((u) => !q || `${u.name} ${u.username} ${u.email}`.toLowerCase().includes(q))
  }, [users, query])

  return (
    <section className="surface" style={{ marginBottom: 16 }}>
      <div className="surface-heading">
        <div>
          <p className="section-label"><ShieldCheck size={12} style={{ verticalAlign: '-1px' }} /> Access</p>
          <h2>Access and approvals</h2>
        </div>
        <div style={{ position: 'relative', width: 240, maxWidth: '100%' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input className="input" style={{ paddingLeft: 30 }} placeholder="Search users…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search users" />
        </div>
      </div>
      <p className="text-muted" style={{ margin: '0 0 12px', fontSize: '0.8rem' }}>A tick is saved at once. Point at a column heading to read what it does. Admins always have everything.</p>
      {error ? <p className="hr-error">{error}</p> : loading ? <p className="text-muted">Loading…</p> : (
        <div className="hr-scroll">
          <table className="data-table access-table">
            <thead>
              <tr><th rowSpan={2}>User</th><th colSpan={2}>Can open</th><th colSpan={BOX_FEATURES.length - 2}>Can approve</th></tr>
              <tr>{BOX_FEATURES.map((f) => <th key={f.key} title={f.help} className="access-table__help">{f.label}</th>)}</tr>
            </thead>
            <tbody>
              {shown.map((u) => (
                <tr key={u.id} style={u.is_active ? undefined : { opacity: 0.55 }}>
                  <td><strong>{u.name}</strong><span className="hr-muted" style={{ display: 'block' }}>{u.email || u.username}{u.is_active ? '' : ' · inactive'}</span></td>
                  {u.is_admin ? <td colSpan={BOX_FEATURES.length} className="hr-muted" style={{ textAlign: 'center' }}>Admin: always has all</td> : BOX_FEATURES.map((f) => (
                    <td key={f.key}>
                      <input type="checkbox" aria-label={`${f.help.split('.')[0]}: ${u.name}`} checked={has(u, f.key)} disabled={saving !== ''} onChange={() => void toggle(u, f.key)} />
                    </td>
                  ))}
                </tr>
              ))}
              {shown.length === 0 ? <tr><td colSpan={BOX_FEATURES.length + 1} className="empty-state">No users match.</td></tr> : null}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
