import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import type { DashBar, DashColor, DashSlice, Tone } from '../lib/homeDashboard'

/**
 * Small charts for the dashboard cards, drawn as plain SVG / boxes.
 * Colours (validated): categories blue / orange / aqua; states green / amber / red / grey (always with a label);
 * age a single blue, darker = older. Every mark has its number written beside it, so no chart relies on colour alone.
 */
const COLORS: Record<DashColor, string> = {
  c1: '#257de0', c2: '#f47230', c3: '#00b894',
  good: '#0aac23', warn: '#fbb315', bad: '#dc3c3d', muted: '#94a3b8',
  age1: '#84b9f3', age2: '#338ced', age3: '#1b64be', age4: '#0f4a96',
}
const TONE: Record<Exclude<Tone, null>, string> = { good: COLORS.good, warn: '#d97706', bad: COLORS.bad }
const BAR = '#257de0'

/** A small line of the last months under a number */
export function Spark({ values, tone }: { values: number[]; tone?: Tone }) {
  if (values.length < 2 || values.every((v) => v === 0)) return null
  const max = Math.max(...values)
  const min = Math.min(...values)
  const span = max - min || 1
  const points = values.map((v, i) => [(i / (values.length - 1)) * 96 + 2, 22 - ((v - min) / span) * 18])
  const color = tone ? TONE[tone] : BAR
  return (
    <svg className="hd-spark" viewBox="0 0 100 26" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={points.map((p) => p.join(',')).join(' ')} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={points[points.length - 1][0]} cy={points[points.length - 1][1]} r="2.6" fill={color} />
    </svg>
  )
}

/** ↑ 12% / ↓ 8% against the same stretch before */
export function Change({ value, compare }: { value: number | null | undefined; compare: string }) {
  if (value === null || value === undefined) return null
  const Icon = value > 0 ? ArrowUpRight : value < 0 ? ArrowDownRight : Minus
  return (
    <span className={`hd-change hd-change--${value > 0 ? 'up' : value < 0 ? 'down' : 'flat'}`} title={compare}>
      <Icon size={13} />{Math.abs(value)}%
    </span>
  )
}

