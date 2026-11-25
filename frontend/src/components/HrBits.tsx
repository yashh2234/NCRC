import { useState } from 'react'
import { MapPin } from 'lucide-react'
import { Modal } from './Modal'
import { Req } from './ui'
import { REQUEST_STATUS, clock, clock24, dmy, hrApi, mapUrl, placeText, type AttendanceDay, type LeaveRequest, type PunchPlace, type Spell } from '../lib/hr'

export function Pill({ color, background, children }: { color: string; background: string; children: React.ReactNode }) {
  return <span className="hr-pill" style={{ color, background }}>{children}</span>
}

export function RequestPill({ status }: { status: LeaveRequest['status'] }) {
  const s = REQUEST_STATUS[status]
  return <Pill color={s.color} background={s.background}>{s.label}</Pill>
}

/** "At office" with a link to the map, and the note written at check in / out */
export function Place({ place }: { place: PunchPlace }) {
  const url = mapUrl(place)
  const text = placeText(place)
  const title = [place.accuracy !== null ? `within about ${place.accuracy} m` : '', place.ip ? `IP ${place.ip}` : ''].filter(Boolean).join(' · ')
  return (
    <span style={{ fontSize: '0.78rem', color: place.at_office === false ? '#b45309' : '#475569' }} title={title}>
      {url ? <a href={url} target="_blank" rel="noreferrer" style={{ color: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 3 }}><MapPin size={12} /> {text}</a> : text}
      {place.note ? <span style={{ display: 'block', color: '#64748b' }}>{place.note}</span> : null}
    </span>
  )
}

export function SpellLine({ spell }: { spell: Spell }) {
  return (
    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', padding: '2px 0' }}>
      <span><strong>{clock(spell.check_in_at)}</strong> <Place place={spell.in} /></span>
      <span>{spell.check_out_at ? <strong>{clock(spell.check_out_at)}</strong> : <em>still in</em>} {spell.auto_closed ? <Pill color="#b45309" background="#fef3c7">no check out</Pill> : spell.out && !spell.corrected ? <Place place={spell.out} /> : null}</span>
      {spell.corrected ? <Pill color="#6d28d9" background="#ede9fe">corrected</Pill> : null}
    </div>
  )
}

/** A user asks for other check in / check out times of a day. */
export function CorrectionModal({ day, onClose, onSaved }: { day: Pick<AttendanceDay, 'date' | 'in' | 'out'>; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ date: day.date, check_in: clock24(day.in), check_out: clock24(day.out), reason: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }))

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await hrApi.requestCorrection(form)
      onSaved()
    } catch (err) {
      setError((err as Error).message)
      setSaving(false)
    }
  }

  return (
    <Modal title="Ask for an attendance correction" subtitle={dmy(form.date)} size="sm" onClose={onClose} onSubmit={save} saving={saving} saveLabel="Send to admin">
      <div className="hr-form">
        <label><span>Check in<Req /></span><input className="input" type="time" required value={form.check_in} onChange={(e) => set({ check_in: e.target.value })} /></label>
        <label><span>Check out</span><input className="input" type="time" value={form.check_out} onChange={(e) => set({ check_out: e.target.value })} /></label>
        <label className="wide"><span>Reason<Req /></span><textarea className="input" required rows={3} maxLength={480} value={form.reason} onChange={(e) => set({ reason: e.target.value })} placeholder="e.g. Forgot to check out; was at the site till 6:30 pm" /></label>
      </div>
      {error ? <p role="alert" className="hr-error" style={{ margin: '10px 0 0' }}>{error}</p> : null}
    </Modal>
  )
}
