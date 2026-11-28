import { useEffect, useRef, useState } from 'react'
import { CalendarRange, Check, ChevronDown } from 'lucide-react'
import type { DashCompare, DashPeriod, DashRange } from '../lib/homeDashboard'

const PERIODS: Array<{ key: DashPeriod; label: string }> = [
  { key: 'today', label: 'Today' }, { key: 'week', label: 'This week' }, { key: 'month', label: 'This month' }, { key: 'last_month', label: 'Last month' },
  { key: 'quarter', label: 'This quarter' }, { key: 'prev_quarter', label: 'Previous quarter' }, { key: 'year', label: 'This year' },
]
const COMPARES: Array<{ key: DashCompare; label: string }> = [
  { key: 'previous', label: 'Previous period' }, { key: 'last_year', label: 'Same dates last year' }, { key: 'none', label: 'Off' },
]

/**
 * The dashboard's period: quick choices, custom dates, and what the ↑ / ↓ compare with.
 * Year and quarters are the financial year (April to March).
 */
export function PeriodPicker({ value, range, compareText, onChange }: {
  value: DashRange
  /** "1 Nov – 28 Nov 2026" as the server worked it out */
  range?: string
  compareText?: string
  onChange: (next: DashRange) => void
}) {
  const [open, setOpen] = useState(false)
  const [from, setFrom] = useState(value.from ?? '')
  const [to, setTo] = useState(value.to ?? '')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const click = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', click)
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('mousedown', click); document.removeEventListener('keydown', key) }
  }, [open])

  const label = value.period === 'custom' ? 'Custom dates' : PERIODS.find((p) => p.key === value.period)?.label ?? 'This month'
  const pick = (period: DashPeriod) => { onChange({ ...value, period, from: undefined, to: undefined }); setOpen(false) }
  const applyCustom = () => {
    if (!from || !to) return
    onChange({ ...value, period: 'custom', from: from <= to ? from : to, to: from <= to ? to : from })
    setOpen(false)
  }

  return (
    <div className="pp" ref={ref}>
      <button type="button" className="pp-button" aria-haspopup="dialog" aria-expanded={open} title={compareText ? `↑ / ↓ compare ${compareText.replace(/^vs /, 'with ')}` : undefined} onClick={() => setOpen(!open)}>
        <CalendarRange size={16} />
        <span className="pp-button__text"><strong>{label}</strong>{range ? <small>{range}</small> : null}</span>
        <ChevronDown size={15} />
      </button>
      {open ? (
        <div className="pp-pop" role="dialog" aria-label="Choose the period">
          <p className="pp-title">Period</p>
          <div className="pp-chips">
            {PERIODS.map((p) => (
              <button key={p.key} type="button" className={value.period === p.key ? 'is-on' : undefined} aria-pressed={value.period === p.key} onClick={() => pick(p.key)}>
                {value.period === p.key ? <Check size={13} /> : null}{p.label}
              </button>
            ))}
          </div>
          <p className="pp-title">Custom dates</p>
          <div className="pp-custom">
            <label><span>From</span><input className="input" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} /></label>
            <label><span>To</span><input className="input" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} /></label>
            <button type="button" className="btn btn-primary" disabled={!from || !to} onClick={applyCustom}>Apply</button>
          </div>
          <p className="pp-title">Compare with</p>
          <div className="pp-chips pp-chips--line">
            {COMPARES.map((c) => (
              <button key={c.key} type="button" className={value.compare === c.key ? 'is-on' : undefined} aria-pressed={value.compare === c.key} onClick={() => onChange({ ...value, compare: c.key })}>
                {value.compare === c.key ? <Check size={13} /> : null}{c.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
