import { useState } from 'react'
import { Check, Home, LayoutGrid, type LucideIcon } from 'lucide-react'
import { MAX_TABS } from './mobileApi'

/** More › Customise bottom bar: Home and More stay, up to 3 tabs between them */
export function TabsSettingsScreen({ choices, selected, onSave }: {
  choices: Array<{ key: string; label: string; icon: LucideIcon }>
  selected: string[]
  onSave: (tabs: string[]) => Promise<void>
}) {
  const [picked, setPicked] = useState<string[]>(selected)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const full = picked.length >= MAX_TABS

  const toggle = (key: string) => {
    setMessage('')
    setPicked((list) => (list.includes(key) ? list.filter((k) => k !== key) : list.length >= MAX_TABS ? list : [...list, key]))
  }
  const save = async () => {
    setSaving(true); setError(''); setMessage('')
    try { await onSave(picked); setMessage('Saved. Your bottom bar is updated on every phone you use.') } catch (e) { setError((e as Error).message) } finally { setSaving(false) }
  }
  const byKey = (k: string) => choices.find((c) => c.key === k)

  return (
    <div className="m-page">
      <section className="m-card m-section">
        <h2>Your bottom bar</h2>
        <p className="m-muted m-small">Home and More are always there. Pick up to {MAX_TABS} in between, in the order you tap them.</p>
        <div className="m-barpreview">
          <span><Home size={18} />Home</span>
          {picked.map((k) => { const c = byKey(k); if (!c) return null; const Icon = c.icon; return <span key={k} className="on"><Icon size={18} />{c.label}</span> })}
          <span><LayoutGrid size={18} />More</span>
        </div>
      </section>

      <section className="m-card m-menu">
        {choices.map((c) => {
          const on = picked.includes(c.key)
          const Icon = c.icon
          return (
            <button type="button" key={c.key} onClick={() => toggle(c.key)} disabled={!on && full} aria-pressed={on} className={on ? 'm-menu__on' : ''}>
              <Icon size={19} /><span>{c.label}</span>
              {on ? <span className="m-order">{picked.indexOf(c.key) + 1}</span> : <span className="m-order m-order--empty" />}
            </button>
          )
        })}
      </section>

      {message ? <p className="m-ok" role="status">{message}</p> : null}
      {error ? <p className="m-error" role="alert">{error}</p> : null}
      <div className="m-sticky-save">
        <button type="button" className="m-btn m-btn--primary m-btn--block" disabled={saving} onClick={() => void save()}><Check size={17} /> {saving ? 'Saving…' : 'Save bottom bar'}</button>
      </div>
    </div>
  )
}
