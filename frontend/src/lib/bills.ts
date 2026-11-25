/**
 * Client bills in the two company formats from the Excel sheets:
 *  - ncrc: Namotech Consultancy and Research Centre Pvt Ltd → "INVOICE", no GST (bill 0001)
 *  - ncs:  Namotech Consultancy Services LLP → "TAX INVOICE" with GST (bills 0012 / 0014 / 0025)
 * The server recomputes the totals on save; calcBill() mirrors it for the live form.
 */
import { request } from './api'
import { integerWords } from './proposals'

export type BillCompany = 'ncrc' | 'ncs'
export type GstType = 'intra' | 'inter' | 'none'

export interface BillItem {
  description: string
  qty: number | ''
  hsn: string
  rate: number | ''
  discount: number | ''
  amount?: number
}

export interface BillInput {
  company: BillCompany
  invoice_no: string
  invoice_date: string
  uid_no: string
  uid_date: string
  work_order_no: string
  work_order_date: string
  report_no: string
  report_date: string
  sac_code: string
  terms_of_delivery: string
  client_name: string
  client_address: string
  client_gstin: string
  items: BillItem[]
  gst_type: GstType
  transport: number | ''
  advance: number | ''
  amount_received: number | ''
  received_date: string
  payment_mode: string
  remark: string
}

/** approved · pending = waiting for approval · returned = sent back with a remark */
export type ApprovalState = 'approved' | 'pending' | 'returned'
/** What prints, as the server compares it */
export type BillContent = Record<string, unknown> & { items: Required<BillItem & { amount: number }>[] }
export interface DocApproval {
  approval: ApprovalState
  approval_remark: string | null
  approval_requested_by_name: string | null
  approval_requested_at: string | null
  /** Only while it waits: as last approved (null = never), as it is now, and what an approval counts for */
  approved_content: BillContent | null
  content: BillContent | null
  content_hash: string | null
}
type CnApproval = { [K in keyof DocApproval as `cn_${K}`]: DocApproval[K] }

/** Approval of the credit note that is kept on its invoice */
export const creditNoteApproval = (b: Bill): DocApproval => ({
  approval: b.cn_approval, approval_remark: b.cn_approval_remark, approval_requested_by_name: b.cn_approval_requested_by_name,
  approval_requested_at: b.cn_approval_requested_at, approved_content: b.cn_approved_content, content: b.cn_content, content_hash: b.cn_content_hash,
})

export interface Bill extends DocApproval, CnApproval, Omit<BillInput, 'items' | 'transport' | 'advance' | 'amount_received'> {
  id: number
  items: Required<BillItem>[]
  subtotal: number
  transport: number
  cgst: number
  sgst: number
  igst: number
  advance: number
  net_amount: number
  amount_received: number
  due_amount: number
  cancelled: boolean
  cancelled_at: string | null
  cancel_reason: string | null
  credit_note_no: string | null
  credit_note_date: string | null
  /** The credit note's own copy (client, references, particulars, amounts); null = same as the invoice */
  credit_note_data: (Partial<Omit<BillInput, 'items'>> & { items?: Required<BillItem>[] }) | null
  credit_amount: number
  created_at: string
  updated_at: string
}

export interface CompanyProfile {
  key: BillCompany
  short: string
  title: string
  /** Name as printed (new bill templates, Downloads/billing) */
  name: string
  address: string
  phones: string[]
  email: string
  website: string
  gstin: string
  pan: string
  orderLabel: string
  bank: { accountName: string; name: string; account: string; ifsc: string; swift?: string; branch: string }
  /** Files in public/letterhead; without a seal there is only plain Print (no With / Without Sign) */
  logo: string
  seal: string
  /** Print colour theme */
  theme: 'llp' | 'ncrc'
}

const ADDRESS = 'Plot No. 57, Chandra Nagar, Near Gopalpura Bypass, Opp. Pooja Tower, Jaipur, Rajasthan 302018'
export const SERVICES = ['Consultancy & Design', 'Testing & Laboratory', 'Surveys & Geotechnical', 'Safety & Assessment']

