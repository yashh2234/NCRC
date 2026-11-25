import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Pencil, Plus, X } from 'lucide-react'
import { DateInput } from '../components/DateInput'
import { Pill, RequestPill } from '../components/HrBits'
import { Modal } from '../components/Modal'
import { Req } from '../components/ui'
import { useAuth } from '../lib/auth'
import { useTracking } from '../lib/useTracking'
import { dmy, hrApi, num, stamp, todayIso, type LeaveBalance, type LeaveInput, type LeaveRequest, type LeaveType } from '../lib/hr'
import { Select } from '../components/Select'

type Tab = 'mine' | 'approve' | 'balances' | 'types'

const dates = (r: LeaveRequest) => `${dmy(r.from_date)}${r.to_date !== r.from_date ? ` to ${dmy(r.to_date)}` : ''}${r.half ? ` (${r.half} half)` : ''}`

export function LeavePage() {
  useTracking('leave')
  const { user } = useAuth()
  const isAdmin = Boolean(user?.is_admin)
  const canApprove = isAdmin || Boolean(user?.allowed_modules?.includes('leave_approve'))
  const [tab, setTab] = useState<Tab>(user?.is_super_admin ? 'approve' : 'mine')
  const thisYear = Number(todayIso().slice(0, 4))
  const [year, setYear] = useState(thisYear)
  const [pending, setPending] = useState(0)

  useEffect(() => {
    if (!canApprove) return
    hrApi.teamLeave(thisYear).then((list) => setPending(list.filter((r) => r.status === 'pending').length)).catch(() => undefined)
  }, [canApprove, thisYear])

  const tabs: Array<[Tab, string]> = user?.is_super_admin ? [] : [['mine', 'My leave']]
  if (canApprove) tabs.push(['approve', `Approvals${pending ? ` (${pending})` : ''}`], ['balances', 'Team balances'])
  if (isAdmin) tabs.push(['types', 'Leave types'])

  return (
    <div>
      <div className="hr-bar">
        {tabs.length > 1 ? <div className="tab-nav" style={{ margin: 0 }}>{tabs.map(([key, label]) => <button key={key} type="button" className={`tab-btn${tab === key ? ' active' : ''}`} onClick={() => setTab(key)}>{label}</button>)}</div> : null}
        <span className="hr-bar__grow" />
        {tab !== 'types' ? (
          <Select className="input" aria-label="Year" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {[thisYear + 1, thisYear, thisYear - 1, thisYear - 2].map((y) => <option key={y} value={y}>{y}</option>)}
          </Select>
        ) : null}
      </div>
      {tab === 'mine' ? <MyLeave year={year} /> : null}
      {tab === 'approve' ? <Approvals year={year} myId={user?.id ?? 0} isAdmin={isAdmin} onCount={setPending} /> : null}
      {tab === 'balances' ? <TeamBalances year={year} canEdit={isAdmin} /> : null}
      {tab === 'types' ? <Types /> : null}
    </div>
  )
}

// ─── My leave ────────────────────────────────────────────────────────────

