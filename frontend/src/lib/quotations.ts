/**
 * NCS LLP quotations (NCS/2026/1058 …). The server recomputes the totals on save;
 * calcQuotation() mirrors it for the live form and the print.
 * GST is on the items (less discount); transport is added after GST, as on the invoices.
 */
import { request } from './api'
import { amountWords, today } from './bills'

/** add = GST @ 18% added · extra = "Extra, as applicable" · none = no GST line */
export type GstMode = 'add' | 'extra' | 'none'
export type QuotationStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired'
export type SectionStyle = 'text' | 'bullets' | 'numbers'

export interface QuotationItem {
  description: string
  details: string
  quantity: number | ''
  unit: string
  rate: number | ''
  included: boolean
}

export interface QuotationSection {
  title: string
  style: SectionStyle
  /** One line per paragraph / point */
  body: string
  /** Half width: printed side by side with the next half-width section */
  half: boolean
}

export interface QuotationInput {
  inquiry_id: number | null
  quotation_no: string
  date: string
  valid_until: string
  client_name: string
  client_address: string
  client_gstin: string
  contact_person: string
  mobile_no: string
  email: string
  location: string
  ref_no: string
  ref_date: string
  prepared_by: string
  subject: string
  intro: string
  items: QuotationItem[]
  discount: number | ''
  gst_mode: GstMode
  transport: number | ''
  payment_terms: string
  sections: QuotationSection[]
  signatory_name: string
  signatory_designation: string
  notes: string
}

type NullableText = 'valid_until' | 'client_address' | 'client_gstin' | 'contact_person' | 'mobile_no' | 'email' | 'location'
  | 'ref_no' | 'ref_date' | 'prepared_by' | 'subject' | 'intro' | 'payment_terms' | 'signatory_name' | 'signatory_designation' | 'notes'

export interface Quotation extends Omit<QuotationInput, NullableText | 'items' | 'discount' | 'transport'>, Record<NullableText, string | null> {
  id: number
  items: (Omit<QuotationItem, 'quantity' | 'rate'> & { quantity: number; rate: number; amount: number })[]
  discount: number
  transport: number
  total_amount: number
  tax_amount: number
  net_amount: number
  status: QuotationStatus
}

export const QUOTATION_STATUSES: { key: QuotationStatus; label: string; color: string }[] = [
  { key: 'draft', label: 'Draft', color: '#64748b' },
  { key: 'sent', label: 'Sent', color: '#2563eb' },
  { key: 'accepted', label: 'Accepted', color: '#16a34a' },
  { key: 'rejected', label: 'Rejected', color: '#dc2626' },
  { key: 'expired', label: 'Expired', color: '#d97706' },
]

export const GST_OPTIONS: { key: GstMode; label: string }[] = [
  { key: 'add', label: 'GST @ 18% added' },
  { key: 'extra', label: 'GST extra, as applicable' },
  { key: 'none', label: 'No GST line' },
]

export const UNITS = ['Nos', 'Mtr', 'LS', 'Per bore', 'Sqm', 'Cum', 'Day', 'Job', 'Set', 'Km']
export const SECTION_TITLES = ['Scope of Work', 'Deliverables', 'Exclusions', 'Terms & Conditions', 'SWL Clarification', 'Client Scope', 'Time Schedule']
export const DEFAULT_PAYMENT_TERMS = '50% along with PO; remaining 50% after submission of report'

export const emptyQuotationItem = (): QuotationItem => ({ description: '', details: '', quantity: 1, unit: 'Nos', rate: '', included: false })
export const emptySection = (): QuotationSection => ({ title: '', style: 'numbers', body: '', half: false })