export const COMPANIES: Record<BillCompany, CompanyProfile> = {
  ncrc: {
    key: 'ncrc',
    short: 'NCRC Pvt Ltd',
    title: 'INVOICE',
    name: 'Namotech Consultancy and Research Centre Pvt Ltd',
    address: ADDRESS,
    phones: ['+91 81144 28016'],
    email: 'info@namotech.in',
    website: 'www.namotech.in',
    gstin: '',
    pan: 'AAICN5029R',
    orderLabel: 'Work Order No',
    bank: { accountName: 'Namotech Consultancy and Research Centre Pvt Ltd', name: 'Union Bank of India', account: '535501010033143', ifsc: 'UBIN0553557', swift: 'UBININBBJAI', branch: 'Vishvesariya Nagar, Gopalpura Bypass, Jaipur' },
    logo: 'logo-ncrc.svg',
    // No seal image yet: put its file name here and With / Without Sign comes back
    seal: '',
    theme: 'ncrc',
  },
  ncs: {
    key: 'ncs',
    short: 'NCS LLP',
    title: 'TAX INVOICE',
    name: 'Namotech Consultancy Services LLP',
    address: ADDRESS,
    phones: ['+91 81144 28016'],
    email: 'info@namotech.in',
    website: 'www.namotech.in',
    gstin: '08AALFN6352M1ZO',
    pan: 'AALFN6352M',
    orderLabel: 'Letter No',
    bank: { accountName: 'Namotech Consultancy Services LLP', name: 'ICICI Bank', account: '675205601861', ifsc: 'ICIC0006752', branch: 'Gopalpura Circle, Pooja Tower, Jaipur' },
    logo: 'logo-ncs.svg',
    seal: 'seal-ncs.png',
    theme: 'llp',
  },
}

export const DEFAULT_SAC = '998346'
export const DEFAULT_HSN = '9983'

export const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const emptyItem = (company: BillCompany): BillItem => ({ description: '', qty: 1, hsn: company === 'ncs' ? DEFAULT_HSN : '', rate: '', discount: '' })

export function emptyBill(company: BillCompany): BillInput {
  return {
    company,
    invoice_no: '',
    invoice_date: today(),
    uid_no: '', uid_date: '',
    work_order_no: '', work_order_date: '',
    report_no: '', report_date: '',
    sac_code: DEFAULT_SAC,
    terms_of_delivery: '',
    client_name: '', client_address: '', client_gstin: '',
    items: [emptyItem(company)],
    gst_type: company === 'ncs' ? 'intra' : 'none',
    transport: '', advance: '', amount_received: '', received_date: '', payment_mode: '', remark: '',
  }
}

const num = (v: unknown) => Number(v) || 0
const r2 = (n: number) => Math.round(n * 100) / 100

export const itemAmount = (it: BillItem) => r2(num(it.qty) * num(it.rate) * (1 - num(it.discount) / 100))

export function calcBill(b: Pick<BillInput, 'company' | 'items' | 'gst_type' | 'transport' | 'advance' | 'amount_received'>) {
  const subtotal = r2(b.items.reduce((s, it) => s + itemAmount(it), 0))
  const transport = r2(num(b.transport))
  const gst: GstType = b.company === 'ncs' ? b.gst_type : 'none'
  // GST on the items total only; transport is added after GST (NCS LLP bills 0014 / 0025)
  const taxable = subtotal
  const cgst = gst === 'intra' ? r2(taxable * 0.09) : 0
  const sgst = cgst
  const igst = gst === 'inter' ? r2(taxable * 0.18) : 0
  const total = r2(taxable + cgst + sgst + igst + transport)
  const advance = r2(num(b.advance))
  const net = Math.round(total - advance)
  const due = Math.max(0, r2(net - num(b.amount_received)))
  return { subtotal, transport, cgst, sgst, igst, total, advance, net, due }
}

/** 5000 → "Rupees Five Thousand Only" */
export function amountWords(amount: number): string {
  const n = Math.max(0, Math.round(Number(amount) || 0))
  return `Rupees ${integerWords(n)} Only`
}

