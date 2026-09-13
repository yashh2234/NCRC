import { useCallback, useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Printer, ArrowLeft } from 'lucide-react'
import { api } from '../lib/api'
import { useTracking } from '../lib/useTracking'
import type { Invoice } from '../lib/types'

interface FormData {
  date: string
  invoice_no: string
  work_order_no: string
  work_order_date: string
  report_no: string
  report_date: string
  agency_name: string
  reporting_address: string
  agency_gst: string
  agency_state: string
  terms_of_delivery: string
  total_amount: number
  total_discount: number
  transportation: number
  sgst_amount: number
  cgst_amount: number
  gst_amount: number
  net_amount: number
  advance_amount: number
  items: Array<{ iIlid?: number; description: string; unit: string; rate: number; discount: number; amount: number }>
}

const emptyForm: FormData = {
  date: new Date().toISOString().slice(0, 10),
  invoice_no: '', work_order_no: '', work_order_date: '', report_no: '', report_date: '',
  agency_name: '', reporting_address: '', agency_gst: '', agency_state: 'Rajasthan', terms_of_delivery: '',
  total_amount: 0, total_discount: 0, transportation: 0, sgst_amount: 0, cgst_amount: 0, gst_amount: 0, net_amount: 0, advance_amount: 0,
  items: [{ description: '', unit: '', rate: 0, discount: 0, amount: 0 }],
}

function calc(items: FormData['items'], transport: number, disc: number, state: string) {
  const total = items.reduce((s, it) => s + (it.amount || 0), 0)
  const taxable = total - disc + transport
  let sgst = 0, cgst = 0, igst = 0
  if (state === 'Rajasthan') { sgst = taxable * 0.09; cgst = taxable * 0.09 } else { igst = taxable * 0.18 }
  return { total_amount: total, sgst_amount: +sgst.toFixed(2), cgst_amount: +cgst.toFixed(2), gst_amount: +igst.toFixed(2), net_amount: +(taxable + sgst + cgst + igst).toFixed(2) }
}

