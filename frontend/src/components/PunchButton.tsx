import { useCallback, useEffect, useState } from 'react'
import { LogIn, LogOut, MapPin, TimerReset } from 'lucide-react'
import { Modal } from './Modal'
import { Req } from './ui'
import { clock, dmy, duration, hrApi, locate, type AttendanceStatus, type DevicePlace } from '../lib/hr'

/** Other parts of the page (My Attendance) reload when this is fired */
export const PUNCH_EVENT = 'attendance-changed'

/** Check In / Check Out in the top bar. */
export function PunchButton() {
  const [status, setStatus] = useState<AttendanceStatus | null>(null)
  const [loadedAt, setLoadedAt] = useState(0)
  const [now, setNow] = useState(0)
  const [open, setOpen] = useState(false)

  const load = useCallback(() => hrApi.status().then((s) => { setStatus(s); setLoadedAt(Date.now()); setNow(Date.now()) }).catch(() => undefined), [])

  useEffect(() => {
    void load()
    const tick = window.setInterval(() => setNow(Date.now()), 30000)
    // Checked in on another computer, or a new day
    const poll = window.setInterval(() => { if (document.visibilityState === 'visible') void load() }, 5 * 60000)
    const changed = () => void load()
    window.addEventListener(PUNCH_EVENT, changed)
    return () => { window.clearInterval(tick); window.clearInterval(poll); window.removeEventListener(PUNCH_EVENT, changed) }
  }, [load])

  if (!status?.kept) return null
  const seconds = status.seconds + (status.checked_in ? Math.max(0, Math.round((now - loadedAt) / 1000)) : 0)
  // First open on a working day: check in before anything else
  const must = Boolean(status.must_check_in && !status.checked_in)

  return (
    <>
      <button className={`topbar-mail punch${status.checked_in ? ' punch--in' : ''}`} type="button" onClick={() => setOpen(true)}
        title={status.checked_in ? `Checked in · ${duration(seconds)} today` : 'Check in for today'} aria-label={status.checked_in ? 'Check out' : 'Check in'}>
        {status.checked_in ? <LogOut size={17} /> : <LogIn size={17} />}
        <span>{status.checked_in ? `Check Out · ${duration(seconds)}` : status.spells.length ? 'Check In again' : 'Check In'}</span>
      </button>
      {open || must ? <PunchModal status={status} seconds={seconds} locked={must} onClose={() => setOpen(false)} /> : null}
    </>
  )
}

function PunchModal({ status, seconds, locked = false, onClose }: { status: AttendanceStatus; seconds: number; locked?: boolean; onClose: () => void }) {
  const out = status.checked_in
  const missed = out ? null : status.missed_out ?? null
  const [leftAt, setLeftAt] = useState('')
  const [place, setPlace] = useState<DevicePlace | null>(null)
  const [looking, setLooking] = useState(true)
  const [problem, setProblem] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const find = useCallback(() => {
    setLooking(true)
    setProblem('')
    locate().then(setPlace).catch((e: Error) => setProblem(e.message)).finally(() => setLooking(false))
  }, [])
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { find() }, [find])

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      await hrApi.punch({ action: out ? 'out' : 'in', ...(place ?? {}), ...(note.trim() ? { note: note.trim() } : {}), ...(missed ? { missed_out: leftAt } : {}) })
      window.dispatchEvent(new Event(PUNCH_EVENT))
      onClose()
    } catch (e) {
      setError((e as Error).message)
      setSaving(false)
    }
  }

  return (
    <Modal title={locked ? 'Good morning! Check in for today' : out ? 'Check out' : 'Check in'} subtitle={dmy(status.date)} size="sm" onClose={onClose} onSave={() => void save()} saving={saving}
      saveDisabled={looking || (!out && !place && !note.trim()) || Boolean(missed && !leftAt)} saveLabel={out ? 'Check Out' : 'Check In'} locked={locked}>
      {missed ? (
        <label className="hr-note hr-note--warn" style={{ display: 'grid', gap: 6, marginBottom: 12 }}>
          <span><TimerReset size={15} style={{ verticalAlign: '-2px' }} /> You did not check out on <strong>{dmy(missed.date)}</strong> (checked in {clock(missed.check_in_at)}). What time did you leave?<Req /></span>
          <input className="input" type="time" required value={leftAt} onChange={(e) => setLeftAt(e.target.value)} style={{ maxWidth: 160 }} />
        </label>
      ) : status.forgot_on && !out ? (
        <p className="hr-note hr-note--warn"><TimerReset size={15} /> <span>You did not check out on {dmy(status.forgot_on)}. If the time is wrong, ask for a correction in My Attendance.</span></p>
      ) : null}
      {status.spells.length ? <p style={{ margin: '0 0 12px', fontSize: '0.88rem' }}>Today: {status.spells.map((s) => `${clock(s.check_in_at)} – ${s.check_out_at ? clock(s.check_out_at) : 'now'}`).join(', ')} · <strong>{duration(seconds)}</strong></p> : null}
      <p className={`hr-note ${place ? 'hr-note--ok' : problem ? 'hr-note--warn' : ''}`}>
        <MapPin size={15} />
        <span>{looking ? 'Finding your location…' : place ? `Location found (within about ${place.accuracy} m). It is saved with your ${out ? 'check out' : 'check in'}.` : problem}</span>
        {!looking && !place ? <button type="button" className="ghost-button" onClick={find}>Try again</button> : null}
      </p>
      <label style={{ display: 'block', marginTop: 12 }}><span>{!out && !place && !looking ? 'Where are you working today? (needed without location)' : 'Note (optional), e.g. site name'}</span>
        <input className="input" maxLength={250} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      {error ? <p role="alert" style={{ color: '#b91c1c', margin: '10px 0 0' }}>{error}</p> : null}
    </Modal>
  )
}
