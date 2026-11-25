/**
 * Quotations of NCS LLP (NCS/2026/1058 …, GST always 18%) and NCRC Pvt Ltd (NCRC/2026/0001 …, no GST).
 * The server recomputes the totals on save; calcQuotation() mirrors it for the live form and the print.
 * Transport is added after GST, as on the invoices, unless "GST on transport" is chosen: then before it.
 */
import { request } from './api'
import { amountWords, today, type BillCompany } from './bills'

/** The same two companies, with the same details, as on the invoices */
export const QUOTATION_COMPANY_KEYS: BillCompany[] = ['ncs', 'ncrc']

/** add = GST @ 18% added (LLP) · none = no GST (NCRC) · extra = "Extra, as applicable", only on quotations saved earlier */
export type GstMode = 'add' | 'extra' | 'none'
export type QuotationStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired'
export type SectionStyle = 'text' | 'bullets' | 'numbers'

/** heading / subheading: a full-width row over the items, without quantity, rate and amount */
export type ItemKind = 'item' | 'heading' | 'subheading'

/** A further heading with its text inside one item */
export interface ItemPart { title: string; details: string }

export interface QuotationItem {
  kind: ItemKind
  description: string
  details: string
  extra: ItemPart[]
  quantity: number | ''
  unit: string
  /** "Other" is chosen: the unit is typed (only in the form, not saved) */
  unitOther?: boolean
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
  company: BillCompany
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
  /** GST charged on transport: transport comes before GST */
  transport_gst: boolean
  payment_terms: string
  sections: QuotationSection[]
  signatory_name: string
  signatory_designation: string
  notes: string
}

type NullableText = 'valid_until' | 'client_address' | 'client_gstin' | 'contact_person' | 'mobile_no' | 'email' | 'location'
  | 'ref_no' | 'ref_date' | 'prepared_by' | 'subject' | 'intro' | 'payment_terms' | 'signatory_name' | 'signatory_designation' | 'notes'

/** approved · pending = waiting for approval · returned = sent back with a remark */
export type QuotationApproval = 'approved' | 'pending' | 'returned'

/** What prints, as the server compares it */
export interface QuotationContent extends Record<'company' | 'quotation_no' | 'date' | 'gst_mode' | 'client_name', string>, Record<Exclude<NullableText, 'notes'>, string | null> {
  discount: number
  transport: number
  transport_gst: boolean
  net_amount: number
  sections: QuotationSection[]
  items: (Omit<QuotationItem, 'quantity' | 'rate'> & { quantity: number; rate: number; amount: number })[]
}

export interface Quotation extends Omit<QuotationInput, NullableText | 'items' | 'discount' | 'transport'>, Record<NullableText, string | null> {
  id: number
  items: (Omit<QuotationItem, 'quantity' | 'rate'> & { quantity: number; rate: number; amount: number })[]
  discount: number
  transport: number
  total_amount: number
  tax_amount: number
  net_amount: number
  status: QuotationStatus
  approval: QuotationApproval
  approval_remark: string | null
  approval_by_name: string | null
  approval_at: string | null
  approval_requested_by_name: string | null
  approval_requested_at: string | null
  /** As it was when last approved; null when it never was */
  approved_content: QuotationContent | null
  content: QuotationContent
  content_hash: string
}

export const QUOTATION_STATUSES: { key: QuotationStatus; label: string }[] = [
  { key: 'draft', label: 'Draft' },
  { key: 'sent', label: 'Sent' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'expired', label: 'Expired' },
]

/** GST is fixed per company */
export const companyGst = (company: BillCompany): GstMode => (company === 'ncs' ? 'add' : 'none')

export const UNITS = ['Nos', 'Mtr', 'Per bore', 'Acres', 'LS']
export const SECTION_TITLES = ['Scope of Work', 'Deliverables', 'Exclusions', 'Terms & Conditions', 'SWL Clarification', 'Client Scope', 'Time Schedule']
export const DEFAULT_PAYMENT_TERMS = '50% along with PO; remaining 50% after submission of report'

