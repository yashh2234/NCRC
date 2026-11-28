import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, ChevronRight, ClipboardCheck, Mail, RefreshCw, Settings2, Table2, BarChart3 } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { homeDashboardApi, QUICK_PAGES, type DashCardData, type DashCardInfo, type DashRange, type HomeDashboardData, type TrendMonth } from '../lib/homeDashboard'
import { Bars, Change, Donut, Funnel, HBars, People, Spark, Stack } from './DashCharts'
import { PeriodPicker } from './PeriodPicker'
import { showToast } from '../lib/toast'
import { iconMap } from './navIcons'
import { Modal } from './Modal'

interface Props {
  /** Open a page of the app */
  onOpen: (module: string) => void
  /** Pages the user can open (for quick actions) */
  modules: Array<{ key: string; label: string }>
  /** The phone: number tiles 2 per row, cards one under the other */
  phone?: boolean
  /** Phone: the Approvals tab */
  onApprovals?: () => void
}

/** Cards in order, cut at each wide card: [{keys: [a, b, c]}, {wide, keys: [trends]}, …] */
function blocks(keys: string[], isWide: (key: string) => boolean): Array<{ wide: boolean; keys: string[] }> {
  const out: Array<{ wide: boolean; keys: string[] }> = []
  for (const key of keys) {
    if (isWide(key)) out.push({ wide: true, keys: [key] })
    else if (out.length && !out[out.length - 1].wide) out[out.length - 1].keys.push(key)
    else out.push({ wide: false, keys: [key] })
  }
  return out
}

/** Wide enough for two columns of cards */
function useWide(): boolean {
  const query = '(min-width: 1001px)'
  const [wide, setWide] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const m = window.matchMedia(query)
    const on = () => setWide(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  return wide
}

/** Series colours (validated: blue / orange; orange is light on white, so a legend and a table view go with it) */
const SERIES = ['#257de0', '#f47230']

/** The user's own dashboard: the cards they picked, in their order. The same on the computer and the phone. */
export function HomeDashboard({ onOpen, modules, phone = false, onApprovals }: Props) {
  const [dash, setDash] = useState<HomeDashboardData | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  // The period and what it is compared with: remembered on this device
  const [range, setRange] = useState<DashRange>(() => {
    try { return { period: 'month', compare: 'previous', ...JSON.parse(localStorage.getItem('dash_range') ?? '{}') } } catch { return { period: 'month', compare: 'previous' } }
  })
  /** No refresh while the user is changing the cards */
  const editingRef = useRef(false)
  useEffect(() => { editingRef.current = editing }, [editing])

  const load = useCallback(() => {
    setLoading(true)
    homeDashboardApi.get(range).then((d) => { setDash(d); setError('') }).catch((e: Error) => setError(e.message)).finally(() => setLoading(false))
  }, [range])
  const chooseRange = (next: DashRange) => { localStorage.setItem('dash_range', JSON.stringify(next)); setRange(next) }
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])
  // Auto-refresh: every 2 minutes while it is on screen, and when the user comes back to the tab / app
  useEffect(() => {
    const visible = () => document.visibilityState === 'visible'
    const timer = window.setInterval(() => { if (visible() && !editingRef.current) load() }, 120000)
    const back = () => { if (visible() && !editingRef.current) load() }
    document.addEventListener('visibilitychange', back)
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', back) }
  }, [load])

  const twoCols = useWide() && !phone
  const quick = QUICK_PAGES.map((k) => modules.find((m) => m.key === k)).filter((m): m is { key: string; label: string } => Boolean(m))
  const info = (key: string) => dash?.cards.find((c) => c.key === key)

  return (
    <div className={`hd${phone ? ' hd--phone' : ''}`}>
      <div className="hd-head">
        <PeriodPicker value={range} range={dash?.range} compareText={dash?.compare} onChange={chooseRange} />
        <div className="hd-head__actions">
          <button type="button" className="hd-icon-btn" title="Refresh" aria-label="Refresh" disabled={loading} onClick={load}><RefreshCw size={16} className={loading ? 'hd-spin' : undefined} /></button>
          {dash ? <button type="button" className="hd-edit-btn" onClick={() => setEditing(true)}><Settings2 size={16} /> {phone ? 'Edit' : 'Edit dashboard'}</button> : null}
        </div>
      </div>

      {error ? <p role="alert" className="hd-error">{error} <button type="button" className="hd-link" onClick={load}>Try again</button></p> : null}
      {!dash && loading ? <div className="hd-grid">{[0, 1, 2, 3].map((i) => <div key={i} className="hd-card hd-card--skeleton" />)}</div> : null}

      {dash ? (
        dash.layout.length === 0 ? (
          <div className="hd-card hd-empty-all">
            <p>No cards on your dashboard.</p>
            <button type="button" className="hd-edit-btn" onClick={() => setEditing(true)}><Settings2 size={16} /> Choose cards</button>
          </div>
        ) : (
          <div className="hd-flow">
            {blocks(dash.layout.filter((key) => info(key)), (key) => Boolean(info(key)?.wide)).map((block, i) => {
              const render = (key: string) => {
                const card = info(key)!
                return key === 'quick_actions'
                  ? <QuickCard key={key} title={card.title} quick={quick} onOpen={onOpen} />
                  : <DataCard key={key} card={card} data={dash.data[key] ?? {}} onOpen={onOpen} onApprovals={onApprovals} phone={phone} compare={dash.compare} />
              }
              if (block.wide) return render(block.keys[0])
              // Two columns that stack on their own (no empty gap beside a short card); one column, in order, when narrow
              return twoCols ? (
                <div key={i} className="hd-cols">
                  <div className="hd-col">{block.keys.filter((_, n) => n % 2 === 0).map(render)}</div>
                  <div className="hd-col">{block.keys.filter((_, n) => n % 2 === 1).map(render)}</div>
                </div>
              ) : <div key={i} className="hd-col">{block.keys.map(render)}</div>
            })}
          </div>
        )
      ) : null}

      {editing && dash ? <EditCards dash={dash} range={range} onClose={() => setEditing(false)} onSaved={(d) => { setDash(d); setEditing(false) }} /> : null}
    </div>
  )
}

