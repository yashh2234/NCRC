/** Performa invoices of NCS LLP: PI/2026/0001 by calendar year, GST always 18%, no HSN and no advance. */
import { request } from './api'
import { emptyBill, emptyItem, type BillInput, type BillItem } from './bills'

type TextKey = 'invoice_no' | 'invoice_date' | 'uid_no' | 'uid_date' | 'work_order_no' | 'work_order_date' | 'report_no' | 'report_date'
  | 'terms_of_delivery' | 'client_name' | 'client_address' | 'client_gstin' | 'remark'

export interface Performa extends Record<TextKey, string | null> {
  id: number
  items: Required<BillItem>[]
  gst_type: 'intra' | 'inter'
  subtotal: number
  transport: number
  cgst: number
  sgst: number
  igst: number
  net_amount: number
}

/** The same form data as an invoice of NCS LLP, so it uses the same calculation and print */
export const emptyPerforma = (): BillInput => ({ ...emptyBill('ncs'), gst_type: 'intra' })

export function performaToInput(p: Performa): BillInput {
  const base = emptyPerforma()
  const keys: TextKey[] = ['invoice_no', 'invoice_date', 'uid_no', 'uid_date', 'work_order_no', 'work_order_date', 'report_no', 'report_date', 'terms_of_delivery', 'client_name', 'client_address', 'client_gstin', 'remark']
  const texts = Object.fromEntries(keys.map((k) => [k, p[k] ?? ''])) as Record<TextKey, string>
  return {
    ...base, ...texts,
    items: p.items.length ? p.items.map((it) => ({ description: it.description, qty: it.qty, hsn: '', rate: it.rate, discount: it.discount || '' })) : [emptyItem('ncs')],
    gst_type: p.gst_type,
    transport: p.transport || '',
  }
}

export const performaApi = {
  list: () => request<{ data: Performa[] }>('/performa-invoices'),
  create: (data: BillInput) => request<{ data: Performa }>('/performa-invoices', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: BillInput) => request<{ data: Performa }>(`/performa-invoices/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id: number) => request<{ message: string }>(`/performa-invoices/${id}`, { method: 'DELETE' }),
  nextNumber: (date: string) => request<{ data: string }>(`/performa-invoices/next-number?${new URLSearchParams({ date })}`),
}
