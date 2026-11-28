import { useEffect, useRef, useState } from 'react'
import { Check, Settings, UserPlus } from 'lucide-react'
import { mailApi, mailServers, type MailAccount, type MailSettings } from '../lib/mail'
import { Modal } from './Modal'
import { Req } from './ui'
import { Select } from './Select'
import { showSaved } from '../lib/toast'

const initial = (a: MailAccount) => (a.from_name || a.email).charAt(0).toUpperCase()

/** Top-right account button, like Gmail: the accounts, Add account, settings of the open one */
export function MailAccountMenu({ accounts, current, onSwitch, onAdd, onSettings }: {
  accounts: MailAccount[]
  current: MailAccount
  onSwitch: (id: number) => void
  onAdd: () => void
  onSettings: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const pick = (action: () => void) => { setOpen(false); action() }

  return (
    <div className="tb-accounts" ref={ref}>
      <button type="button" className="tb-accounts__button" aria-haspopup="menu" aria-expanded={open} title={`${current.from_name} <${current.email}>`} onClick={() => setOpen(!open)}>
        <span className="tb-avatar">{initial(current)}</span>
        <span className="tb-accounts__email">{current.email}</span>
      </button>
      {open ? (
        <div className="tb-accounts__menu" role="menu">
          {accounts.map((a) => (
            <button key={a.id} type="button" role="menuitem" className={`tb-accounts__item${a.id === current.id ? ' active' : ''}`} onClick={() => pick(() => onSwitch(a.id))}>
              <span className="tb-avatar">{initial(a)}</span>
              <span className="tb-accounts__text">
                <strong>{a.from_name || a.email}</strong>
                <small>{a.email}{a.shared ? ' · shared' : ''}</small>
              </span>
              {a.id === current.id ? <Check size={16} aria-label="Open" /> : a.unread ? <span className="tb-accounts__unread" aria-label={`${a.unread} unread`}>{a.unread}</span> : null}
            </button>
          ))}
          <div className="tb-accounts__line" />
          <button type="button" role="menuitem" className="tb-accounts__item" onClick={() => pick(onAdd)}><UserPlus size={17} /> Add account</button>
          {current.can_manage ? <button type="button" role="menuitem" className="tb-accounts__item" onClick={() => pick(onSettings)}><Settings size={17} /> Account settings</button> : null}
        </div>
      ) : null}
    </div>
  )
}

const EMPTY: MailSettings = {
  email: '', from_name: '', username: '', password: '',
  imap_host: '', imap_port: 993, imap_encryption: 'ssl',
  smtp_host: '', smtp_port: 465, smtp_encryption: 'ssl',
  sent_folder: '', default_bcc: '',
}

/** Add an account, or change / remove one (`id`) */
export function MailAccountDialog({ id, canShare, first, defaultBcc, onClose, onSaved, onRemoved }: {
  id: number | null
  /** Admins can add a mailbox for everyone with Mail access */
  canShare: boolean
  /** No account at all yet: the office mailbox comes first */
  first: boolean
  defaultBcc: string
  onClose: () => void
  onSaved: (id: number) => void
  onRemoved: () => void
}) {
  const [form, setForm] = useState<MailSettings>({ ...EMPTY, default_bcc: defaultBcc })
  const [shared, setShared] = useState(canShare && first)
  const [loading, setLoading] = useState(id !== null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [servers, setServers] = useState(false)
  /** Server names typed by hand are not replaced when the email changes */
  const ownServers = useRef(id !== null)

  useEffect(() => {
    if (id === null) return
    mailApi.account(id)
      .then(({ data }) => { setForm({ ...EMPTY, ...data, password: '' }); setShared(Boolean(data.shared)) })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  const set = <K extends keyof MailSettings>(key: K, value: MailSettings[K]) => setForm((f) => ({ ...f, [key]: value }))
  const setServer = <K extends keyof MailSettings>(key: K, value: MailSettings[K]) => { ownServers.current = true; set(key, value) }
  const setEmail = (email: string) => setForm((f) => ({ ...f, email, ...(ownServers.current ? {} : mailServers(email)) }))

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      // Mailboxes log in with the email address, unless this one was set up with another user name
      const payload = { ...form, email: form.email.trim(), username: id !== null && form.username !== form.email ? form.username : form.email.trim() }
      const { data } = id === null ? await mailApi.addAccount({ ...payload, shared }) : await mailApi.saveAccount(id, payload)
      showSaved('Saved mailbox')
      onSaved(data.id!)
    } catch (err) {
      setError((err as Error).message)
      setServers(true)
      setSaving(false)
    }
  }

  const remove = async () => {
    if (id === null || !window.confirm(`Remove ${form.email} from this software? The mails stay on the mail server.`)) return
    setSaving(true)
    try {
      await mailApi.removeAccount(id)
      onRemoved()
    } catch (err) {
      setError((err as Error).message)
      setSaving(false)
    }
  }

  const gmail = /@(gmail|googlemail)\.com$/i.test(form.email.trim()) || /gmail\.com$/i.test(form.imap_host)
  const microsoft = /@(outlook|hotmail|live|msn)\.[a-z.]+$/i.test(form.email.trim())
  const encryption = (key: 'imap_encryption' | 'smtp_encryption') => (
    <Select className="input" value={form[key]} onChange={(e) => setServer(key, e.target.value as MailSettings[typeof key])}>
      <option value="ssl">SSL/TLS</option>
      <option value="tls">STARTTLS</option>
      <option value="none">None</option>
    </Select>
  )

  return (
    <Modal
      title={id === null ? 'Add account' : 'Account settings'}
      subtitle="Mail"
      onClose={onClose}
      size="lg"
      onSubmit={save}
      saving={saving}
      saveDisabled={loading}
      saveLabel={id === null ? 'Add account' : 'Test & save'}
      footerLeft={id !== null ? <button type="button" className="btn btn-outline btn-sm" style={{ color: '#b91c1c' }} disabled={saving} onClick={() => void remove()}>Remove account</button> : undefined}
    >
      {error ? <p className="tb-error" role="alert" style={{ margin: '0 0 12px' }}>{error}</p> : null}
      {gmail ? <p className="tb-muted" style={{ margin: '0 0 12px' }}>Gmail needs an <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer">app password</a> here, not the normal password (2-Step Verification must be on).</p> : null}
      {microsoft ? <p className="tb-error" style={{ margin: '0 0 12px' }}>Outlook / Hotmail accounts usually cannot be added: Microsoft does not allow a password login any more.</p> : null}
      <div className="tb-settings-grid">
        <label><span>Email address<Req /></span><input className="input" type="email" required autoComplete="off" value={form.email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label><span>Password{id === null ? <Req /> : null}</span><input className="input" type="password" autoComplete="new-password" required={id === null} value={form.password ?? ''} onChange={(e) => set('password', e.target.value)} placeholder={id === null ? '' : 'Leave blank to keep the saved password'} /></label>
        <label><span>Sender name</span><input className="input" value={form.from_name} onChange={(e) => set('from_name', e.target.value)} placeholder="Namotech" /></label>
        <label><span>Always Bcc</span><input className="input" value={form.default_bcc} onChange={(e) => set('default_bcc', e.target.value)} placeholder="name@example.com, another@example.com" /><small className="tb-muted">Filled into every new mail; can be removed in a single mail.</small></label>
      </div>
      {canShare && id === null ? (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '14px 0 0', fontSize: '0.85rem' }}>
          <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} style={{ width: 'auto', margin: 0 }} /> Shared: everyone with Mail access can read and send from it. Otherwise only you can.
        </label>
      ) : null}
      <button type="button" className="ghost-button" style={{ margin: '14px 0 8px' }} aria-expanded={servers} onClick={() => setServers(!servers)}>{servers ? 'Hide server settings' : 'Server settings'}</button>
      {servers ? (
        <div className="tb-settings-grid">
          <label><span>Incoming (IMAP) server<Req /></span><input className="input" required value={form.imap_host} onChange={(e) => setServer('imap_host', e.target.value.trim())} /></label>
          <div className="tb-settings-pair">
            <label><span>Port<Req /></span><input className="input" type="number" required value={form.imap_port} onChange={(e) => setServer('imap_port', Number(e.target.value))} /></label>
            <label><span>Security</span>{encryption('imap_encryption')}</label>
          </div>
          <label><span>Outgoing (SMTP) server<Req /></span><input className="input" required value={form.smtp_host} onChange={(e) => setServer('smtp_host', e.target.value.trim())} /></label>
          <div className="tb-settings-pair">
            <label><span>Port<Req /></span><input className="input" type="number" required value={form.smtp_port} onChange={(e) => setServer('smtp_port', Number(e.target.value))} /></label>
            <label><span>Security</span>{encryption('smtp_encryption')}</label>
          </div>
        </div>
      ) : null}
      <p className="tb-muted" style={{ margin: '12px 0 0', fontSize: '0.8rem' }}>The login is checked before saving. The password is stored encrypted.</p>
    </Modal>
  )
}