export const emptyQuotationItem = (): QuotationItem => ({ kind: 'item', description: '', details: '', extra: [], quantity: 1, unit: 'Nos', rate: '', included: false })
export const emptyHeading = (kind: 'heading' | 'subheading'): QuotationItem => ({ ...emptyQuotationItem(), kind, quantity: '', unit: '' })
export const emptySection = (): QuotationSection => ({ title: '', style: 'numbers', body: '', half: false })

/** 2026-06-10 + 1 → 2026-07-10 (31 Jan → 28 / 29 Feb) */
function addMonths(iso: string, months: number): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return ''
  const [year, month, day] = [Number(m[1]), Number(m[2]) - 1 + months, Number(m[3])]
  const d = new Date(year, month, Math.min(day, new Date(year, month + 1, 0).getDate()))
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const oneMonthAfter = (iso: string) => addMonths(iso, 1)

const MONTH_WORDS = ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve']

/** Validity in words from the two dates: "One Month", "Three Months", else "45 Days"; '' when not set */
export function validityText(date: string, validUntil: string): string {
  if (!date || !validUntil || validUntil <= date) return ''
  const months = MONTH_WORDS.findIndex((_, i) => addMonths(date, i + 1) === validUntil)
  if (months >= 0) return `${MONTH_WORDS[months]} ${months ? 'Months' : 'Month'}`
  const days = Math.round((Date.parse(validUntil) - Date.parse(date)) / 86400000)
  return Number.isFinite(days) ? `${days} ${days === 1 ? 'Day' : 'Days'}` : ''
}

export function emptyQuotation(company: BillCompany): QuotationInput {
  return {
    company,
    inquiry_id: null,
    quotation_no: '', date: today(), valid_until: oneMonthAfter(today()),
    client_name: '', client_address: '', client_gstin: '', contact_person: '', mobile_no: '', email: '',
    location: '', ref_no: '', ref_date: '', prepared_by: '', subject: '', intro: '',
    items: [emptyQuotationItem()],
    discount: '', gst_mode: companyGst(company), transport: '', transport_gst: false,
    payment_terms: DEFAULT_PAYMENT_TERMS,
    sections: [],
    signatory_name: company === 'ncs' ? 'Omendra Gupta' : '', signatory_designation: company === 'ncs' ? 'Director' : '',
    notes: '',
  }
}

const num = (v: unknown) => Number(v) || 0
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

/** Something is filled in, so it is saved and printed */
export const itemUsed = (it: QuotationItem) => Boolean(it.description.trim())
  || (it.kind === 'item' && Boolean(it.details.trim() || Number(it.rate) || it.extra.some((p) => p.title.trim() || p.details.trim())))

/** Numbers of the rows: headings A, B …, sub-headings A.1, A.2 …, items 1, 2, 3 … running on */
export function itemNumbers(items: Pick<QuotationItem, 'kind'>[]): string[] {
  let heading = 0
  let sub = 0
  let item = 0
  const letters = (n: number): string => (n > 26 ? letters(Math.floor((n - 1) / 26)) : '') + String.fromCharCode(65 + ((n - 1) % 26))
  return items.map((it) => {
    if (it.kind === 'heading') { heading += 1; sub = 0; return letters(heading) }
    if (it.kind === 'subheading') { sub += 1; return heading ? `${letters(heading)}.${sub}` : '' }
    item += 1
    return String(item)
  })
}

export const quotationItemAmount = (it: Pick<QuotationItem, 'kind' | 'quantity' | 'rate' | 'included'>) =>
  (it.included || it.kind !== 'item' ? 0 : r2(r2(num(it.quantity)) * r2(num(it.rate))))

export function calcQuotation(q: Pick<QuotationInput, 'items' | 'discount' | 'gst_mode' | 'transport' | 'transport_gst'>) {
  const subtotal = r2(q.items.reduce((s, it) => s + quotationItemAmount(it), 0))
  const discount = r2(num(q.discount))
  const afterDiscount = Math.max(0, r2(subtotal - discount))
  const transport = r2(num(q.transport))
  const transportFirst = q.gst_mode === 'add' && q.transport_gst
  const taxable = r2(afterDiscount + (transportFirst ? transport : 0))
  const gst = q.gst_mode === 'add' ? r2(taxable * 0.18) : 0
  const total = r2(afterDiscount + gst + transport)
  const grand = Math.round(total)
  const grandLabel = q.gst_mode === 'add' ? 'Total Cost incl. GST' : q.gst_mode === 'extra' ? 'Total (excl. GST)' : 'Total Amount'
  const words = amountWords(grand) + (q.gst_mode === 'extra' ? ' + GST as applicable' : '')
  return { subtotal, discount, afterDiscount, transport, transportFirst, taxable, gst, roundOff: r2(grand - total), grand, grandLabel, words }
}