function CardHead({ title, onOpenAll }: { title: string; onOpenAll?: () => void }) {
  return (
    <div className="hd-card__head">
      <h3>{title}</h3>
      {onOpenAll ? <button type="button" className="hd-link" onClick={onOpenAll}>Open <ChevronRight size={14} /></button> : null}
    </div>
  )
}

function DataCard({ card, data, onOpen, onApprovals, phone, compare }: { card: DashCardInfo; data: DashCardData; onOpen: (m: string) => void; onApprovals?: () => void; phone: boolean; compare: string }) {
  const openAll = data.approvals && onApprovals ? onApprovals : data.module ? () => onOpen(data.module!) : undefined
  return (
    <section className={`hd-card${card.wide ? ' hd-card--wide' : ''}`}>
      <CardHead title={card.title} onOpenAll={openAll} />
      {data.error ? <p className="hd-error">{data.error}</p> : null}
      {data.donut ? <Donut {...data.donut} onOpen={onOpen} /> : null}
      {data.stack ? <Stack {...data.stack} /> : null}
      {data.funnel?.length ? <Funnel steps={data.funnel} /> : null}
      {data.bars?.length ? <Bars bars={data.bars} onOpen={onOpen} /> : null}
      {data.hbars?.length ? <HBars rows={data.hbars} /> : null}
      {data.people ? <People {...data.people} /> : null}
      {data.tiles?.length ? (
        <div className="hd-tiles">
          {data.tiles.map((t) => (
            <button key={t.label} type="button" className={`hd-tile${t.tone ? ` hd-tile--${t.tone}` : ''}`} disabled={!t.module} onClick={() => t.module && onOpen(t.module)}>
              <span className="hd-tile__top"><strong>{t.value}</strong><Change value={t.change} compare={compare} /></span>
              <span>{t.label}</span>
              {t.hint ? <small>{t.hint}</small> : null}
              {t.spark ? <Spark values={t.spark} tone={t.tone} /> : null}
            </button>
          ))}
        </div>
      ) : null}
      {data.list?.length ? (
        <ul className="hd-list">
          {data.list.map((item, i) => (
            <li key={i}>
              <button type="button" className={item.tone ? `hd-list--${item.tone}` : undefined} disabled={!item.module} onClick={() => item.module && onOpen(item.module)}>
                <span className="hd-list__title">{item.title}</span>
                {item.detail ? <span className="hd-list__detail">{item.detail}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {data.chart ? <TrendCharts months={data.chart} phone={phone} /> : null}
      {data.table ? <WhoTable table={data.table} /> : null}
      {data.empty && !data.list?.length && !data.table?.rows.length ? <p className="hd-muted">{data.empty}</p> : null}
    </section>
  )
}

function QuickCard({ title, quick, onOpen }: { title: string; quick: Array<{ key: string; label: string }>; onOpen: (m: string) => void }) {
  return (
    <section className="hd-card">
      <CardHead title={title} />
      <div className="hd-quick">
        {quick.map((m) => {
          const Icon = m.key === 'mail' ? Mail : iconMap[m.key] ?? ClipboardCheck
          return <button key={m.key} type="button" onClick={() => onOpen(m.key)}><span><Icon size={20} /></span>{m.label}</button>
        })}
      </div>
    </section>
  )
}

const inr = (n: number) => (n >= 100000 ? `₹${(n / 100000).toFixed(n >= 1000000 ? 0 : 1)}L` : `₹${n.toLocaleString('en-IN')}`)

/** Two small charts: counts and rupees have different scales, so they are not drawn on one axis */
function TrendCharts({ months, phone }: { months: TrendMonth[]; phone: boolean }) {
  const [asTable, setAsTable] = useState(false)
  const height = phone ? 170 : 200
  const chart = (title: string, keys: [keyof TrendMonth, keyof TrendMonth], labels: [string, string], money: boolean) => (
    <figure className="hd-chart">
      <figcaption>{title}</figcaption>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={months} barGap={2} barCategoryGap="28%" margin={{ top: 6, right: 4, bottom: 0, left: money ? 4 : -18 }}>
          <CartesianGrid vertical={false} stroke="#eef2f7" />
          <XAxis dataKey="month" tickLine={false} axisLine={{ stroke: '#cbd5e1' }} tick={{ fontSize: 12, fill: '#64748b' }} />
          <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} width={money ? 52 : 40} tickFormatter={money ? (v: number) => inr(v) : undefined} />
          <Tooltip cursor={{ fill: 'rgba(148,163,184,0.12)' }} formatter={(v, name) => [money ? `₹${Number(v ?? 0).toLocaleString('en-IN')}` : String(v ?? 0), String(name)]}
            contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: '#334155' }} />
          <Bar dataKey={keys[0]} name={labels[0]} fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={18} />
          <Bar dataKey={keys[1]} name={labels[1]} fill={SERIES[1]} radius={[4, 4, 0, 0]} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </figure>
  )
  return (
    <div>
      <div className="hd-chart-toggle">
        <button type="button" className="hd-link" onClick={() => setAsTable(!asTable)}>{asTable ? <><BarChart3 size={14} /> Show charts</> : <><Table2 size={14} /> Show as table</>}</button>
      </div>
      {asTable ? (
        <div className="hd-table-wrap">
          <table className="hd-table">
            <thead><tr><th>Month</th><th>Enquiries</th><th>Quotations</th><th>Billed</th><th>Received</th></tr></thead>
            <tbody>{months.map((m) => <tr key={m.month}><td>{m.month}</td><td>{m.enquiries}</td><td>{m.quotations}</td><td>₹{m.billed.toLocaleString('en-IN')}</td><td>₹{m.received.toLocaleString('en-IN')}</td></tr>)}</tbody>
          </table>
        </div>
      ) : (
        <div className="hd-charts">
          {chart('Enquiries and quotations', ['enquiries', 'quotations'], ['Enquiries', 'Quotations'], false)}
          {chart('Billed and received', ['billed', 'received'], ['Billed', 'Received'], true)}
        </div>
      )}
    </div>
  )
}

function WhoTable({ table }: { table: NonNullable<DashCardData['table']> }) {
  if (!table.rows.length) return null
  return (
    <div className="hd-table-wrap">
      <table className="hd-table">
        <thead><tr><th>Name</th>{table.columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead>
        <tbody>
          {table.rows.map((r) => (
            <tr key={String(r.name)}><td>{r.name}</td>{table.columns.map((c) => <td key={c.key} className={Number(r[c.key]) ? undefined : 'hd-zero'}>{r[c.key]}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Turn cards on or off and move them up or down; Reset = every card the user can see */
function EditCards({ dash, range, onClose, onSaved }: { dash: HomeDashboardData; range: DashRange; onClose: () => void; onSaved: (d: HomeDashboardData) => void }) {
  const [order, setOrder] = useState<string[]>(() => [...dash.layout, ...dash.cards.map((c) => c.key).filter((k) => !dash.layout.includes(k))])
  const [on, setOn] = useState<Set<string>>(() => new Set(dash.layout))
  const [saving, setSaving] = useState(false)
  const title = (key: string) => dash.cards.find((c) => c.key === key)?.title ?? key
  const group = (key: string) => dash.cards.find((c) => c.key === key)?.group ?? ''
  const move = (i: number, by: -1 | 1) => setOrder((o) => { const n = [...o]; n.splice(i + by, 0, ...n.splice(i, 1)); return n })
  const toggle = (key: string) => setOn((s) => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n })

  const save = async (cards: string[] | null) => {
    setSaving(true)
    try {
      onSaved(await homeDashboardApi.save(cards, range))
      showToast(cards === null ? 'Dashboard reset' : 'Dashboard saved')
    } catch (e) {
      showToast((e as Error).message || 'Could not save', 'error')
      setSaving(false)
    }
  }

  return (
    <Modal title="Edit dashboard" subtitle="Tick the cards you want; arrows change the order" size="sm" onClose={onClose}
      onSave={() => void save(order.filter((k) => on.has(k)))} saving={saving} saveLabel="Save"
      footerLeft={dash.customised ? <button type="button" className="btn btn-outline" disabled={saving} onClick={() => void save(null)}>Reset</button> : undefined}>
      <ul className="hd-edit">
        {order.map((key, i) => (
          <li key={key} className={on.has(key) ? undefined : 'is-off'}>
            <label>
              <input type="checkbox" checked={on.has(key)} onChange={() => toggle(key)} />
              <span><strong>{title(key)}</strong><small>{group(key)}</small></span>
            </label>
            <span className="hd-edit__arrows">
              <button type="button" className="hd-icon-btn" aria-label={`Move ${title(key)} up`} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={15} /></button>
              <button type="button" className="hd-icon-btn" aria-label={`Move ${title(key)} down`} disabled={i === order.length - 1} onClick={() => move(i, 1)}><ArrowDown size={15} /></button>
            </span>
          </li>
        ))}
      </ul>
    </Modal>
  )
}
