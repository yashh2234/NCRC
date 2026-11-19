import { RATE_LIST } from '../data/rateList'

/** Call pipeline, in order. Keep in sync with Inquiry::STATUSES in the backend. */
export const INQUIRY_STATUSES = [
  { key: 'new', label: 'New', background: '#f1f5f9', color: '#475569' },
  { key: 'no_answer', label: 'Called – No Answer', background: '#fef3c7', color: '#b45309' },
  { key: 'interested', label: 'Called – Interested', background: '#dbeafe', color: '#1d4ed8' },
  { key: 'follow_up', label: 'Follow-up', background: '#ede9fe', color: '#6d28d9' },
  { key: 'quotation_sent', label: 'Quotation Sent', background: '#cffafe', color: '#0e7490' },
  { key: 'won', label: 'Converted (Won)', background: '#dcfce7', color: '#15803d' },
  { key: 'lost', label: 'Not Interested (Lost)', background: '#fee2e2', color: '#b91c1c' },
] as const

export type InquiryStatus = typeof INQUIRY_STATUSES[number]['key']

/** Statuses that close an inquiry (no more follow-ups expected). */
export const CLOSED_STATUSES: InquiryStatus[] = ['won', 'lost']

export function statusInfo(status: string) {
  return INQUIRY_STATUSES.find((s) => s.key === status) ?? INQUIRY_STATUSES[0]
}

/** Work categories = the sample test categories used in Client Registration. */
export const WORK_CATEGORIES: string[] = RATE_LIST.map((c) => c.category)

export interface InquiryActivity {
  id: number
  status: InquiryStatus | null
  remark: string | null
  next_follow_up: string | null
  assigned_to_name: string | null
  user_name: string | null
  created_at: string | null
}

export interface Inquiry {
  id: number
  inquiry_no: string
  client_name: string
  mobile_no: string
  location: string
  budget: string
  work_categories: string[]
  notes: string
  status: InquiryStatus
  next_follow_up: string | null
  received_date: string | null
  assigned_to: number | null
  assigned_to_name: string | null
  created_by_name: string | null
  created_at: string | null
  updated_at: string | null
  activities?: InquiryActivity[]
}

export interface InquiryInput {
  client_name: string
  mobile_no: string
  location: string
  budget: string
  work_categories: string[]
  notes: string
  assigned_to: number | null
  status: InquiryStatus
  next_follow_up: string | null
}

export interface InquiryCallInput {
  status: InquiryStatus
  remark: string
  next_follow_up: string | null
  assigned_to: number | null
}

export function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 'overdue' | 'today' | null for an open inquiry's next follow-up date. */
export function followUpState(inquiry: Pick<Inquiry, 'status' | 'next_follow_up'>): 'overdue' | 'today' | null {
  if (!inquiry.next_follow_up || CLOSED_STATUSES.includes(inquiry.status)) return null
  const today = todayIso()
  if (inquiry.next_follow_up < today) return 'overdue'
  if (inquiry.next_follow_up === today) return 'today'
  return null
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '-'
  const d = new Date(value.length === 10 ? `${value}T00:00:00` : value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