/** Amount lines between the first Sub Total and the grand total, in printing order: [label, value, is a sum line] */
export function quotationLines(q: Pick<QuotationInput, 'items' | 'discount' | 'gst_mode' | 'transport' | 'transport_gst'>, money: (n: number) => string): [string, string, boolean][] {
  const t = calcQuotation(q)
  const lines: [string, string, boolean][] = []
  const transport: [string, string, boolean] = ['Transportation incl. Toll', money(t.transport), false]
  if (t.discount) lines.push(['Discount', `− ${money(t.discount)}`, false], ['Total after Discount', money(t.afterDiscount), true])
  if (t.transport && t.transportFirst) lines.push(transport, ['Total before GST', money(t.taxable), true])
  if (q.gst_mode === 'add') lines.push(['GST @ 18%', money(t.gst), false])
  if (q.gst_mode === 'extra') lines.push(['GST', 'Extra, as applicable', false])
  if (t.transport && !t.transportFirst) lines.push(transport)
  if (t.roundOff) lines.push(['Round Off', `${t.roundOff > 0 ? '' : '− '}${money(Math.abs(t.roundOff))}`, false])
  return lines
}

export function quotationToInput(q: Quotation): QuotationInput {
  const s = (v: string | null | undefined) => v ?? ''
  return {
    company: q.company,
    inquiry_id: q.inquiry_id,
    quotation_no: q.quotation_no, date: s(q.date), valid_until: s(q.valid_until),
    client_name: s(q.client_name), client_address: s(q.client_address), client_gstin: s(q.client_gstin),
    contact_person: s(q.contact_person), mobile_no: s(q.mobile_no), email: s(q.email),
    location: s(q.location), ref_no: s(q.ref_no), ref_date: s(q.ref_date), prepared_by: s(q.prepared_by),
    subject: s(q.subject), intro: s(q.intro),
    items: q.items.length
      ? q.items.map((it) => ({ kind: it.kind ?? 'item', description: it.description, details: it.details, extra: (it.extra ?? []).map((p) => ({ ...p })), quantity: it.quantity, unit: it.unit, rate: it.included ? '' : it.rate, included: it.included }))
      : [emptyQuotationItem()],
    discount: q.discount || '', gst_mode: q.gst_mode, transport: q.transport || '', transport_gst: Boolean(q.transport_gst),
    payment_terms: s(q.payment_terms),
    sections: q.sections.map((sec) => ({ ...sec })),
    signatory_name: s(q.signatory_name), signatory_designation: s(q.signatory_designation),
    notes: s(q.notes),
  }
}

export const quotationsApi = {
  list: () => request<{ data: Quotation[] }>('/quotations'),
  get: (id: number) => request<{ data: Quotation }>(`/quotations/${id}`),
  create: (data: QuotationInput) => request<{ data: Quotation }>('/quotations', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: QuotationInput) => request<{ data: Quotation }>(`/quotations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  setStatus: (id: number, status: QuotationStatus) => request<{ data: Quotation }>(`/quotations/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
  approve: (q: Quotation) => request<{ data: Quotation }>(`/quotations/${q.id}/approve`, { method: 'POST', body: JSON.stringify({ content_hash: q.content_hash }) }),
  sendBack: (q: Quotation, remark: string) => request<{ data: Quotation }>(`/quotations/${q.id}/send-back`, { method: 'POST', body: JSON.stringify({ content_hash: q.content_hash, remark }) }),
  remove: (id: number) => request<{ message: string }>(`/quotations/${id}`, { method: 'DELETE' }),
  nextNumber: (company: BillCompany, date: string) => request<{ data: string }>(`/quotations/next-number?${new URLSearchParams({ company, date })}`),
}