export function InvoicePage() {
  useTracking('invoices')
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'list' | 'form' | 'print'>('list')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<FormData>(emptyForm)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [printData, setPrintData] = useState<{ invoice: Invoice; company: Record<string, string> | null; amount_in_words: string } | null>(null)
  const [error, setError] = useState('')

  const loadInvoices = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (startDate) params.start_date = startDate
      if (endDate) params.end_date = endDate
      const data = await api.invoices(Object.keys(params).length ? params : undefined)
      setInvoices(data.data)
    } catch { setError('Failed to load invoices') }
    finally { setLoading(false) }
  }, [startDate, endDate])

  useEffect(() => { void loadInvoices() }, [loadInvoices])

  const handleCreate = () => { setEditingId(null); setForm(emptyForm); setView('form') }

  const handleEdit = async (id: number) => {
    try {
      const data = await api.invoice(id)
      const inv = data.data
      setEditingId(id)
      setForm({
        date: inv.date?.slice(0, 10) ?? '',
        invoice_no: inv.invoice_no ?? '',
        work_order_no: inv.work_order_no ?? '',
        work_order_date: inv.work_order_date?.slice(0, 10) ?? '',
        report_no: inv.report_no ?? '',
        report_date: inv.report_date?.slice(0, 10) ?? '',
        agency_name: inv.agency_name ?? '',
        reporting_address: inv.reporting_address ?? '',
        agency_gst: inv.agency_gst ?? '',
        agency_state: inv.agency_state ?? 'Rajasthan',
        terms_of_delivery: inv.terms_of_delivery ?? '',
        total_amount: inv.total_amount ?? 0,
        total_discount: inv.total_discount ?? 0,
        transportation: inv.transportation ?? 0,
        sgst_amount: inv.sgst_amount ?? 0,
        cgst_amount: inv.cgst_amount ?? 0,
        gst_amount: inv.gst_amount ?? 0,
        net_amount: inv.net_amount ?? 0,
        advance_amount: inv.advance_amount ?? 0,
        items: inv.items?.map((it) => ({ iIlid: it.iIlid, description: it.description ?? '', unit: it.unit ?? '', rate: it.rate ?? 0, discount: it.discount ?? 0, amount: it.amount ?? 0 })) ?? [],
      })
      setView('form')
    } catch { setError('Failed to load invoice') }
  }

  const handlePrint = async (id: number) => {
    try {
      const data = await api.printInvoice(id)
      setPrintData(data as unknown as typeof printData)
      setView('print')
    } catch { setError('Failed to load print data') }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this invoice?')) return
    try { await api.deleteInvoice(id); void loadInvoices() } catch { setError('Failed to delete') }
  }

  const handleSave = async () => {
    try {
      const payload = { ...form, items: form.items.filter((it) => it.description.trim()) }
      if (editingId) { await api.updateInvoice(editingId, payload) }
      else { await api.createInvoice(payload) }
      setView('list'); void loadInvoices()
    } catch { setError('Failed to save invoice') }
  }

  const addItem = () => setForm((f) => ({ ...f, items: [...f.items, { description: '', unit: '', rate: 0, discount: 0, amount: 0 }] }))
  const removeItem = (i: number) => setForm((f) => {
    const items = f.items.filter((_, idx) => idx !== i)
    return { ...f, items, ...calc(items, f.transportation, f.total_discount, f.agency_state) }
  })
  const updateItem = (i: number, key: string, value: string) => setForm((f) => {
    const items = f.items.map((it, idx) => idx === i ? { ...it, [key]: key === 'description' || key === 'unit' ? value : (parseFloat(value) || 0) } : it)
    return { ...f, items, ...calc(items, f.transportation, f.total_discount, f.agency_state) }
  })
  const updateField = (key: string, value: string) => setForm((f) => {
    const next = { ...f, [key]: value }
    return { ...next, ...calc(next.items, next.transportation, next.total_discount, next.agency_state) }
  })
  const updateNumField = (key: string, value: string) => setForm((f) => {
    const next = { ...f, [key]: parseFloat(value) || 0 }
    return { ...next, ...calc(next.items, next.transportation, next.total_discount, next.agency_state) }
  })

  if (view === 'print' && printData) {
    const inv = printData.invoice
    const co = printData.company
    return (
      <div className="surface" style={{ padding: 24 }}>
        <button className="ghost-button" onClick={() => setView('list')} style={{ marginBottom: 16 }}><ArrowLeft size={16} /> Back</button>
        <div style={{ fontFamily: 'Arial, sans-serif', fontSize: 13, lineHeight: 1.5 }}>
          <h2 style={{ textAlign: 'center', marginBottom: 4 }}>INVOICE PROFORMA</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #333' }}>
            <tbody>
              <tr>
                <td colSpan={2} rowSpan={4} style={{ border: '1px solid #333', padding: 8, verticalAlign: 'top' }}>
                  <strong>{co?.company_name ?? 'Namotech Consultancy Services LLP'}</strong><br />
                  Address: {co?.address ?? ''}<br />
                  Phone: {co?.phone ?? ''}<br />
                  Email: {co?.email ?? ''}
                </td>
                <td style={{ border: '1px solid #333', padding: 4, fontWeight: 700 }}>Invoice No</td>
                <td style={{ border: '1px solid #333', padding: 4 }}>{inv.invoice_no}</td>
                <td style={{ border: '1px solid #333', padding: 4, fontWeight: 700 }}>Date</td>
                <td style={{ border: '1px solid #333', padding: 4 }}>{inv.date}</td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #333', padding: 4, fontWeight: 700 }}>Work Order</td>
                <td style={{ border: '1px solid #333', padding: 4 }}>{inv.work_order_no}</td>
                <td style={{ border: '1px solid #333', padding: 4, fontWeight: 700 }}>Date</td>
                <td style={{ border: '1px solid #333', padding: 4 }}>{inv.work_order_date}</td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #333', padding: 4, fontWeight: 700 }}>SAC Code</td>
                <td colSpan={3} style={{ border: '1px solid #333', padding: 4 }}>998346</td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #333', padding: 4, fontWeight: 700 }}>Report No</td>
                <td style={{ border: '1px solid #333', padding: 4 }}>{inv.report_no}</td>
                <td style={{ border: '1px solid #333', padding: 4, fontWeight: 700 }}>Date</td>
                <td style={{ border: '1px solid #333', padding: 4 }}>{inv.report_date}</td>
              </tr>
              <tr>
                <td colSpan={2} style={{ border: '1px solid #333', padding: 4 }}>GSTIN: {inv.agency_gst}</td>
                <td colSpan={4} style={{ border: '1px solid #333', padding: 4 }}></td>
              </tr>
              <tr>
                <td colSpan={2} style={{ border: '1px solid #333', padding: 4 }}>State: {inv.agency_state}</td>
                <td colSpan={4} style={{ border: '1px solid #333', padding: 4 }}>Terms: {inv.terms_of_delivery}</td>
              </tr>
              <tr>
                <td colSpan={2} style={{ border: '1px solid #333', padding: 8, height: 80, verticalAlign: 'top' }}>
                  <strong>{inv.agency_name}</strong><br />{inv.reporting_address}
                </td>
                <td colSpan={4} style={{ border: '1px solid #333', padding: 4 }}></td>
              </tr>
              <tr style={{ background: '#f0f0f0' }}>
                <th style={{ border: '1px solid #333', padding: 4 }}>S.N</th>
                <th style={{ border: '1px solid #333', padding: 4 }}>Description</th>
                <th style={{ border: '1px solid #333', padding: 4 }}>Rate</th>
                <th style={{ border: '1px solid #333', padding: 4 }}>Unit</th>
                <th style={{ border: '1px solid #333', padding: 4 }}>Discount</th>
                <th style={{ border: '1px solid #333', padding: 4 }}>Amount</th>
              </tr>
              {inv.items?.map((it, i) => (
                <tr key={i}>
                  <td style={{ border: '1px solid #333', padding: 4 }}>{i + 1}</td>
                  <td style={{ border: '1px solid #333', padding: 4 }}>{it.description}</td>
                  <td style={{ border: '1px solid #333', padding: 4 }}>{it.rate}</td>
                  <td style={{ border: '1px solid #333', padding: 4 }}>{it.unit}</td>
                  <td style={{ border: '1px solid #333', padding: 4 }}>{it.discount}</td>
                  <td style={{ border: '1px solid #333', padding: 4 }}>{it.amount}</td>
                </tr>
              ))}
              <tr><td colSpan={6} style={{ border: '1px solid #333', padding: 4 }}></td></tr>
              {([
                ['Total Amount', inv.total_amount],
                ['Transportation', inv.transportation],
                ['Discount', inv.total_discount],
                ['CGST @9%', inv.cgst_amount],
                ['SGST @9%', inv.sgst_amount],
                ['IGST @18%', inv.gst_amount],
                ['Net Amount', inv.net_amount],
              ] as [string, number][]).map(([label, val]) => (
                <tr key={label}>
                  <td colSpan={4} style={{ border: '1px solid #333', padding: 4, textAlign: 'right', fontWeight: 700 }}>{label}</td>
                  <td colSpan={2} style={{ border: '1px solid #333', padding: 4 }}>{val}</td>
                </tr>
              ))}
              <tr>
                <td colSpan={2} style={{ border: '1px solid #333', padding: 4 }}>Amount in Words</td>
                <td colSpan={4} style={{ border: '1px solid #333', padding: 4 }}>{printData.amount_in_words}</td>
              </tr>
              <tr><td colSpan={6} style={{ border: '1px solid #333', padding: 4, textAlign: 'center' }}>This is a Computer Generated Invoice.</td></tr>
            </tbody>
          </table>
        </div>
        <button className="primary-button" style={{ marginTop: 16 }} onClick={() => window.print()}>Print</button>
      </div>
    )
  }

  if (view === 'form') {
    return (
      <div className="surface" style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2>{editingId ? 'Edit Invoice' : 'Create Invoice'}</h2>
          <button className="ghost-button" onClick={() => setView('list')}><ArrowLeft size={16} /> Back</button>
        </div>
        {error ? <p style={{ color: '#c44a5a', marginBottom: 12 }}>{error}</p> : null}
        <div className="form-grid-2">
          <label className="form-field"><span>Date *</span><input type="date" value={form.date} onChange={(e) => updateField('date', e.target.value)} /></label>
          <label className="form-field"><span>Invoice No *</span><input value={form.invoice_no} onChange={(e) => updateField('invoice_no', e.target.value)} /></label>
          <label className="form-field"><span>Work Order No *</span><input value={form.work_order_no} onChange={(e) => updateField('work_order_no', e.target.value)} /></label>
          <label className="form-field"><span>Work Order Date *</span><input type="date" value={form.work_order_date} onChange={(e) => updateField('work_order_date', e.target.value)} /></label>
          <label className="form-field"><span>Report No *</span><input value={form.report_no} onChange={(e) => updateField('report_no', e.target.value)} /></label>
          <label className="form-field"><span>Report Date *</span><input type="date" value={form.report_date} onChange={(e) => updateField('report_date', e.target.value)} /></label>
          <label className="form-field"><span>Agency Name *</span><input value={form.agency_name} onChange={(e) => updateField('agency_name', e.target.value)} /></label>
          <label className="form-field"><span>Agency GST</span><input value={form.agency_gst} onChange={(e) => updateField('agency_gst', e.target.value)} /></label>
          <label className="form-field"><span>Reporting Address *</span><input value={form.reporting_address} onChange={(e) => updateField('reporting_address', e.target.value)} /></label>
          <label className="form-field"><span>State</span>
            <select value={form.agency_state} onChange={(e) => updateField('agency_state', e.target.value)}>
              <option value="Rajasthan">Rajasthan</option>
              <option value="Out Of Rajasthan">Out Of Rajasthan</option>
            </select>
          </label>
          <label className="form-field"><span>Terms of Delivery</span><input value={form.terms_of_delivery} onChange={(e) => updateField('terms_of_delivery', e.target.value)} /></label>
        </div>

        <h3 style={{ marginTop: 20, marginBottom: 8 }}>Line Items</h3>
        <table className="data-table" style={{ marginBottom: 8 }}>
          <thead>
            <tr>
              <th style={{ width: 40 }}>#</th>
              <th>Description</th>
              <th style={{ width: 80 }}>Unit</th>
              <th style={{ width: 100 }}>Rate</th>
              <th style={{ width: 100 }}>Discount %</th>
              <th style={{ width: 120 }}>Amount</th>
              <th style={{ width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {form.items.map((item, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td><input value={item.description} onChange={(e) => updateItem(i, 'description', e.target.value)} style={{ width: '100%' }} /></td>
                <td><input value={item.unit} onChange={(e) => updateItem(i, 'unit', e.target.value)} style={{ width: '100%' }} /></td>
                <td><input type="number" value={item.rate || ''} onChange={(e) => updateItem(i, 'rate', e.target.value)} style={{ width: '100%' }} /></td>
                <td><input type="number" value={item.discount || ''} onChange={(e) => updateItem(i, 'discount', e.target.value)} style={{ width: '100%' }} /></td>
                <td><input type="number" value={item.amount || ''} onChange={(e) => updateItem(i, 'amount', e.target.value)} style={{ width: '100%' }} /></td>
                <td>{form.items.length > 1 ? <button className="icon-button" onClick={() => removeItem(i)} type="button"><Trash2 size={14} /></button> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <button className="ghost-button" onClick={addItem} type="button"><Plus size={14} /> Add Row</button>

        <div className="form-grid-2" style={{ marginTop: 16 }}>
          <label className="form-field"><span>Total Amount</span><input value={form.total_amount} readOnly /></label>
          <label className="form-field"><span>Discount</span><input type="number" value={form.total_discount || ''} onChange={(e) => updateNumField('total_discount', e.target.value)} /></label>
          <label className="form-field"><span>Transportation</span><input type="number" value={form.transportation || ''} onChange={(e) => updateNumField('transportation', e.target.value)} /></label>
          <label className="form-field"><span>SGST @9%</span><input value={form.sgst_amount} readOnly /></label>
          <label className="form-field"><span>CGST @9%</span><input value={form.cgst_amount} readOnly /></label>
          <label className="form-field"><span>IGST @18%</span><input value={form.gst_amount} readOnly /></label>
          <label className="form-field"><span>Net Amount</span><input value={form.net_amount} readOnly style={{ fontWeight: 700 }} /></label>
          <label className="form-field"><span>Advance Amount</span><input type="number" value={form.advance_amount || ''} onChange={(e) => updateNumField('advance_amount', e.target.value)} /></label>
        </div>

        <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
          <button className="primary-button" onClick={() => void handleSave()}>{editingId ? 'Update' : 'Create'} Invoice</button>
          <button className="ghost-button" onClick={() => setView('list')}>Cancel</button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2>Invoices</h2>
        <button className="primary-button" onClick={handleCreate}><Plus size={16} /> Create Invoice</button>
      </div>
      <div className="surface" style={{ padding: 12, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label className="form-field" style={{ marginBottom: 0 }}><span>From</span><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label>
          <label className="form-field" style={{ marginBottom: 0 }}><span>To</span><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></label>
          <button className="primary-button" onClick={() => void loadInvoices()} style={{ marginTop: 18 }}>Filter</button>
        </div>
      </div>
      {error ? <p style={{ color: '#c44a5a', marginBottom: 12 }}>{error}</p> : null}
      <section className="surface">
        {loading ? <p className="empty-state">Loading...</p>
        : invoices.length === 0 ? <p className="empty-state">No invoices found.</p>
        : (
          <table className="data-table">
            <thead>
              <tr><th>Date</th><th>Invoice No</th><th>Work Order</th><th>Agency</th><th>Net Amount</th><th>Items</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.iInvoiceId}>
                  <td>{inv.date}</td>
                  <td><strong>{inv.invoice_no}</strong></td>
                  <td>{inv.work_order_no}</td>
                  <td>{inv.agency_name}</td>
                  <td style={{ fontWeight: 600 }}>{inv.net_amount}</td>
                  <td>{inv.items?.length ?? 0}</td>
                  <td style={{ display: 'flex', gap: 4 }}>
                    <button className="icon-button" onClick={() => void handlePrint(inv.iInvoiceId)} title="Print"><Printer size={16} /></button>
                    <button className="icon-button" onClick={() => void handleEdit(inv.iInvoiceId)} title="Edit"><Pencil size={16} /></button>
                    <button className="icon-button" onClick={() => void handleDelete(inv.iInvoiceId)} title="Delete"><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  )
}
