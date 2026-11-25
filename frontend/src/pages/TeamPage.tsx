import { useCallback, useEffect, useState } from 'react'
import { Check, Download, LogOut, MapPin, Printer, X } from 'lucide-react'
import { DateInput } from '../components/DateInput'
import { Pill, RequestPill, SpellLine } from '../components/HrBits'
import { Modal } from '../components/Modal'
import { useTracking } from '../lib/useTracking'
import {
  DAY_STATUS, addDays, clock, dayCode, dmy, downloadCsv, duration, hrApi, locate, moduleName, monthName, stamp, thisMonth, todayIso, weekday,
  type AttendanceDay, type Correction, type FailedLoginRow, type HrSettings, type LoginRow, type RegisterUser, type TeamUserDay, type UsageUser, type UserDetail,
} from '../lib/hr'

const TABS = [['today', 'Today'], ['register', 'Monthly register'], ['usage', 'Time in software'], ['work', 'Work done'], ['logins', 'Logins'], ['corrections', 'Corrections'], ['settings', 'Settings']] as const
type Tab = (typeof TABS)[number][0]

interface Range { from: string; to: string }
const hours = (seconds: number) => Math.round((seconds / 3600) * 100) / 100

/** Attendance and software use of all users (full admins). */
export function TeamPage() {
  useTracking('team')
  const [tab, setTab] = useState<Tab>('today')
  const [waiting, setWaiting] = useState(0)
  const [userId, setUserId] = useState<number | null>(null)

  return (
    <div>
      <div className="tab-nav" style={{ marginBottom: 16 }}>
        {TABS.map(([key, label]) => <button key={key} type="button" className={`tab-btn${tab === key ? ' active' : ''}`} onClick={() => setTab(key)}>{label}{key === 'corrections' && waiting ? ` (${waiting})` : ''}</button>)}
      </div>
      {tab === 'today' ? <Today onUser={setUserId} onWaiting={setWaiting} /> : null}
      {tab === 'register' ? <Register onUser={setUserId} /> : null}
      {tab === 'usage' ? <Usage onUser={setUserId} /> : null}
      {tab === 'work' ? <Work onUser={setUserId} /> : null}
      {tab === 'logins' ? <Logins /> : null}
      {tab === 'corrections' ? <Corrections onWaiting={setWaiting} /> : null}
      {tab === 'settings' ? <Settings /> : null}
      {userId !== null ? <UserModal id={userId} onClose={() => setUserId(null)} /> : null}
    </div>
  )
}

function NameButton({ id, name, onUser }: { id: number; name: string; onUser: (id: number) => void }) {
  return <button type="button" className="hr-link" title="Show day by day" onClick={() => onUser(id)}>{name}</button>
}

