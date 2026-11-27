import { useEffect, useState } from 'react'
import { Bell, BellOff, BellRing, Check, Moon, Share, SquarePlus } from 'lucide-react'
import { disablePush, enablePush, isIos, isStandalone, pushApi, usePushState, type PushConfig, type PushPrefs } from '../lib/pwa'

export interface NotificationItem {
  id: number
  type: string
  title: string
  message: string | null
  data: Record<string, unknown> | null
  read: boolean
  created_at: string | null
  time_ago: string | null
}

export function NotificationsScreen({ items, unread, onTap, onMarkAll, onSettings }: {
  items: NotificationItem[]
  unread: number
  onTap: (n: NotificationItem) => void
  onMarkAll: () => void
  onSettings: () => void
}) {
  return (
    <div className="m-page">
      <div className="m-toolbar">
        {unread > 0 ? <button type="button" className="m-btn m-btn--ghost m-btn--sm" onClick={onMarkAll}><Check size={15} /> Mark all read</button> : <span />}
        <button type="button" className="m-btn m-btn--ghost m-btn--sm" onClick={onSettings}><BellRing size={15} /> Phone alerts</button>
      </div>
      {items.length === 0 ? (
        <div className="m-empty"><Bell size={40} /><strong>You&apos;re all caught up</strong></div>
      ) : (
        <ul className="m-list">
          {items.map((n) => (
            <li key={n.id}>
              <button type="button" className={`m-card m-notif${n.read ? '' : ' unread'}`} onClick={() => onTap(n)}>
                <span className="m-notif__row"><strong>{n.title}</strong><span className="m-muted m-small">{n.time_ago}</span></span>
                {n.message ? <span className="m-notif__msg">{n.message}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Turn phone notifications on for this device, choose the kinds and quiet hours */
export function PushSettingsScreen() {
  const [state, setState] = usePushState()
  const [config, setConfig] = useState<PushConfig | null>(null)
  const [prefs, setPrefs] = useState<PushPrefs | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    pushApi.config().then((c) => { setConfig(c); setPrefs(c.prefs) }).catch((e: Error) => setError(e.message))
  }, [])

  const turnOn = async () => {
    if (!config?.public_key) return
    setBusy(true); setError(''); setMessage('')
    try {
      setState(await enablePush(config.public_key))
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  const turnOff = async () => {
    setBusy(true); setError(''); setMessage('')
    try { setState(await disablePush()) } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  const test = async () => {
    setBusy(true); setError(''); setMessage('')
    try { setMessage((await pushApi.test()).message) } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  const save = async (next: PushPrefs) => {
    setPrefs(next)
    setError('')
    try { setPrefs((await pushApi.savePrefs(next)).prefs); setMessage('Saved') } catch (e) { setError((e as Error).message) }
  }

  const iosOutsideApp = isIos() && !isStandalone()

  return (
    <div className="m-page">
      <section className="m-card m-section">
        <h2>This phone</h2>
        {config && !config.public_key ? (
          <p className="m-note m-note--warn"><BellOff size={16} /> <span>Phone notifications are not set up on the server yet. Ask the administrator.</span></p>
        ) : iosOutsideApp ? (
          <div className="m-note">
            <Share size={16} />
            <span>On iPhone, notifications work only in the installed app: tap <strong>Share</strong> <Share size={13} /> then <strong>Add to Home Screen</strong> <SquarePlus size={13} />, open NCRC from the home screen and come back here.</span>
          </div>
        ) : state === 'unsupported' ? (
          <p className="m-note m-note--warn"><BellOff size={16} /> <span>This browser cannot show notifications. Use Chrome on Android, or the installed app on iPhone.</span></p>
        ) : state === 'blocked' ? (
          <p className="m-note m-note--warn"><BellOff size={16} /> <span>Notifications are blocked for this app. Allow them in the phone&apos;s settings (Apps › Chrome or NCRC › Notifications), then come back.</span></p>
        ) : (
          <div className="m-switch-row">
            <div>
              <strong>{state === 'on' ? 'Notifications are on' : 'Notifications are off'}</strong>
              <span className="m-muted m-small">{state === 'on' ? 'You get alerts even when the app is closed.' : 'Turn on to get approvals, jobs and mail alerts.'}</span>
            </div>
            {state === 'on'
              ? <button type="button" className="m-btn m-btn--ghost" disabled={busy} onClick={() => void turnOff()}>Turn off</button>
              : <button type="button" className="m-btn m-btn--primary" disabled={busy || !config} onClick={() => void turnOn()}><Bell size={16} /> Turn on</button>}
          </div>
        )}
        {state === 'on' ? <button type="button" className="m-btn m-btn--ghost m-btn--block" disabled={busy} onClick={() => void test()}>Send me a test notification</button> : null}
      </section>

      {config && prefs ? (
        <>
          <section className="m-card m-section">
            <h2>What to notify</h2>
            <p className="m-muted m-small">Applies to all your devices. The bell list in the app always shows everything.</p>
            {config.categories.map((c) => (
              <label key={c.key} className="m-toggle">
                <span>
                  <strong>{c.key.charAt(0).toUpperCase() + c.key.slice(1)}</strong>
                  <span className="m-muted m-small">{c.label}</span>
                </span>
                <input type="checkbox" role="switch" checked={prefs.categories[c.key] ?? true}
                  onChange={(e) => void save({ ...prefs, categories: { ...prefs.categories, [c.key]: e.target.checked } })} />
              </label>
            ))}
          </section>

          <section className="m-card m-section">
            <h2><Moon size={16} /> Quiet hours</h2>
            <p className="m-muted m-small">No phone alerts in this time (India time). They still wait in the bell list.</p>
            <div className="m-two">
              <label className="m-field"><span>From</span>
                <input type="time" value={prefs.quiet_from ?? ''} onChange={(e) => setPrefs({ ...prefs, quiet_from: e.target.value || null })} onBlur={() => void save(prefs)} />
              </label>
              <label className="m-field"><span>To</span>
                <input type="time" value={prefs.quiet_to ?? ''} onChange={(e) => setPrefs({ ...prefs, quiet_to: e.target.value || null })} onBlur={() => void save(prefs)} />
              </label>
            </div>
            {prefs.quiet_from || prefs.quiet_to ? <button type="button" className="m-link" onClick={() => void save({ ...prefs, quiet_from: null, quiet_to: null })}>No quiet hours</button> : null}
          </section>
        </>
      ) : null}

      {message ? <p className="m-ok" role="status">{message}</p> : null}
      {error ? <p className="m-error" role="alert">{error}</p> : null}
    </div>
  )
}
