import { request } from './api'

/** good / warn / bad colour a number or a line; it always has a label too */
export type Tone = 'good' | 'warn' | 'bad' | null

export interface DashTile {
  label: string; value: string | number; hint?: string | null; tone?: Tone; module?: string | null
  /** Change in % against the same stretch of the period before (null: nothing to compare) */
  change?: number | null
  /** The last 6 months, for a small line */
  spark?: number[]
}
/** A colour the app knows: c1…c3 (categories), good / warn / bad / muted (states), age1…age4 (older = darker) */
export type DashColor = 'c1' | 'c2' | 'c3' | 'good' | 'warn' | 'bad' | 'muted' | 'age1' | 'age2' | 'age3' | 'age4'
export interface DashSlice { label: string; value: number; color: DashColor; module?: string | null; text?: string }
export interface DashBar { label: string; value: number; max: number; text: string; tone?: Tone; module?: string | null }
export interface DashItem { title: string; detail?: string | null; tone?: Tone; module?: string | null }
export interface TrendMonth { month: string; enquiries: number; quotations: number; billed: number; received: number }
export interface DashTable { columns: Array<{ key: string; label: string }>; rows: Array<Record<string, string | number>> }

export interface DashCardData {
  tiles?: DashTile[]
  list?: DashItem[]
  chart?: TrendMonth[]
  table?: DashTable
  donut?: { center: string | number; centerLabel: string; slices: DashSlice[] }
  /** Progress bars: value of max */
  bars?: DashBar[]
  funnel?: Array<{ label: string; value: number }>
  /** One bar cut into parts (e.g. outstanding by age) */
  stack?: { total: string; parts: DashSlice[] }
  /** Ranked bars (top clients, sources) */
  hbars?: Array<{ label: string; value: number; text: string }>
  /** Per person, stacked (attendance) */
  people?: { keys: Array<{ key: string; label: string; color: DashColor }>; rows: Array<Record<string, string | number>> }
  /** The page "Open" goes to */
  module?: string
  empty?: string | null
  error?: string
  /** The approvals card: on the phone "Open" goes to the Approvals tab */
  approvals?: boolean
}

export interface DashCardInfo { key: string; title: string; group: string; wide: boolean }

export interface HomeDashboardData {
  /** All cards this user may pick */
  cards: DashCardInfo[]
  /** The ones shown, in order */
  layout: string[]
  /** false = the automatic choice (every card the user can see) */
  customised: boolean
  data: Record<string, DashCardData>
  period: DashPeriod
  periods: Array<{ key: DashPeriod; label: string }>
  /** The dates shown (to = last day) and as text: "1 Nov – 28 Nov 2026" */
  from: string
  to: string
  range: string
  compareMode: DashCompare
  compares: Array<{ key: DashCompare; label: string }>
  /** What the ↑ / ↓ compare with, e.g. "vs 1 Oct – 28 Oct 2026"; empty when off */
  compare: string
}

export type DashPeriod = 'today' | 'week' | 'month' | 'last_month' | 'quarter' | 'prev_quarter' | 'year' | 'custom'
export type DashCompare = 'previous' | 'last_year' | 'none'
/** What the user chose: remembered on this device */
export interface DashRange { period: DashPeriod; from?: string; to?: string; compare: DashCompare }

const query = (r: DashRange) => new URLSearchParams({ period: r.period, compare: r.compare, ...(r.period === 'custom' && r.from && r.to ? { from: r.from, to: r.to } : {}) }).toString()

export const homeDashboardApi = {
  get: (range: DashRange) => request<{ data: HomeDashboardData }>(`/home-dashboard?${query(range)}`).then((r) => r.data),
  /** null = back to the automatic choice */
  save: (cards: string[] | null, range: DashRange) => request<{ data: HomeDashboardData }>(`/home-dashboard/layout?${query(range)}`, { method: 'PUT', body: JSON.stringify({ cards }) }).then((r) => r.data),
}

/** Pages offered as quick actions, in this order (only those the user can open) */
export const QUICK_PAGES = ['inquiries', 'quotations', 'billing', 'registrations', 'reports', 'expenses', 'leave', 'my_attendance', 'tenders', 'work_orders', 'holidays', 'mail']
