import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react'
import { DateInput } from '../components/DateInput'
import { Pill } from '../components/HrBits'
import { Modal } from '../components/Modal'
import { Req } from '../components/ui'
import { useAuth } from '../lib/auth'
import { useTracking } from '../lib/useTracking'
import { dmy, hrApi, monthName, thisMonth, todayIso, weekday, type Holiday, type HolidayYear } from '../lib/hr'
import { Select } from '../components/Select'
import { showSaved } from '../lib/toast'

interface HolidayForm { date: string; name: string; type: 'holiday' | 'optional'; tentative: boolean }

export function HolidaysPage() {
  useTracking('holidays')
  const { user } = useAuth()
  const isAdmin = Boolean(user?.is_admin)
  const [month, setMonth] = useState(thisMonth)
  const year = Number(month.slice(0, 4))
  const [data, setData] = useState<HolidayYear | null>(null)
  const [error, setError] = useState('')
  const [edit, setEdit] = useState<{ id: number | null; form: HolidayForm } | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => hrApi.holidays(year).then((d) => { setData(d); setError('') }).catch((e: Error) => setError(e.message)), [year])
  useEffect(() => { void load() }, [load])

  const shift = (by: number) => {
    const [y, m] = month.split('-').map(Number)
    const d = new Date(Date.UTC(y, m - 1 + by, 1))
    setMonth(d.toISOString().slice(0, 7))
  }

  const run = async (action: () => Promise<unknown>) => {
    try { await action() } catch (e) { window.alert((e as Error).message) }
    await load()
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!edit) return
    setSaving(true)
    try { await hrApi.saveHoliday(edit.id, edit.form); setEdit(null); showSaved('Saved holiday'); await load() } catch (err) { window.alert((err as Error).message) } finally { setSaving(false) }
  }

  const [y, m] = month.split('-').map(Number)
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7
  const days = Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)
  const off = new Set(data?.weekly_off)
  const today = data?.today ?? todayIso()
  const tentative = data?.holidays.some((h) => h.tentative)

  return (
    <div>
      {error ? <p className="hr-error">{error}</p> : null}
      <div className="hr-split">
        <section className="surface">
          <div className="hr-bar" style={{ marginBottom: 12 }}>
            <button type="button" className="icon-button" title="Earlier month" onClick={() => shift(-1)}><ChevronLeft size={18} /></button>
            <h2 style={{ margin: 0, minWidth: 150, textAlign: 'center' }}>{monthName(month)}</h2>
            <button type="button" className="icon-button" title="Later month" onClick={() => shift(1)}><ChevronRight size={18} /></button>
            <button type="button" className="ghost-button" onClick={() => setMonth(thisMonth())}>Today</button>
          </div>
          <div className="hr-cal">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="hr-cal__head">{d}</div>)}
            {Array.from({ length: lead }, (_, i) => <div key={`b${i}`} />)}
            {days.map((d) => {
              const holidays = data?.holidays.filter((h) => h.date === d) ?? []
              const closed = holidays.some((h) => h.type === 'holiday' || h.picked)
              return (
                <div key={d} className={`hr-cal__day${off.has(d) ? ' hr-cal__day--off' : ''}${closed ? ' hr-cal__day--holiday' : ''}${d === today ? ' hr-cal__day--today' : ''}`}>
                  <b>{Number(d.slice(8))}</b>
                  {off.has(d) && !holidays.length ? <span style={{ color: '#94a3b8' }}>Weekly off</span> : null}
                  {holidays.map((h) => <span key={h.id} className={h.type === 'optional' ? 'hr-cal__optional' : 'hr-cal__holiday'} title={h.name}>{h.name}{h.type === 'optional' ? ` (optional${h.picked ? ', chosen' : ''})` : ''}</span>)}
                  {data?.away[d]?.map((a) => <span key={a.name} className="hr-cal__away">{a.name} on leave{a.half ? ' (½)' : ''}</span>)}
                  {data?.birthdays.filter((b) => b.date === d).map((b) => <span key={b.name} className="hr-cal__birthday">🎂 {b.name}</span>)}
                </div>
              )
            })}
          </div>
        </section>

        <section className="surface">
          <div className="surface-heading">
            <div><p className="section-label">Holidays</p><h2>{year} ({data?.holidays.filter((h) => h.type === 'holiday').length ?? 0})</h2></div>
            {isAdmin ? <button type="button" className="btn btn-primary btn-sm" onClick={() => setEdit({ id: null, form: { date: `${month}-01`, name: '', type: 'holiday', tentative: false } })}><Plus size={15} /> Add</button> : null}
          </div>
          {tentative ? <p className="hr-note hr-note--warn">{isAdmin ? 'Tentative dates come from published calendars, not the government order. Check them against the Rajasthan order and edit.' : 'Dates marked tentative may still change.'}</p> : null}
          {!user?.is_super_admin && data?.holidays.some((h) => h.type === 'optional') ? <p className="hr-note">You have chosen {data.optional_used} of {data.optional_limit} optional holidays.</p> : null}
          <ul className="hr-list" style={{ maxHeight: 620, overflowY: 'auto' }}>
            {data?.holidays.length === 0 ? <li>No holidays added for {year}.</li> : null}
            {data?.holidays.map((h: Holiday) => (
              <li key={h.id} style={{ opacity: h.date < today ? 0.55 : 1 }}>
                <span>{dmy(h.date)}<small className="hr-muted" style={{ display: 'block' }}>{weekday(h.date)}</small></span>
                <span><strong>{h.name}</strong>{h.type === 'optional' ? <> <Pill color="#6d28d9" background="#ede9fe">Optional</Pill></> : null}{h.tentative ? <> <Pill color="#b45309" background="#fef3c7">Tentative</Pill></> : null}</span>
                {h.type === 'optional' && h.date > today && !user?.is_super_admin ? <button type="button" className={`btn btn-sm ${h.picked ? 'btn-outline' : 'btn-primary'}`} onClick={() => void run(() => hrApi.pickHoliday(h.id, !h.picked))}>{h.picked ? 'Undo' : 'Choose'}</button> : null}
                {isAdmin ? <span style={{ whiteSpace: 'nowrap' }}>
                  <button type="button" className="icon-button" title="Edit" onClick={() => setEdit({ id: h.id, form: { date: h.date, name: h.name, type: h.type, tentative: h.tentative } })}><Pencil size={14} /></button>
                  <button type="button" className="icon-button" title="Delete" onClick={() => { if (window.confirm(`Delete ${h.name} (${dmy(h.date)})?`)) void run(() => hrApi.deleteHoliday(h.id)) }}><Trash2 size={14} /></button>
                </span> : null}
              </li>
            ))}
          </ul>
        </section>
      </div>

      {edit ? (
        <Modal title={edit.id ? 'Edit holiday' : 'Add holiday'} size="sm" onClose={() => setEdit(null)} onSubmit={save} saving={saving}>
          <div className="hr-form">
            <label><span>Date<Req /></span><DateInput required value={edit.form.date} onChange={(date) => setEdit({ ...edit, form: { ...edit.form, date } })} /></label>
            <label><span>Type</span>
              <Select className="input" value={edit.form.type} onChange={(e) => setEdit({ ...edit, form: { ...edit.form, type: e.target.value as HolidayForm['type'] } })}><option value="holiday">Holiday for all</option><option value="optional">Optional (users choose)</option></Select>
            </label>
            <label className="wide"><span>Name<Req /></span><input className="input" required maxLength={120} value={edit.form.name} onChange={(e) => setEdit({ ...edit, form: { ...edit.form, name: e.target.value } })} /></label>
            <label className="checkbox-label wide"><input type="checkbox" checked={edit.form.tentative} onChange={(e) => setEdit({ ...edit, form: { ...edit.form, tentative: e.target.checked } })} /> Date is tentative</label>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}