function MyLeave({ year }: { year: number }) {
  const [balances, setBalances] = useState<LeaveBalance[]>([])
  const [requests, setRequests] = useState<LeaveRequest[]>([])
  const [error, setError] = useState('')
  const [applying, setApplying] = useState(false)

  const load = useCallback(() => hrApi.leave(year).then((d) => { setBalances(d.balances); setRequests(d.requests); setError('') }).catch((e: Error) => setError(e.message)), [year])
  useEffect(() => { void load() }, [load])

  const cancel = async (r: LeaveRequest) => {
    if (!window.confirm(`Cancel ${r.type}, ${dates(r)}?`)) return
    try { await hrApi.cancelLeave(r.id); await load() } catch (e) { window.alert((e as Error).message) }
  }

  return (
    <>
      {error ? <p className="hr-error">{error}</p> : null}
      <div className="hr-tiles">
        {balances.map((b) => (
          <div key={b.leave_type_id} className="hr-tile" style={{ borderTop: `3px solid ${b.color}` }}>
            <span>{b.name}</span>
            <strong>{b.left === null ? num(b.taken) : num(b.left)}</strong>
            <small>{b.left === null ? 'days taken · no limit set' : `left of ${num(b.quota ?? 0)} · ${num(b.taken)} taken`}{b.pending ? ` · ${num(b.pending)} waiting` : ''}</small>
          </div>
        ))}
      </div>
      <section className="surface">
        <div className="surface-heading">
          <div><p className="section-label">Leave</p><h2>My applications {year}</h2></div>
          <button type="button" className="btn btn-primary" disabled={!balances.some((b) => b.active)} onClick={() => setApplying(true)}><Plus size={16} /> Apply for leave</button>
        </div>
        <div className="hr-scroll">
          <table className="data-table" style={{ minWidth: 760 }}>
            <thead><tr><th>Type</th><th>Dates</th><th>Days</th><th>Reason</th><th>Status</th><th>Applied</th><th /></tr></thead>
            <tbody>
              {requests.length === 0 ? <tr><td colSpan={7} className="empty-state">No leave applied for in {year}.</td></tr> : requests.map((r) => (
                <tr key={r.id}>
                  <td><Pill color="#fff" background={r.color}>{r.code}</Pill> {r.type}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{dates(r)}</td>
                  <td style={{ fontWeight: 700 }}>{num(r.days)}</td>
                  <td style={{ whiteSpace: 'pre-wrap', maxWidth: 260 }}>{r.reason}</td>
                  <td><RequestPill status={r.status} />{r.decided_by ? <span className="hr-muted" style={{ display: 'block' }}>{r.decided_by}{r.remark ? `: ${r.remark}` : ''}</span> : null}</td>
                  <td className="hr-muted" style={{ whiteSpace: 'nowrap' }}>{stamp(r.created_at)}</td>
                  <td>{r.status === 'pending' || (r.status === 'approved' && r.from_date > todayIso()) ? <button type="button" className="ghost-button" onClick={() => void cancel(r)}>Cancel</button> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {applying ? <ApplyModal balances={balances.filter((b) => b.active)} onClose={() => setApplying(false)} onSaved={() => { setApplying(false); void load() }} /> : null}
    </>
  )
}

function ApplyModal({ balances, onClose, onSaved }: { balances: LeaveBalance[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<LeaveInput>({ leave_type_id: balances[0]?.leave_type_id ?? 0, from_date: todayIso(), to_date: todayIso(), half: null, reason: '' })
  const [days, setDays] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (patch: Partial<LeaveInput>) => setForm((f) => {
    const next = { ...f, ...patch }
    if (next.from_date && next.to_date < next.from_date) next.to_date = next.from_date
    if (next.to_date !== next.from_date) next.half = null
    return next
  })
  const { from_date: from, to_date: to, half } = form

  useEffect(() => {
    let current = true
    if (from && to) hrApi.leaveDays(from, to, half).then((d) => { if (current) setDays(d) }).catch(() => { if (current) setDays(null) })
    return () => { current = false }
  }, [from, to, half])

  const balance = balances.find((b) => b.leave_type_id === form.leave_type_id)
  const tooMany = days !== null && balance?.left != null && from.slice(0, 4) === todayIso().slice(0, 4) && days > balance.left

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try { await hrApi.applyLeave(form); onSaved() } catch (err) { setError((err as Error).message); setSaving(false) }
  }

  return (
    <Modal title="Apply for leave" size={560} onClose={onClose} onSubmit={save} saving={saving} saveLabel="Send application" saveDisabled={!from || !to || days === 0}>
      <div className="hr-form">
        <label className="wide"><span>Leave type<Req /></span>
          <Select className="input" value={form.leave_type_id} onChange={(e) => set({ leave_type_id: Number(e.target.value) })}>
            {balances.map((b) => <option key={b.leave_type_id} value={b.leave_type_id}>{b.name}{b.left === null ? '' : ` (${num(b.left)} left)`}</option>)}
          </Select>
        </label>
        <label><span>From<Req /></span><DateInput required value={from} onChange={(v) => set({ from_date: v })} /></label>
        <label><span>To<Req /></span><DateInput required value={to} onChange={(v) => set({ to_date: v })} /></label>
        <label className="wide"><span>Day</span>
          <Select className="input" value={half ?? ''} disabled={from !== to} onChange={(e) => set({ half: (e.target.value || null) as LeaveInput['half'] })}>
            <option value="">Full day</option><option value="first">First half</option><option value="second">Second half</option>
          </Select>
        </label>
        <label className="wide"><span>Reason<Req /></span><textarea className="input" required rows={3} maxLength={1000} value={form.reason} onChange={(e) => set({ reason: e.target.value })} /></label>
      </div>
      {days !== null ? <p className={`hr-note ${days === 0 || tooMany ? 'hr-note--warn' : 'hr-note--ok'}`} style={{ marginTop: 12 }}>{days === 0 ? 'These days are holidays or weekly offs.' : `Counts as ${num(days)} day(s). Holidays and weekly offs are not counted.`}{tooMany ? ` Only ${num(Math.max(0, balance?.left ?? 0))} left.` : ''}</p> : null}
      {error ? <p role="alert" className="hr-error">{error}</p> : null}
    </Modal>
  )
}

// ─── Approvals ───────────────────────────────────────────────────────────

function Approvals({ year, myId, isAdmin, onCount }: { year: number; myId: number; isAdmin: boolean; onCount: (n: number) => void }) {
  const [list, setList] = useState<LeaveRequest[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(0)
  const [rejecting, setRejecting] = useState<LeaveRequest | null>(null)
  const [remark, setRemark] = useState('')
  const [who, setWho] = useState('')

  const load = useCallback(() => hrApi.teamLeave(year).then((d) => { setList(d); setError(''); onCount(d.filter((r) => r.status === 'pending').length) }).catch((e: Error) => setError(e.message)), [year, onCount])
  useEffect(() => { void load() }, [load])

  const act = async (id: number, run: () => Promise<unknown>) => {
    setBusy(id)
    try { await run(); setRejecting(null) } catch (e) { window.alert((e as Error).message) } finally { setBusy(0); void load() }
  }

  const waiting = list.filter((r) => r.status === 'pending')
  const names = useMemo(() => [...new Set(list.map((r) => r.user_name ?? ''))].sort(), [list])
  const decided = list.filter((r) => r.status !== 'pending' && (!who || r.user_name === who))

  return (
    <>
      {error ? <p className="hr-error">{error}</p> : null}
      <section className="surface" style={{ marginBottom: 16 }}>
        <div className="surface-heading"><div><p className="section-label">Leave</p><h2>Waiting for approval ({waiting.length})</h2></div></div>
        {waiting.length === 0 ? <p className="empty-state">Nothing is waiting.</p> : (
          <div className="hr-scroll">
            <table className="data-table" style={{ minWidth: 900 }}>
              <thead><tr><th>Name</th><th>Leave</th><th>Dates</th><th>Days</th><th>Reason</th><th>Also away</th><th /></tr></thead>
              <tbody>
                {waiting.map((r) => {
                  const own = r.user_id === myId && !isAdmin
                  return (
                    <tr key={r.id}>
                      <td><strong>{r.user_name}</strong><span className="hr-muted" style={{ display: 'block' }}>{stamp(r.created_at)}</span></td>
                      <td><Pill color="#fff" background={r.color}>{r.code}</Pill> {r.type}{r.left_after != null ? <span className="hr-muted" style={{ display: 'block' }}>{num(r.left_after)} left after this</span> : null}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{dates(r)}</td>
                      <td style={{ fontWeight: 700 }}>{num(r.days)}</td>
                      <td style={{ whiteSpace: 'pre-wrap', maxWidth: 240 }}>{r.reason}</td>
                      <td style={{ maxWidth: 160 }}>{r.also_away?.length ? <span style={{ color: '#b45309' }}>{r.also_away.join(', ')}</span> : '-'}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {own ? <span className="hr-muted">Another approver decides</span> : <>
                          <button type="button" className="btn btn-success btn-sm" disabled={busy === r.id} onClick={() => void act(r.id, () => hrApi.decideLeave(r.id, true, ''))}><Check size={14} /> Approve</button>{' '}
                          <button type="button" className="btn btn-outline btn-sm" disabled={busy === r.id} onClick={() => { setRejecting(r); setRemark('') }}><X size={14} /> Reject</button>
                        </>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="surface">
        <div className="surface-heading">
          <div><p className="section-label">Leave</p><h2>Decided {year} ({decided.length})</h2></div>
          <Select className="input" style={{ width: 200 }} aria-label="User" value={who} onChange={(e) => setWho(e.target.value)}><option value="">All users</option>{names.map((n) => <option key={n}>{n}</option>)}</Select>
        </div>
        <div className="hr-scroll">
          <table className="data-table" style={{ minWidth: 820 }}>
            <thead><tr><th>Name</th><th>Leave</th><th>Dates</th><th>Days</th><th>Reason</th><th>Status</th><th /></tr></thead>
            <tbody>
              {decided.length === 0 ? <tr><td colSpan={7} className="empty-state">No applications.</td></tr> : decided.map((r) => (
                <tr key={r.id}>
                  <td><strong>{r.user_name}</strong></td>
                  <td><Pill color="#fff" background={r.color}>{r.code}</Pill> {r.type}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{dates(r)}</td>
                  <td style={{ fontWeight: 700 }}>{num(r.days)}</td>
                  <td style={{ whiteSpace: 'pre-wrap', maxWidth: 240 }}>{r.reason}</td>
                  <td><RequestPill status={r.status} />{r.decided_by ? <span className="hr-muted" style={{ display: 'block' }}>{r.decided_by}{r.remark ? `: ${r.remark}` : ''}</span> : null}</td>
                  <td>{r.status === 'approved' ? <button type="button" className="ghost-button" disabled={busy === r.id} onClick={() => { if (window.confirm(`Cancel the approved leave of ${r.user_name}, ${dates(r)}?`)) void act(r.id, () => hrApi.cancelLeave(r.id)) }}>Cancel leave</button> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {rejecting ? (
        <Modal title="Reject leave" subtitle={`${rejecting.user_name} · ${dates(rejecting)}`} size="sm" onClose={() => setRejecting(null)} saveLabel="Reject" saving={busy === rejecting.id} onSubmit={(e) => { e.preventDefault(); void act(rejecting.id, () => hrApi.decideLeave(rejecting.id, false, remark)) }}>
          <label><span>Why<Req /></span><textarea className="input" required rows={3} maxLength={480} value={remark} onChange={(e) => setRemark(e.target.value)} /></label>
        </Modal>
      ) : null}
    </>
  )
}

// ─── Team balances ───────────────────────────────────────────────────────

function TeamBalances({ year, canEdit }: { year: number; canEdit: boolean }) {
  const [types, setTypes] = useState<LeaveType[]>([])
  const [rows, setRows] = useState<Array<{ user_id: number; name: string; balances: LeaveBalance[] }>>([])
  const [error, setError] = useState('')
  const [edit, setEdit] = useState<{ user_id: number; name: string; balance: LeaveBalance; days: string } | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    hrApi.teamBalances(year).then((d) => { setTypes(d.types.filter((t) => t.active)); setRows(d.data); setError('') }).catch((e: Error) => setError(e.message))
  }, [year])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!edit) return
    setSaving(true)
    try {
      const balances = await hrApi.setQuota({ user_id: edit.user_id, leave_type_id: edit.balance.leave_type_id, year, days: edit.days.trim() === '' ? null : Number(edit.days) })
      setRows((list) => list.map((r) => (r.user_id === edit.user_id ? { ...r, balances } : r)))
      setEdit(null)
    } catch (err) { window.alert((err as Error).message) } finally { setSaving(false) }
  }

  return (
    <section className="surface">
      <div className="surface-heading"><div><p className="section-label">Leave</p><h2>Days left {year}</h2></div></div>
      <p className="hr-muted" style={{ margin: '0 0 12px' }}>Left / yearly days; ∞ = no limit set.{canEdit ? ' Click a number to give one user other days (also for comp-off). The days for everyone are set in Leave types.' : ''}</p>
      {error ? <p className="hr-error">{error}</p> : null}
      <div className="hr-scroll">
        <table className="data-table" style={{ minWidth: 700 }}>
          <thead><tr><th>Name</th>{types.map((t) => <th key={t.id} title={t.name}>{t.code}</th>)}</tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.user_id}>
                <td><strong>{r.name}</strong></td>
                {types.map((t) => {
                  const b = r.balances.find((x) => x.leave_type_id === t.id)
                  if (!b) return <td key={t.id}>-</td>
                  const text = b.quota === null ? `${num(b.taken)} taken / ∞` : `${num(b.left ?? 0)} / ${num(b.quota)}`
                  return (
                    <td key={t.id}>
                      {canEdit ? <button type="button" className="ghost-button" style={{ fontWeight: b.own_quota !== null ? 700 : 500 }} title={b.own_quota !== null ? 'Set for this user' : 'The type’s yearly days'} onClick={() => setEdit({ user_id: r.user_id, name: r.name, balance: b, days: b.own_quota === null ? '' : String(b.own_quota) })}>{text}</button> : text}
                      {b.pending ? <span className="hr-muted" style={{ display: 'block' }}>{num(b.pending)} waiting</span> : null}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {edit ? (
        <Modal title={`${edit.balance.name} ${year}`} subtitle={edit.name} size="sm" onClose={() => setEdit(null)} onSubmit={save} saving={saving}>
          <label><span>{edit.balance.granted ? 'Days granted' : 'Days for this user'}</span><input className="input" type="number" min={0} max={366} step={0.5} value={edit.days} onChange={(e) => setEdit({ ...edit, days: e.target.value })} placeholder={edit.balance.granted ? '0' : 'Empty = the type’s yearly days'} /></label>
          <p className="hr-muted">{num(edit.balance.taken)} taken, {num(edit.balance.pending)} waiting.</p>
        </Modal>
      ) : null}
    </section>
  )
}

// ─── Leave types ─────────────────────────────────────────────────────────

const newType: Omit<LeaveType, 'id'> = { name: '', code: '', color: '#2563eb', yearly_days: null, granted: false, counts_present: false, active: true }

function Types() {
  const [types, setTypes] = useState<LeaveType[]>([])
  const [error, setError] = useState('')
  const [edit, setEdit] = useState<{ id: number | null; form: Omit<LeaveType, 'id'> } | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => hrApi.teamBalances(Number(todayIso().slice(0, 4))).then((d) => setTypes(d.types)).catch((e: Error) => setError(e.message)), [])
  useEffect(() => { void load() }, [load])

  const set = (patch: Partial<LeaveType>) => setEdit((e) => (e ? { ...e, form: { ...e.form, ...patch } } : e))
  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!edit) return
    setSaving(true)
    try { await hrApi.saveLeaveType(edit.id, edit.form); setEdit(null); await load() } catch (err) { window.alert((err as Error).message) } finally { setSaving(false) }
  }

  return (
    <section className="surface">
      <div className="surface-heading"><div><p className="section-label">Leave</p><h2>Leave types</h2></div><button type="button" className="btn btn-primary" onClick={() => setEdit({ id: null, form: newType })}><Plus size={16} /> Add type</button></div>
      {error ? <p className="hr-error">{error}</p> : null}
      <div className="hr-scroll">
        <table className="data-table" style={{ minWidth: 620 }}>
          <thead><tr><th>Code</th><th>Name</th><th>Days a year</th><th>Counts as</th><th>In use</th><th /></tr></thead>
          <tbody>
            {types.map((t) => (
              <tr key={t.id}>
                <td><Pill color="#fff" background={t.color}>{t.code}</Pill></td>
                <td><strong>{t.name}</strong></td>
                <td>{t.granted ? 'Granted per user' : t.yearly_days === null ? 'No limit' : num(t.yearly_days)}</td>
                <td>{t.counts_present ? 'Present' : 'Leave'}</td>
                <td>{t.active ? 'Yes' : 'No'}</td>
                <td><button type="button" className="icon-button" title="Edit" onClick={() => setEdit({ id: t.id, form: { name: t.name, code: t.code, color: t.color, yearly_days: t.yearly_days, granted: t.granted, counts_present: t.counts_present, active: t.active } })}><Pencil size={15} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {edit ? (
        <Modal title={edit.id ? 'Edit leave type' : 'Add leave type'} size={520} onClose={() => setEdit(null)} onSubmit={save} saving={saving}>
          <div className="hr-form">
            <label><span>Name<Req /></span><input className="input" required maxLength={80} value={edit.form.name} onChange={(e) => set({ name: e.target.value })} /></label>
            <label><span>Code<Req /></span><input className="input" required maxLength={8} value={edit.form.code} onChange={(e) => set({ code: e.target.value.toUpperCase() })} /></label>
            <label><span>Days a year</span><input className="input" type="number" min={0} max={366} step={0.5} disabled={edit.form.granted} value={edit.form.yearly_days ?? ''} placeholder="Empty = no limit" onChange={(e) => set({ yearly_days: e.target.value === '' ? null : Number(e.target.value) })} /></label>
            <label><span>Colour</span><input className="input" type="color" value={edit.form.color} onChange={(e) => set({ color: e.target.value })} style={{ padding: 4, height: 42 }} /></label>
            <label className="checkbox-label wide"><input type="checkbox" checked={edit.form.granted} onChange={(e) => set({ granted: e.target.checked })} /> Only what admin grants each user (comp-off)</label>
            <label className="checkbox-label wide"><input type="checkbox" checked={edit.form.counts_present} onChange={(e) => set({ counts_present: e.target.checked })} /> Counts as present (on duty / site)</label>
            <label className="checkbox-label wide"><input type="checkbox" checked={edit.form.active} onChange={(e) => set({ active: e.target.checked })} /> Can be applied for</label>
          </div>
        </Modal>
      ) : null}
    </section>
  )
}