/** A ring with the total in the middle, and a legend with each number */
export function Donut({ center, centerLabel, slices, onOpen }: { center: string | number; centerLabel: string; slices: DashSlice[]; onOpen: (m: string) => void }) {
  const total = slices.reduce((s, x) => s + x.value, 0)
  const r = 40
  const c = 2 * Math.PI * r
  const gap = total > 0 && slices.filter((s) => s.value > 0).length > 1 ? 2 : 0
  let offset = 0
  return (
    <div className="hd-donut">
      <svg viewBox="0 0 100 100" role="img" aria-label={`${center} ${centerLabel}`}>
        <circle cx="50" cy="50" r={r} fill="none" stroke="#eef2f7" strokeWidth="13" />
        {total > 0 ? slices.filter((s) => s.value > 0).map((s) => {
          const len = (s.value / total) * c
          const el = (
            <circle key={s.label} cx="50" cy="50" r={r} fill="none" stroke={COLORS[s.color]} strokeWidth="13"
              strokeDasharray={`${Math.max(0, len - gap)} ${c - Math.max(0, len - gap)}`} strokeDashoffset={-offset} transform="rotate(-90 50 50)">
              <title>{`${s.label}: ${s.value}`}</title>
            </circle>
          )
          offset += len
          return el
        }) : null}
        <text x="50" y="49" textAnchor="middle" className="hd-donut__num">{center}</text>
        <text x="50" y="63" textAnchor="middle" className="hd-donut__label">{centerLabel}</text>
      </svg>
      <ul className="hd-legend">
        {slices.map((s) => (
          <li key={s.label}>
            <button type="button" disabled={!s.module} onClick={() => s.module && onOpen(s.module)}>
              <i style={{ background: COLORS[s.color] }} /><span>{s.label}</span><strong>{s.text ?? s.value}</strong>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Progress: value of max, with the text under it */
export function Bars({ bars, onOpen }: { bars: DashBar[]; onOpen: (m: string) => void }) {
  return (
    <div className="hd-bars">
      {bars.map((b) => {
        const pct = b.max > 0 ? Math.min(100, (b.value / b.max) * 100) : 0
        return (
          <button key={b.label} type="button" className="hd-bar" disabled={!b.module} onClick={() => b.module && onOpen(b.module)}>
            <span className="hd-bar__top"><span>{b.label}</span><strong>{Math.round(pct)}%</strong></span>
            <span className="hd-bar__track"><span style={{ width: `${pct}%`, background: b.tone ? TONE[b.tone] : BAR }} /></span>
            <small>{b.text}</small>
          </button>
        )
      })}
    </div>
  )
}

/** Steps that get smaller: enquiries → quotations → accepted, with how many go on to each next step */
export function Funnel({ steps }: { steps: Array<{ label: string; value: number }> }) {
  const max = Math.max(1, ...steps.map((s) => s.value))
  return (
    <div className="hd-funnel">
      {steps.map((s, i) => {
        const prev = i > 0 ? steps[i - 1].value : null
        return (
          <div key={s.label} className="hd-funnel__row">
            <span className="hd-funnel__label">{s.label}</span>
            <span className="hd-funnel__track"><span style={{ width: `${Math.max(s.value ? 4 : 0, (s.value / max) * 100)}%` }} /></span>
            <strong>{s.value}</strong>
            <small>{prev ? `${Math.round((s.value / prev) * 100)}%` : ''}</small>
          </div>
        )
      })}
    </div>
  )
}

/** One bar cut into parts, with each part's amount below */
export function Stack({ total, parts }: { total: string; parts: DashSlice[] }) {
  const sum = parts.reduce((s, p) => s + p.value, 0)
  return (
    <div className="hd-stack">
      <p className="hd-stack__total">{total}</p>
      <div className="hd-stack__bar" role="img" aria-label={parts.map((p) => `${p.label} ${p.text ?? p.value}`).join(', ')}>
        {sum > 0 ? parts.filter((p) => p.value > 0).map((p) => <span key={p.label} style={{ flexGrow: p.value, background: COLORS[p.color] }} title={`${p.label}: ${p.text ?? p.value}`} />) : <span style={{ flexGrow: 1, background: '#eef2f7' }} />}
      </div>
      <ul className="hd-legend hd-legend--grid">
        {parts.map((p) => <li key={p.label}><span className="hd-legend__static"><i style={{ background: COLORS[p.color] }} /><span>{p.label}</span><strong>{p.text ?? p.value}</strong></span></li>)}
      </ul>
    </div>
  )
}

/** Ranked bars: top clients, enquiry sources */
export function HBars({ rows }: { rows: Array<{ label: string; value: number; text: string }> }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <div className="hd-hbars">
      {rows.map((r) => (
        <div key={r.label} className="hd-hbar">
          <span className="hd-hbar__top"><span title={r.label}>{r.label}</span><strong>{r.text}</strong></span>
          <span className="hd-bar__track"><span style={{ width: `${Math.max(2, (r.value / max) * 100)}%`, background: BAR }} /></span>
        </div>
      ))}
    </div>
  )
}

/** Per person: one stacked bar of days (on time / late / leave / absent) */
export function People({ keys, rows }: { keys: Array<{ key: string; label: string; color: DashColor }>; rows: Array<Record<string, string | number>> }) {
  const max = Math.max(1, ...rows.map((r) => keys.reduce((s, k) => s + Number(r[k.key] || 0), 0)))
  return (
    <div className="hd-people">
      <ul className="hd-legend hd-legend--inline">
        {keys.map((k) => <li key={k.key}><span className="hd-legend__static"><i style={{ background: COLORS[k.color] }} /><span>{k.label}</span></span></li>)}
      </ul>
      {rows.map((r) => {
        const sum = keys.reduce((s, k) => s + Number(r[k.key] || 0), 0)
        return (
          <div key={String(r.name)} className="hd-person">
            <span className="hd-person__name" title={String(r.name)}>{r.name}</span>
            <span className="hd-person__bar" style={{ width: `${(sum / max) * 100}%` }}>
              {keys.filter((k) => Number(r[k.key]) > 0).map((k) => (
                <span key={k.key} style={{ flexGrow: Number(r[k.key]), background: COLORS[k.color] }} title={`${k.label}: ${r[k.key]}`} />
              ))}
            </span>
            <span className="hd-person__nums">{keys.map((k) => <span key={k.key} className={Number(r[k.key]) ? undefined : 'hd-zero'} title={k.label}>{r[k.key]}</span>)}</span>
          </div>
        )
      })}
    </div>
  )
}