/** One month after: 2026-06-10 → 2026-07-10 (31 Jan → 28 / 29 Feb) */
export function oneMonthAfter(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return ''
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const lastDay = new Date(year, month + 1, 0).getDate()
  const d = new Date(year, month, Math.min(day, lastDay))
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function emptyQuotation(): QuotationInput {
  return {
    inquiry_id: null,
    quotation_no: '', date: today(), valid_until: oneMonthAfter(today()),
    client_name: '', client_address: '', client_gstin: '', contact_person: '', mobile_no: '', email: '',
    location: '', ref_no: '', ref_date: '', prepared_by: '', subject: '', intro: '',
    items: [emptyQuotationItem()],
    discount: '', gst_mode: 'add', transport: '',
    payment_terms: DEFAULT_PAYMENT_TERMS,
    sections: [],
    signatory_name: 'Omendra Gupta', signatory_designation: 'Director',
    notes: '',
  }
}

const num = (v: unknown) => Number(v) || 0
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

export const quotationItemAmount = (it: Pick<QuotationItem, 'quantity' | 'rate' | 'included'>) =>
  (it.included ? 0 : r2(r2(num(it.quantity)) * r2(num(it.rate))))

export function calcQuotation(q: Pick<QuotationInput, 'items' | 'discount' | 'gst_mode' | 'transport'>) {
  const subtotal = r2(q.items.reduce((s, it) => s + quotationItemAmount(it), 0))
  const discount = r2(num(q.discount))
  const taxable = Math.max(0, r2(subtotal - discount))
  const gst = q.gst_mode === 'add' ? r2(taxable * 0.18) : 0
  const transport = r2(num(q.transport))
  const total = r2(taxable + gst + transport)
  const grand = Math.round(total)
  const grandLabel = q.gst_mode === 'add' ? 'Total Cost incl. GST' : q.gst_mode === 'extra' ? 'Total (excl. GST)' : 'Total Amount'
  const words = amountWords(grand) + (q.gst_mode === 'extra' ? ' + GST as applicable' : '')
  return { subtotal, discount, taxable, gst, transport, roundOff: r2(grand - total), grand, grandLabel, words }
}

export function quotationToInput(q: Quotation): QuotationInput {
  const s = (v: string | null | undefined) => v ?? ''
  return {
    inquiry_id: q.inquiry_id,
    quotation_no: q.quotation_no, date: s(q.date), valid_until: s(q.valid_until),
    client_name: s(q.client_name), client_address: s(q.client_address), client_gstin: s(q.client_gstin),
    contact_person: s(q.contact_person), mobile_no: s(q.mobile_no), email: s(q.email),
    location: s(q.location), ref_no: s(q.ref_no), ref_date: s(q.ref_date), prepared_by: s(q.prepared_by),
    subject: s(q.subject), intro: s(q.intro),
    items: q.items.length
      ? q.items.map((it) => ({ description: it.description, details: it.details, quantity: it.quantity, unit: it.unit, rate: it.included ? '' : it.rate, included: it.included }))
      : [emptyQuotationItem()],
    discount: q.discount || '', gst_mode: q.gst_mode, transport: q.transport || '',
    payment_terms: s(q.payment_terms),
    sections: q.sections.map((sec) => ({ ...sec })),
    signatory_name: s(q.signatory_name), signatory_designation: s(q.signatory_designation),
    notes: s(q.notes),
  }
}

/** A new quotation with everything from an old one, under a new number and today's date */
export function copyQuotation(q: Quotation): QuotationInput {
  return { ...quotationToInput(q), inquiry_id: null, quotation_no: '', date: today(), valid_until: oneMonthAfter(today()), ref_no: '', ref_date: '', notes: '' }
}

export const quotationsApi = {
  list: () => request<{ data: Quotation[] }>('/quotations'),
  create: (data: QuotationInput) => request<{ data: Quotation }>('/quotations', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: QuotationInput) => request<{ data: Quotation }>(`/quotations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  setStatus: (id: number, status: QuotationStatus) => request<{ data: Quotation }>(`/quotations/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
  remove: (id: number) => request<{ message: string }>(`/quotations/${id}`, { method: 'DELETE' }),
  nextNumber: (date: string) => request<{ data: string }>(`/quotations/next-number?${new URLSearchParams({ date })}`),
}