/** 2026-04-24 → 24-04-2026 */
export function dotDate(iso: string | null | undefined): string {
  const m = (iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : ''
}

/** ₹ amount with Indian grouping and 2 decimals */
export const money2 = (n: number) => (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function billToInput(b: Bill): BillInput {
  const s = (v: string | null | undefined) => v ?? ''
  return {
    company: b.company,
    invoice_no: s(b.invoice_no), invoice_date: s(b.invoice_date),
    uid_no: s(b.uid_no), uid_date: s(b.uid_date),
    work_order_no: s(b.work_order_no), work_order_date: s(b.work_order_date),
    report_no: s(b.report_no), report_date: s(b.report_date),
    sac_code: s(b.sac_code), terms_of_delivery: s(b.terms_of_delivery),
    client_name: s(b.client_name), client_address: s(b.client_address), client_gstin: s(b.client_gstin),
    items: b.items.length ? b.items.map((it) => ({ description: it.description, qty: it.qty, hsn: it.hsn ?? '', rate: it.rate, discount: it.discount || '' })) : [emptyItem(b.company)],
    gst_type: b.gst_type,
    transport: b.transport || '', advance: b.advance || '', amount_received: b.amount_received || '',
    received_date: s(b.received_date), payment_mode: s(b.payment_mode), remark: s(b.remark),
  }
}

/** Credit note document: its own saved copy if edited, else pre-filled from the invoice */
export function creditNoteInput(b: Bill): BillInput {
  const base = billToInput(b)
  const d = b.credit_note_data
  if (!d) return { ...base, advance: '' }
  const s = (v: unknown, fallback: string) => (v === undefined ? fallback : String(v ?? ''))
  return {
    ...base,
    uid_no: s(d.uid_no, base.uid_no), uid_date: s(d.uid_date, base.uid_date),
    work_order_no: s(d.work_order_no, base.work_order_no), work_order_date: s(d.work_order_date, base.work_order_date),
    report_no: s(d.report_no, base.report_no), report_date: s(d.report_date, base.report_date),
    terms_of_delivery: s(d.terms_of_delivery, base.terms_of_delivery),
    client_name: s(d.client_name, base.client_name), client_address: s(d.client_address, base.client_address),
    client_gstin: s(d.client_gstin, base.client_gstin),
    items: d.items?.length ? d.items.map((it) => ({ description: it.description, qty: it.qty, hsn: it.hsn ?? '', rate: it.rate, discount: it.discount || '' })) : base.items,
    gst_type: d.gst_type ?? base.gst_type,
    transport: d.transport ? Number(d.transport) : '',
    advance: '',
  }
}

// ─── API ─────────────────────────────────────────────────────────────────

export const billsApi = {
  list: (params?: Record<string, string>) => {
    const qs = params && Object.keys(params).length ? `?${new URLSearchParams(params)}` : ''
    return request<{ data: Bill[] }>(`/bills${qs}`)
  },
  get: (id: number) => request<{ data: Bill }>(`/bills/${id}`),
  create: (data: BillInput) => request<{ data: Bill }>('/bills', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: BillInput) => request<{ data: Bill }>(`/bills/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  cancel: (id: number, data: { reason?: string; credit_note: boolean; credit_note_no?: string; credit_note_date?: string }) =>
    request<{ data: Bill }>(`/bills/${id}/cancel`, { method: 'POST', body: JSON.stringify(data) }),
  saveCreditNote: (id: number, data: BillInput & { credit_note_no: string; credit_note_date: string; reason: string }) =>
    request<{ data: Bill }>(`/bills/${id}/credit-note`, { method: 'PUT', body: JSON.stringify(data) }),
  decide: (id: number, data: { action: 'approve' | 'send_back'; content_hash: string; remark: string; credit_note?: boolean }) =>
    request<{ data: Bill }>(`/bills/${id}/approval`, { method: 'POST', body: JSON.stringify(data) }),
  restore: (id: number) => request<{ data: Bill }>(`/bills/${id}/restore`, { method: 'POST' }),
  remove: (id: number) => request<{ message: string }>(`/bills/${id}`, { method: 'DELETE' }),
  nextNumber: (company: BillCompany, date: string) => request<{ data: string }>(`/bills/next-number?${new URLSearchParams({ company, date })}`),
  billedUids: () => request<{ data: string[] }>('/bills/billed-uids'),
  fromRegistration: (uid: string) => request<{ data: {
    uid_no: string; uid_date: string | null; client_name: string; client_address: string; client_gstin: string
    work_order_no: string; report_no: string; name_of_work: string; advance: number; email: string
  } }>(`/bills/registration/${encodeURIComponent(uid)}`),
}