function RangeBar({ range, onChange, children }: { range: Range; onChange: (r: Range) => void; children?: React.ReactNode }) {
  const today = todayIso()
  const monday = addDays(today, -((new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7))
  const month = `${today.slice(0, 7)}-01`
  const lastMonthEnd = addDays(month, -1)
  const quick: Array<[string, Range]> = [
    ['Today', { from: today, to: today }], ['This week', { from: monday, to: today }], ['This month', { from: month, to: today }],
    ['Last month', { from: `${lastMonthEnd.slice(0, 7)}-01`, to: lastMonthEnd }],
  ]
  return (
    <div className="hr-bar">
      {quick.map(([label, r]) => <button key={label} type="button" className={`btn btn-sm ${r.from === range.from && r.to === range.to ? 'btn-primary' : 'btn-outline'}`} onClick={() => onChange(r)}>{label}</button>)}
      <DateInput value={range.from} ariaLabel="From" onChange={(from) => { if (from) onChange({ from, to: range.to < from ? from : range.to }) }} />
      <DateInput value={range.to} ariaLabel="To" onChange={(to) => { if (to) onChange({ to, from: range.from > to ? to : range.from }) }} />
      <span className="hr-bar__grow" />
      {children}
    </div>
  )
}

// ─── Today ───────────────────────────────────────────────────────────────

function Today({ onUser, onWaiting }: { onUser: (id: number) => void; onWaiting: (n: number) => void }) {
  const [date, setDate] = useState(todayIso)
  const [users, setUsers] = useState<TeamUserDay[]>([])
  const [error, setError] = useState('')
  const isToday = date === todayIso()

  useEffect(() => {
    let current = true
    const load = () => hrApi.today(date).then((d) => { if (current) { setUsers(d.users); setError(''); onWaiting(d.corrections) } }).catch((e: Error) => { if (current) setError(e.message) })
    void load()
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void load() }, 60000)
    return () => { current = false; window.clearInterval(timer) }
  }, [date, onWaiting])

  const count = (...s: AttendanceDay['status'][]) => users.filter((u) => s.includes(u.day.status)).length
  return (
    <>
      <div className="hr-bar">
        <DateInput value={date} ariaLabel="Date" onChange={(d) => setDate(d || todayIso())} />
        <strong>{weekday(date)}{users[0]?.day.off_name ? ` · ${users[0].day.off_name}` : ''}</strong>
      </div>
      {error ? <p className="hr-error">{error}</p> : null}
      <div className="hr-tiles">
        <div className="hr-tile"><span>Present</span><strong style={{ color: '#15803d' }}>{count('present')}</strong></div>
        <div className="hr-tile"><span>On leave</span><strong style={{ color: '#1d4ed8' }}>{count('leave', 'half_leave')}</strong></div>
        <div className="hr-tile"><span>On duty</span><strong style={{ color: '#0e7490' }}>{count('on_duty')}</strong></div>
        <div className="hr-tile"><span>{isToday ? 'Not checked in' : 'Absent'}</span><strong style={{ color: '#b91c1c' }}>{count('not_in', 'absent')}</strong></div>
        {isToday ? <div className="hr-tile"><span>Online now</span><strong>{users.filter((u) => u.online).length}</strong></div> : null}
      </div>
      <section className="surface">
        <div className="hr-scroll">
          <table className="data-table" style={{ minWidth: 960 }}>
            <thead><tr><th>Name</th><th>Status</th><th>Check in / out and place</th><th>Hours</th><th>Active</th><th>Idle</th><th>Last seen</th></tr></thead>
            <tbody>
              {users.map((u) => {
                const s = DAY_STATUS[u.day.status]
                return (
                  <tr key={u.user_id}>
                    <td style={{ whiteSpace: 'nowrap' }}><span title={u.online ? 'Online' : 'Offline'} style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 9, marginRight: 8, background: isToday && u.online ? '#16a34a' : '#cbd5e1' }} /><NameButton id={u.user_id} name={u.name} onUser={onUser} /></td>
                    <td><Pill color={s.color} background={s.background}>{s.label || '-'}</Pill>{u.day.leave ? <span className="hr-muted" style={{ display: 'block' }}>{u.day.leave.name}{u.day.leave.half ? ` (${u.day.leave.half} half)` : ''}</span> : null}</td>
                    <td>{u.spells.length ? u.spells.map((x) => <SpellLine key={x.id} spell={x} />) : '-'}</td>
                    <td style={{ fontWeight: 700 }}>{u.day.seconds ? duration(u.day.seconds) : '-'}</td>
                    <td>{u.day.active ? duration(u.day.active) : '-'}</td>
                    <td>{u.day.idle ? duration(u.day.idle) : '-'}</td>
                    <td className="hr-muted" style={{ whiteSpace: 'nowrap' }}>{stamp(u.last_seen)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}

// ─── Register ────────────────────────────────────────────────────────────

function totals(u: RegisterUser) {
  const today = todayIso()
  const past = u.days.filter((d) => d.date <= today)
  const half = (d: AttendanceDay) => d.leave?.half && !d.leave.counts_present
  return {
    present: past.filter((d) => d.status === 'present' || d.status === 'on_duty').length,
    leave: past.reduce((t, d) => t + (d.status === 'leave' ? 1 : half(d) ? 0.5 : 0), 0),
    absent: past.filter((d) => d.status === 'absent').length,
    seconds: u.days.reduce((t, d) => t + d.seconds, 0),
    active: u.days.reduce((t, d) => t + d.active, 0),
  }
}

function Register({ onUser }: { onUser: (id: number) => void }) {
  const [month, setMonth] = useState(thisMonth)
  const [users, setUsers] = useState<RegisterUser[]>([])
  const [error, setError] = useState('')
  useEffect(() => { hrApi.register(month).then((d) => { setUsers(d.users); setError('') }).catch((e: Error) => setError(e.message)) }, [month])
  const days = users[0]?.days ?? []

  const excel = () => {
    const sums = users.map(totals)
    const total = (label: string, value: (t: ReturnType<typeof totals>) => string | number) => [label, '', ...sums.flatMap((t) => [value(t), ''])]
    downloadCsv(`Attendance ${monthName(month)}`, [
      ['Date', 'Day', ...users.flatMap((u) => [u.name, `${u.name} hours`])],
      ...days.map((d, i) => [dmy(d.date), weekday(d.date), ...users.flatMap((u) => [dayCode(u.days[i]), u.days[i].seconds ? hours(u.days[i].seconds) : ''])]),
      total('Present', (t) => t.present), total('Leave', (t) => t.leave), total('Absent', (t) => t.absent), total('Hours', (t) => hours(t.seconds)), total('Active hours', (t) => hours(t.active)),
    ])
  }

  const print = () => {
    const page = document.createElement('style')
    page.textContent = `@page { size: A4 ${users.length > 8 ? 'landscape' : 'portrait'}; margin: 8mm; }`
    document.head.append(page)
    document.body.classList.add('printing-register')
    window.print()
    document.body.classList.remove('printing-register')
    page.remove()
  }

  return (
    <section className="surface">
      <div className="hr-bar">
        <input className="input" type="month" aria-label="Month" value={month} onChange={(e) => setMonth(e.target.value || thisMonth())} />
        <span className="hr-bar__grow" />
        <button type="button" className="btn btn-outline" disabled={!users.length} onClick={excel}><Download size={15} /> Excel</button>
        <button type="button" className="btn btn-outline" disabled={!users.length} onClick={print}><Printer size={15} /> Print</button>
      </div>
      {error ? <p className="hr-error">{error}</p> : null}
      <div className="hr-scroll print-area">
        <p style={{ margin: '0 0 8px', fontWeight: 700 }}>Attendance register · {monthName(month)}</p>
        <table className="hr-register">
          <thead><tr><th className="date">Date</th><th>Day</th>{users.map((u) => <th key={u.user_id}><button type="button" className="hr-link" title="Show day by day" onClick={() => onUser(u.user_id)}>{u.name}</button></th>)}</tr></thead>
          <tbody>
            {days.map((row, i) => (
              <tr key={row.date} className={row.date === todayIso() ? 'today' : row.off ? 'off' : undefined}>
                <td className="date">{dmy(row.date)}</td>
                <td>{weekday(row.date)}</td>
                {users.map((u) => {
                  const d = u.days[i]
                  const s = DAY_STATUS[d.status]
                  const title = [`${u.name}, ${dmy(d.date)}: ${s.label}`, d.off_name, d.leave?.name, d.in ? `${clock(d.in)} – ${d.out ? clock(d.out) : 'still in'}` : '', d.auto_closed ? 'no check out' : '', d.corrected ? 'corrected' : '', d.no_location ? 'without location' : ''].filter(Boolean).join(' · ')
                  return (
                    <td key={u.user_id} title={title}>
                      <b style={{ color: d.status === 'leave' && d.leave ? d.leave.color : s.color, background: s.background }}>{dayCode(d)}{d.auto_closed ? '*' : ''}</b>
                      {d.seconds ? <small>{duration(d.seconds)}</small> : null}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            {([['Present', (t) => t.present], ['Leave', (t) => t.leave], ['Absent', (t) => t.absent], ['Hours', (t) => duration(t.seconds)], ['Active in software', (t) => duration(t.active)]] as Array<[string, (t: ReturnType<typeof totals>) => React.ReactNode]>).map(([label, value]) => (
              <tr key={label}><td className="date" colSpan={2}>{label}</td>{users.map((u) => <td key={u.user_id}>{value(totals(u))}</td>)}</tr>
            ))}
          </tfoot>
        </table>
        <p className="hr-muted" style={{ marginTop: 10 }}>P present · A absent · H holiday · WO weekly off · ½ half day leave · OD on duty · P/H, P/WO worked on a holiday or weekly off · * no check out, ended with the last activity · dot: attendance not kept yet. Beside it: hours.</p>
      </div>
    </section>
  )
}

// ─── Time in software ────────────────────────────────────────────────────

function Usage({ onUser }: { onUser: (id: number) => void }) {
  const [range, setRange] = useState<Range>(() => ({ from: todayIso(), to: todayIso() }))
  const [users, setUsers] = useState<UsageUser[]>([])
  const [error, setError] = useState('')
  useEffect(() => { hrApi.usage(range.from, range.to).then((d) => { setUsers([...d].sort((a, b) => b.active - a.active)); setError('') }).catch((e: Error) => setError(e.message)) }, [range])
  const most = Math.max(1, ...users.map((u) => u.active + u.idle))

  const excel = () => downloadCsv(`Time in software ${dmy(range.from)} to ${dmy(range.to)}`, [
    ['Name', 'Days used', 'Active hours', 'Idle hours', 'Total hours', 'Attendance hours', 'Last active', 'Modules'],
    ...users.map((u) => [u.name, u.days, hours(u.active), hours(u.idle), hours(u.active + u.idle), hours(u.worked), stamp(u.last_active_at), u.modules.map((m) => `${moduleName(m.module)} ${duration(m.seconds)}`).join(', ')]),
  ])

  return (
    <section className="surface">
      <RangeBar range={range} onChange={setRange}><button type="button" className="btn btn-outline" onClick={excel}><Download size={15} /> Excel</button></RangeBar>
      <p className="hr-muted" style={{ margin: '0 0 12px' }}>Active: mouse, keyboard or touch within the last 10 minutes. Idle: software open without them, counted up to an hour.</p>
      {error ? <p className="hr-error">{error}</p> : null}
      <div className="hr-scroll">
        <table className="data-table" style={{ minWidth: 980 }}>
          <thead><tr><th>Name</th><th>Days used</th><th>Active</th><th>Idle</th><th>Total</th><th /><th>Attendance hours</th><th>Where the time went</th><th>Last active</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.user_id}>
                <td><NameButton id={u.user_id} name={u.name} onUser={onUser} /></td>
                <td>{u.days}</td>
                <td style={{ fontWeight: 700, color: '#15803d' }}>{duration(u.active)}</td>
                <td>{duration(u.idle)}</td>
                <td>{duration(u.active + u.idle)}</td>
                <td><div className="hr-meter" title={`Active ${duration(u.active)}, idle ${duration(u.idle)}`}><i style={{ width: `${(u.active / most) * 100}%` }} /><i style={{ width: `${(u.idle / most) * 100}%` }} /></div></td>
                <td>{duration(u.worked)}</td>
                <td style={{ fontSize: '0.8rem', maxWidth: 260 }}>{u.modules.slice(0, 4).map((m) => `${moduleName(m.module)} ${duration(m.seconds)}`).join(' · ') || '-'}</td>
                <td className="hr-muted" style={{ whiteSpace: 'nowrap' }}>{stamp(u.last_active_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

// ─── Work done ───────────────────────────────────────────────────────────

function Work({ onUser }: { onUser: (id: number) => void }) {
  const [range, setRange] = useState<Range>(() => ({ from: todayIso(), to: todayIso() }))
  const [columns, setColumns] = useState<string[]>([])
  const [users, setUsers] = useState<Array<{ user_id: number; name: string; attendance: boolean; counts: Record<string, number> }>>([])
  const [error, setError] = useState('')
  useEffect(() => { hrApi.work(range.from, range.to).then((d) => { setColumns(d.columns); setUsers(d.users); setError('') }).catch((e: Error) => setError(e.message)) }, [range])
  const sum = (c: string) => users.reduce((t, u) => t + u.counts[c], 0)

  return (
    <section className="surface">
      <RangeBar range={range} onChange={setRange}>
        <button type="button" className="btn btn-outline" onClick={() => downloadCsv(`Work done ${dmy(range.from)} to ${dmy(range.to)}`, [['Name', ...columns], ...users.map((u) => [u.name, ...columns.map((c) => u.counts[c])])])}><Download size={15} /> Excel</button>
      </RangeBar>
      <p className="hr-muted" style={{ margin: '0 0 12px' }}>How many each user made in these days (deleted ones are not counted).</p>
      {error ? <p className="hr-error">{error}</p> : null}
      <div className="hr-scroll">
        <table className="data-table" style={{ minWidth: 980 }}>
          <thead><tr><th>Name</th>{columns.map((c) => <th key={c} style={{ textAlign: 'right' }}>{c}</th>)}</tr></thead>
          <tbody>
            {users.map((u) => <tr key={u.user_id}><td>{u.attendance ? <NameButton id={u.user_id} name={u.name} onUser={onUser} /> : <strong>{u.name}</strong>}</td>{columns.map((c) => <td key={c} style={{ textAlign: 'right', color: u.counts[c] ? undefined : '#cbd5e1', fontWeight: u.counts[c] ? 700 : 400 }}>{u.counts[c]}</td>)}</tr>)}
            {users.length > 1 ? <tr><td><strong>Total</strong></td>{columns.map((c) => <td key={c} style={{ textAlign: 'right', fontWeight: 700 }}>{sum(c)}</td>)}</tr> : null}
          </tbody>
        </table>
      </div>
    </section>
  )
}

// ─── Logins ──────────────────────────────────────────────────────────────

function Logins() {
  const [range, setRange] = useState<Range>(() => ({ from: todayIso(), to: todayIso() }))
  const [sessions, setSessions] = useState<LoginRow[]>([])
  const [failed, setFailed] = useState<FailedLoginRow[]>([])
  const [error, setError] = useState('')
  const load = useCallback(() => hrApi.logins(range.from, range.to).then((d) => { setSessions(d.sessions); setFailed(d.failed); setError('') }).catch((e: Error) => setError(e.message)), [range])
  useEffect(() => { void load() }, [load])

  const act = async (text: string, action: () => Promise<unknown>) => {
    if (!window.confirm(text)) return
    try { await action() } catch (e) { window.alert((e as Error).message) }
    await load()
  }

  return (
    <>
      <RangeBar range={range} onChange={setRange} />
      {error ? <p className="hr-error">{error}</p> : null}
      <section className="surface" style={{ marginBottom: 16 }}>
        <div className="surface-heading"><div><p className="section-label">Security</p><h2>Logins ({sessions.length})</h2></div></div>
        <div className="hr-scroll">
          <table className="data-table" style={{ minWidth: 900 }}>
            <thead><tr><th>Name</th><th>Device</th><th>IP</th><th>Logged in</th><th>Last seen</th><th>Logged out</th><th /></tr></thead>
            <tbody>
              {sessions.length === 0 ? <tr><td colSpan={7} className="empty-state">No logins in these days.</td></tr> : sessions.map((s) => (
                <tr key={s.id}>
                  <td><strong>{s.name}</strong></td><td>{s.device}</td><td>{s.ip ?? '-'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{stamp(s.logged_in_at)}</td><td style={{ whiteSpace: 'nowrap' }}>{stamp(s.last_seen_at)}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{s.signed_in ? <Pill color="#15803d" background="#dcfce7">Signed in</Pill> : stamp(s.logged_out_at)}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{s.this_one ? <span className="hr-muted">This is you</span> : s.signed_in ? <>
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => void act(`Sign ${s.name} out on ${s.device}? Unsaved work there is lost.`, () => hrApi.signOutSession(s.id))}><LogOut size={14} /> Sign out</button>{' '}
                    <button type="button" className="ghost-button" onClick={() => void act(`Sign ${s.name} out everywhere? Unsaved work is lost.`, () => hrApi.signOutUser(s.user_id))}>Everywhere</button>
                  </> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="surface">
        <div className="surface-heading"><div><p className="section-label">Security</p><h2>Wrong passwords ({failed.length})</h2></div></div>
        <div className="hr-scroll">
          <table className="data-table" style={{ minWidth: 700 }}>
            <thead><tr><th>Time</th><th>Email typed</th><th>User</th><th>Device</th><th>IP</th></tr></thead>
            <tbody>
              {failed.length === 0 ? <tr><td colSpan={5} className="empty-state">None in these days.</td></tr> : failed.map((f) => (
                <tr key={f.id}><td style={{ whiteSpace: 'nowrap' }}>{stamp(f.created_at)}</td><td>{f.email}</td><td>{f.name ?? <span className="hr-muted">No such user</span>}</td><td>{f.device}</td><td>{f.ip ?? '-'}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}

// ─── Corrections ─────────────────────────────────────────────────────────

function Corrections({ onWaiting }: { onWaiting: (n: number) => void }) {
  const [list, setList] = useState<Correction[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(0)
  const load = useCallback(() => hrApi.corrections().then((d) => { setList(d); setError(''); onWaiting(d.filter((c) => c.status === 'pending').length) }).catch((e: Error) => setError(e.message)), [onWaiting])
  useEffect(() => { void load() }, [load])

  const decide = async (c: Correction, approve: boolean) => {
    const remark = approve ? '' : window.prompt('Why is it not approved?')
    if (remark === null) return
    setBusy(c.id)
    try { await hrApi.decideCorrection(c.id, approve, remark) } catch (e) { window.alert((e as Error).message) } finally { setBusy(0); void load() }
  }

  return (
    <section className="surface">
      <div className="surface-heading"><div><p className="section-label">Attendance</p><h2>Correction requests</h2></div></div>
      {error ? <p className="hr-error">{error}</p> : null}
      <div className="hr-scroll">
        <table className="data-table" style={{ minWidth: 900 }}>
          <thead><tr><th>Name</th><th>Date</th><th>Recorded</th><th>Asked for</th><th>Reason</th><th>Status</th><th /></tr></thead>
          <tbody>
            {list.length === 0 ? <tr><td colSpan={7} className="empty-state">No requests.</td></tr> : list.map((c) => (
              <tr key={c.id}>
                <td><strong>{c.user_name}</strong></td>
                <td style={{ whiteSpace: 'nowrap' }}>{dmy(c.date)} <span className="hr-muted">{weekday(c.date)}</span></td>
                <td>{c.recorded?.length ? c.recorded.map((s) => <SpellLine key={s.id} spell={s} />) : <span className="hr-muted">{c.status === 'pending' ? 'Nothing' : '-'}</span>}</td>
                <td style={{ whiteSpace: 'nowrap', fontWeight: 700 }}>{clock(c.check_in_at)} – {c.check_out_at ? clock(c.check_out_at) : 'still in'}</td>
                <td style={{ maxWidth: 240 }}>{c.reason}</td>
                <td><RequestPill status={c.status} />{c.decided_by ? <span className="hr-muted" style={{ display: 'block' }}>{c.decided_by}{c.remark ? `: ${c.remark}` : ''}</span> : null}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{c.status === 'pending' ? <>
                  <button type="button" className="btn btn-success btn-sm" disabled={busy === c.id} onClick={() => void decide(c, true)}><Check size={14} /> Approve</button>{' '}
                  <button type="button" className="btn btn-outline btn-sm" disabled={busy === c.id} onClick={() => void decide(c, false)}><X size={14} /> Reject</button>
                </> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

// ─── Settings ────────────────────────────────────────────────────────────

const WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const toggle = (list: number[], n: number) => (list.includes(n) ? list.filter((x) => x !== n) : [...list, n])

function Settings() {
  const [form, setForm] = useState<HrSettings | null>(null)
  const [users, setUsers] = useState<Array<{ id: number; name: string }>>([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => { hrApi.settings().then((r) => { setForm(r.data); setUsers(r.users) }).catch((e: Error) => setError(e.message)) }, [])
  if (!form) return error ? <p className="hr-error">{error}</p> : <p className="hr-muted">Loading…</p>
  const set = (patch: Partial<HrSettings>) => { setForm({ ...form, ...patch }); setNotice('') }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try { setForm(await hrApi.saveSettings(form)); setNotice('Saved.') } catch (err) { setError((err as Error).message) } finally { setSaving(false) }
  }
  const here = () => locate().then((p) => set({ office_lat: Number(p.lat.toFixed(6)), office_lng: Number(p.lng.toFixed(6)) })).catch((e: Error) => setError(e.message))
  const number = (v: string) => (v.trim() === '' ? null : Number(v))

  return (
    <form className="surface" onSubmit={save}>
      <div className="surface-heading"><div><p className="section-label">Attendance</p><h2>Settings</h2></div><button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button></div>
      {error ? <p className="hr-error">{error}</p> : null}
      {notice ? <p style={{ color: '#15803d' }}>{notice}</p> : null}
      <h3>Weekly off</h3>
      <div className="hr-bar">{WEEK.map((d, i) => <label key={d} className="checkbox-label"><input type="checkbox" checked={form.weekly_off.includes(i)} onChange={() => set({ weekly_off: toggle(form.weekly_off, i) })} /> {d}</label>)}</div>
      <div className="hr-bar"><span className="hr-muted">Saturdays off:</span>{['1st', '2nd', '3rd', '4th', '5th'].map((d, i) => <label key={d} className="checkbox-label"><input type="checkbox" checked={form.saturdays_off.includes(i + 1)} onChange={() => set({ saturdays_off: toggle(form.saturdays_off, i + 1) })} /> {d}</label>)}</div>
      <h3>Optional holidays</h3>
      <div className="hr-bar"><label>A user can choose <input className="input" style={{ width: 80 }} type="number" min={0} max={30} value={form.optional_limit} onChange={(e) => set({ optional_limit: Number(e.target.value) })} /> in a year</label></div>
      <h3>Office location</h3>
      <p className="hr-muted" style={{ margin: '0 0 8px' }}>With it, check ins show “At office” or how far away they were. Nobody is stopped from checking in elsewhere.</p>
      <div className="hr-bar">
        <label>Latitude <input className="input" style={{ width: 140 }} type="number" step="any" value={form.office_lat ?? ''} onChange={(e) => set({ office_lat: number(e.target.value) })} /></label>
        <label>Longitude <input className="input" style={{ width: 140 }} type="number" step="any" value={form.office_lng ?? ''} onChange={(e) => set({ office_lng: number(e.target.value) })} /></label>
        <label>Within (m) <input className="input" style={{ width: 100 }} type="number" min={20} max={10000} value={form.office_radius} onChange={(e) => set({ office_radius: Number(e.target.value) })} /></label>
        <button type="button" className="btn btn-outline" onClick={() => void here()}><MapPin size={15} /> I am at the office now</button>
      </div>
      <h3>Daily summary</h3>
      <label className="checkbox-label"><input type="checkbox" checked={form.daily_summary} onChange={(e) => set({ daily_summary: e.target.checked })} /> At 11:00 am on working days, notify admins who is in, on leave and not in</label>
      <h3 style={{ marginTop: 16 }}>Users without attendance</h3>
      <p className="hr-muted" style={{ margin: '0 0 8px' }}>Ticked users have no Check In button and are left out of all lists here.</p>
      <div className="hr-checks">{users.map((u) => <label key={u.id} className="checkbox-label"><input type="checkbox" checked={form.hidden_users.includes(u.id)} onChange={() => set({ hidden_users: toggle(form.hidden_users, u.id) })} /> {u.name}</label>)}</div>
    </form>
  )
}

// ─── One user ────────────────────────────────────────────────────────────

function UserModal({ id, onClose }: { id: number; onClose: () => void }) {
  const [range, setRange] = useState<Range>(() => ({ from: `${thisMonth()}-01`, to: todayIso() }))
  const [data, setData] = useState<UserDetail | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { hrApi.user(id, range.from, range.to).then((d) => { setData(d); setError('') }).catch((e: Error) => setError(e.message)) }, [id, range])
  const sum = (key: 'seconds' | 'active' | 'idle') => data?.days.reduce((t, d) => t + d[key], 0) ?? 0
  const most = Math.max(1, data?.modules[0]?.seconds ?? 0)

  return (
    <Modal title={data?.name ?? 'User'} subtitle="Attendance and software use" size="xl" onClose={onClose}>
      <RangeBar range={range} onChange={setRange} />
      {error ? <p className="hr-error">{error}</p> : null}
      <div className="hr-tiles">
        <div className="hr-tile"><span>Attendance hours</span><strong>{duration(sum('seconds'))}</strong></div>
        <div className="hr-tile"><span>Active in software</span><strong>{duration(sum('active'))}</strong></div>
        <div className="hr-tile"><span>Idle</span><strong>{duration(sum('idle'))}</strong></div>
      </div>
      <div className="hr-scroll">
        <table className="data-table" style={{ minWidth: 900 }}>
          <thead><tr><th>Date</th><th>Status</th><th>Check in / out and place</th><th>Hours</th><th>Active</th><th>Idle</th><th>In software</th></tr></thead>
          <tbody>
            {data?.days.filter((d) => d.status !== 'future').map((d) => {
              const s = DAY_STATUS[d.status]
              return (
                <tr key={d.date}>
                  <td style={{ whiteSpace: 'nowrap' }}><strong>{dmy(d.date)}</strong> <span className="hr-muted">{weekday(d.date)}</span></td>
                  <td><Pill color={s.color} background={s.background}>{s.label}</Pill>{d.leave || d.off_name ? <span className="hr-muted" style={{ display: 'block' }}>{d.leave?.name ?? d.off_name}</span> : null}</td>
                  <td>{data.spells.filter((x) => x.date === d.date).map((x) => <SpellLine key={x.id} spell={x} />)}</td>
                  <td style={{ fontWeight: 700 }}>{d.seconds ? duration(d.seconds) : '-'}</td>
                  <td>{d.active ? duration(d.active) : '-'}</td>
                  <td>{d.idle ? duration(d.idle) : '-'}</td>
                  <td className="hr-muted" style={{ whiteSpace: 'nowrap' }}>{d.first_at ? `${clock(d.first_at)} – ${clock(d.last_active_at)}` : '-'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="hr-split" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', marginTop: 18 }}>
        <div>
          <h3>Time per module</h3>
          {data?.modules.length ? <ul className="hr-list">{data.modules.map((m) => <li key={m.module}><span style={{ minWidth: 150 }}>{moduleName(m.module)}</span><div className="hr-meter"><i style={{ width: `${(m.seconds / most) * 100}%` }} /></div><strong>{duration(m.seconds)}</strong></li>)}</ul> : <p className="hr-muted">Nothing in these days.</p>}
        </div>
        <div>
          <h3>Actions</h3>
          {data?.actions.length ? <ul className="hr-list" style={{ maxHeight: 320, overflowY: 'auto' }}>{data.actions.map((a) => <li key={a.id}><span style={{ minWidth: 150 }}>{stamp(a.created_at)}</span><span>{a.action.replace(/_/g, ' ')}{a.details ? <span className="hr-muted"> · {a.details}</span> : null}</span></li>)}</ul> : <p className="hr-muted">Nothing in these days.</p>}
        </div>
      </div>
    </Modal>
  )
}
