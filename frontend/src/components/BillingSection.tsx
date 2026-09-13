import { useState, useEffect } from 'react'
import { FileText } from 'lucide-react'
import { request } from '../lib/api'

interface BillingRecord {
  id: number
  uid_no: string
  bill_no: string
  bill_amount: string
  advance_amount: string
  amount_received: string
  due_amount: string
  mode_of_payment: string | null
  payment_followup: string | null
  remark: string | null
  amount_received_date: string | null
}

interface InvoiceRecord {
  iInvoiceId: number
  invoice_no: string
  date: string
  work_order_no: string | null
  agency_name: string | null
  net_amount: number
  items_count: number
}

interface BillingSectionProps { jobId: number }

export function BillingSection({ jobId }: BillingSectionProps) {
  const [billing, setBilling] = useState<BillingRecord[]>([])
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      request<{ data: BillingRecord[] }>(`/jobs/${jobId}/billing`),
      request<{ data: InvoiceRecord[] }>(`/jobs/${jobId}/invoices`),
    ]).then(([b, i]) => {
      setBilling(b.data)
      setInvoices(i.data)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [jobId])

  if (loading) return <p style={{ color: '#65737d', fontSize: '0.85rem' }}>Loading...</p>

  const totalBilled = billing.reduce((s, r) => s + (parseFloat(r.bill_amount) || 0), 0)
  const totalReceived = billing.reduce((s, r) => s + (parseFloat(r.amount_received) || 0), 0)
  const totalDue = billing.reduce((s, r) => s + (parseFloat(r.due_amount) || 0), 0)

  return (
    <div>
      {/* Summary */}
      {billing.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
          <div style={{ padding: '8px 12px', background: '#fbfcfd', borderRadius: 8, border: '1px solid #e8eef1' }}>
            <span style={{ fontSize: '0.72rem', color: '#65737d' }}>Billed</span>
            <strong style={{ display: 'block', fontSize: '1rem' }}>₹{totalBilled.toLocaleString()}</strong>
          </div>
          <div style={{ padding: '8px 12px', background: '#d1fae5', borderRadius: 8, border: '1px solid #a7f3d0' }}>
            <span style={{ fontSize: '0.72rem', color: '#065f46' }}>Received</span>
            <strong style={{ display: 'block', fontSize: '1rem', color: '#065f46' }}>₹{totalReceived.toLocaleString()}</strong>
          </div>
          <div style={{ padding: '8px 12px', background: totalDue > 0 ? '#fef3c7' : '#d1fae5', borderRadius: 8, border: `1px solid ${totalDue > 0 ? '#fde68a' : '#a7f3d0'}` }}>
            <span style={{ fontSize: '0.72rem', color: totalDue > 0 ? '#92400e' : '#065f46' }}>Due</span>
            <strong style={{ display: 'block', fontSize: '1rem', color: totalDue > 0 ? '#92400e' : '#065f46' }}>₹{totalDue.toLocaleString()}</strong>
          </div>
        </div>
      ) : null}

      {/* Billing records */}
      {billing.length > 0 ? (
        <div style={{ marginBottom: 12 }}>
          <strong style={{ fontSize: '0.8rem', display: 'block', marginBottom: 6, color: '#65737d' }}>Payment Records</strong>
          <div style={{ display: 'grid', gap: 6 }}>
            {billing.map(b => (
              <div key={b.id} style={{ padding: '8px 12px', border: '1px solid #e8eef1', borderRadius: 8, fontSize: '0.82rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span><strong>{b.bill_no || '#' + b.id}</strong> {b.mode_of_payment ? `(${b.mode_of_payment})` : ''}</span>
                  <span>₹{parseFloat(b.bill_amount || '0').toLocaleString()}</span>
                </div>
                <div style={{ fontSize: '0.78rem', color: '#65737d', marginTop: 2 }}>
                  Received: ₹{parseFloat(b.amount_received || '0').toLocaleString()} | Due: ₹{parseFloat(b.due_amount || '0').toLocaleString()}
                  {b.amount_received_date ? ` on ${new Date(b.amount_received_date).toLocaleDateString()}` : ''}
                </div>
                {b.remark ? <p style={{ fontSize: '0.76rem', marginTop: 2, color: '#4a5b66' }}>{b.remark}</p> : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Invoices */}
      {invoices.length > 0 ? (
        <div>
          <strong style={{ fontSize: '0.8rem', display: 'block', marginBottom: 6, color: '#65737d' }}>Invoices</strong>
          <div style={{ display: 'grid', gap: 6 }}>
            {invoices.map(inv => (
              <div key={inv.iInvoiceId} style={{ padding: '8px 12px', border: '1px solid #e8eef1', borderRadius: 8, fontSize: '0.82rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span><FileText size={12} /> <strong>{inv.invoice_no}</strong></span>
                  <span>₹{inv.net_amount?.toLocaleString()}</span>
                </div>
                <div style={{ fontSize: '0.78rem', color: '#65737d', marginTop: 2 }}>
                  {inv.date} | {inv.items_count} item(s)
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {billing.length === 0 && invoices.length === 0 ? (
        <p style={{ color: '#65737d', fontSize: '0.85rem' }}>No billing records yet.</p>
      ) : null}
    </div>
  )
}
