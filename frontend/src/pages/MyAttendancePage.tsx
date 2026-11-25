import { useCallback, useEffect, useState } from 'react'
import { Pencil } from 'lucide-react'
import { PUNCH_EVENT } from '../components/PunchButton'
import { CorrectionModal, Pill, RequestPill, SpellLine } from '../components/HrBits'
import { useTracking } from '../lib/useTracking'
import { DAY_STATUS, clock, dayCode, dmy, duration, hrApi, monthName, thisMonth, todayIso, weekday, type AttendanceDay, type Correction, type Spell } from '../lib/hr'

export function MyAttendancePage() {
  useTracking('my_attendance')
  const [month, setMonth] = useState(thisMonth)
  const [days, setDays] = useState<AttendanceDay[]>([])
  const [spells, setSpells] = useState<Spell[]>([])
  const [corrections, setCorrections] = useState<Correction[]>([])
  const [error, setError] = useState('')
  const [correcting, setCorrecting] = useState<AttendanceDay | null>(null)

  const load = useCallback(() => hrApi.month(month)
    .then((d) => { setDays(d.days); setSpells(d.spells); setCorrections(d.corrections); setError('') })
    .catch((e: Error) => setError(e.message)), [month])

  useEffect(() => {
    void load()
    const changed = () => void load()
    window.addEventListener(PUNCH_EVENT, changed)
    return () => window.removeEventListener(PUNCH_EVENT, changed)
  }, [load])

  const withdraw = async (c: Correction) => {
    if (!window.confirm(`Withdraw the correction for ${dmy(c.date)}?`)) return
    try { await hrApi.withdrawCorrection(c.id); await load() } catch (e) { window.alert((e as Error).message) }
  }

  const today = todayIso()
  const shown = days.filter((d) => d.date <= today || d.leave || d.off === 'holiday').reverse()
  const count = (...statuses: AttendanceDay['status'][]) => days.filter((d) => d.date <= today && statuses.includes(d.status)).length
  const sum = (key: 'seconds' | 'active' | 'idle') => days.reduce((total, d) => total + d[key], 0)
  const leaveDays = days.filter((d) => d.date <= today).reduce((t, d) => t + (d.status === 'leave' ? 1 : d.leave?.half && !d.leave.counts_present ? 0.5 : 0), 0)

  return (
    <div>
      <div className="hr-bar">
        <input className="input" type="month" aria-label="Month" value={month} max={thisMonth()} onChange={(e) => setMonth(e.target.value || thisMonth())} />
        <strong>{monthName(month)}</strong>
      </div>
      {error ? <p className="hr-error">{error}</p> : null}

      <div className="hr-tiles">
        <div className="hr-tile"><span>Days present</span><strong>{count('present', 'on_duty')}</strong></div>
        <div className="hr-tile"><span>Days on leave</span><strong>{leaveDays}</strong></div>
        <div className="hr-tile"><span>Absent</span><strong>{count('absent')}</strong></div>
        <div className="hr-tile"><span>Hours (check in to out)</span><strong>{duration(sum('seconds'))}</strong></div>
        <div className="hr-tile"><span>Active in software</span><strong>{duration(sum('active'))}</strong><small>Idle {duration(sum('idle'))}</small></div>
      </div>

      {corrections.length ? (
        <section className="surface" style={{ marginBottom: 16 }}>
          <div className="surface-heading"><div><p className="section-label">Attendance</p><h2>My correction requests</h2></div></div>
          <ul className="hr-list">
            {corrections.map((c) => (
              <li key={c.id}>
                <span>{dmy(c.date)}</span>
                <span>{clock(c.check_in_at)} – {c.check_out_at ? clock(c.check_out_at) : 'still in'} · {c.reason}{c.remark ? <span className="hr-muted"> · {c.decided_by}: {c.remark}</span> : null}</span>
                <RequestPill status={c.status} />
                {c.status === 'pending' ? <button type="button" className="ghost-button" onClick={() => void withdraw(c)}>Withdraw</button> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="surface">
        <div className="surface-heading"><div><p className="section-label">Attendance</p><h2>Day by day</h2></div></div>
        <div className="hr-scroll">
          <table className="data-table" style={{ minWidth: 820 }}>
            <thead><tr><th>Date</th><th>Status</th><th>Check in / out</th><th>Hours</th><th>Active</th><th>Idle</th><th /></tr></thead>
            <tbody>
              {shown.length === 0 ? <tr><td colSpan={7} className="empty-state">Nothing recorded in this month.</td></tr> : shown.map((d) => {
                const s = DAY_STATUS[d.status]
                const waiting = corrections.some((c) => c.date === d.date && c.status === 'pending')
                return (
                  <tr key={d.date}>
                    <td style={{ whiteSpace: 'nowrap' }}><strong>{dmy(d.date)}</strong> <span className="hr-muted">{weekday(d.date)}</span></td>
                    <td>
                      <Pill color={s.color} background={s.background}>{d.status === 'present' || d.status === 'none' || d.status === 'future' ? s.label || 'Coming' : d.status === 'not_in' ? s.label : `${dayCode(d)} · ${s.label}`}</Pill>
                      {d.off_name || d.leave ? <span className="hr-muted" style={{ display: 'block' }}>{d.leave ? `${d.leave.name}${d.leave.half ? ` (${d.leave.half} half)` : ''}` : d.off_name}</span> : null}
                    </td>
                    <td>{spells.filter((x) => x.date === d.date).map((x) => <SpellLine key={x.id} spell={x} />)}</td>
                    <td style={{ fontWeight: 700 }}>{d.seconds ? duration(d.seconds) : '-'}</td>
                    <td>{d.active ? duration(d.active) : '-'}</td>
                    <td>{d.idle ? duration(d.idle) : '-'}</td>
                    <td>{d.date <= today && !waiting ? <button type="button" className="icon-button" title="Ask for a correction" onClick={() => setCorrecting(d)}><Pencil size={15} /></button> : null}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
      {correcting ? <CorrectionModal day={correcting} onClose={() => setCorrecting(null)} onSaved={() => { setCorrecting(null); void load() }} /> : null}
    </div>
  )
}
