import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Plus, Printer, Pencil, Trash2, X } from 'lucide-react'
import { api } from '../lib/api'
import { DataTable } from '../components/DataTable'
import type { PurchaseOrder, PurchaseOrderListItem } from '../lib/types'

interface POForm {
  date: string
  purchase_order: string
  agency_name: string
  reporting_address: string
  vendor_ref_no: string
  vendor_ref_date: string
  total_amount: string
  total_discount: string
  transportation: string
  gst_amount: string
  advance_amount: string
  net_amount: string
  remark: string
  items: POItemForm[]
}

interface POItemForm {
  description: string
  unit: string
  rate: string
  discount: string
  amount: string
}

const emptyForm: POForm = {
  date: new Date().toISOString().slice(0, 10),
  purchase_order: '',
  agency_name: '',
  reporting_address: '',
  vendor_ref_no: '',
  vendor_ref_date: '',
  total_amount: '0',
  total_discount: '0',
  transportation: '0',
  gst_amount: '0',
  advance_amount: '0',
  net_amount: '0',
  remark: '',
  items: [{ description: '', unit: '', rate: '0', discount: '0', amount: '0' }],
}

function money(v: number) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(v)
}

export function PurchaseOrdersPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<POForm>(emptyForm)
  const [localError, setLocalError] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (startDate) params.start_date = startDate
      if (endDate) params.end_date = endDate
      const data = await api.purchaseOrders(params)
      setOrders(data.data)
    } catch {
      setLocalError('Unable to load purchase orders')
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate])

  useEffect(() => { void load() }, [load])

  const recalcTotals = (f: POForm): POForm => {
    let totalAmount = 0
    let totalDiscount = 0

    for (const item of f.items) {
      const rate = parseFloat(item.rate) || 0
      const discount = parseFloat(item.discount) || 0
      const amount = rate - discount
      item.amount = String(Math.max(0, amount))
      totalAmount += amount
      totalDiscount += discount
    }

    const transportation = parseFloat(f.transportation) || 0
    const baseAmount = totalAmount + transportation
    const gst = baseAmount * 0.18
    const advance = parseFloat(f.advance_amount) || 0
    const netAmount = baseAmount + gst - advance

    return {
      ...f,
      total_amount: String(Math.round(totalAmount * 100) / 100),
      total_discount: String(Math.round(totalDiscount * 100) / 100),
      gst_amount: String(Math.round(gst * 100) / 100),
      net_amount: String(Math.round(netAmount * 100) / 100),
    }
  }

  const updateItem = (index: number, field: keyof POItemForm, value: string) => {
    const items = [...form.items]
    items[index] = { ...items[index], [field]: value }
    setForm((prev) => recalcTotals({ ...prev, items }))
  }

  const addItem = () => {
    setForm((prev) => recalcTotals({
      ...prev,
      items: [...prev.items, { description: '', unit: '', rate: '0', discount: '0', amount: '0' }],
    }))
  }

  const removeItem = (index: number) => {
    if (form.items.length <= 1) return
    const items = form.items.filter((_, i) => i !== index)
    setForm((prev) => recalcTotals({ ...prev, items }))
  }

  const beginCreate = () => {
    setEditingId(null)
    setForm(emptyForm)
    setLocalError('')
  }

  const beginEdit = (po: PurchaseOrder) => {
    setEditingId(po.iPurchaseorderId)
    setForm({
      date: po.date ?? new Date().toISOString().slice(0, 10),
      purchase_order: po.purchase_order ?? '',
      agency_name: po.agency_name ?? '',
      reporting_address: po.reporting_address ?? '',
      vendor_ref_no: po.vendor_ref_no ?? '',
      vendor_ref_date: po.vendor_ref_date ?? '',
      total_amount: String(po.total_amount ?? 0),
      total_discount: String(po.total_discount ?? 0),
      transportation: String(po.transportation ?? 0),
      gst_amount: String(po.gst_amount ?? 0),
      advance_amount: String(po.advance_amount ?? 0),
      net_amount: String(po.net_amount ?? 0),
      remark: po.remark ?? '',
      items: (po.items && po.items.length > 0
        ? po.items.map((item: PurchaseOrderListItem) => ({
            description: item.description ?? '',
            unit: item.unit ?? '',
            rate: String(item.rate ?? 0),
            discount: String(item.discount ?? 0),
            amount: String(item.amount ?? 0),
          }))
        : [{ description: '', unit: '', rate: '0', discount: '0', amount: '0' }]),
    })
    setLocalError('')
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLocalError('')
    try {
      const payload = {
        ...form,
        total_amount: parseFloat(form.total_amount) || 0,
        total_discount: parseFloat(form.total_discount) || 0,
        transportation: parseFloat(form.transportation) || 0,
        gst_amount: parseFloat(form.gst_amount) || 0,
        advance_amount: parseFloat(form.advance_amount) || 0,
        net_amount: parseFloat(form.net_amount) || 0,
        items: form.items.map((item) => ({
          description: item.description,
          unit: item.unit,
          rate: parseFloat(item.rate) || 0,
          discount: parseFloat(item.discount) || 0,
          amount: parseFloat(item.amount) || 0,
        })),
      }

      if (editingId) {
        await api.updatePurchaseOrder(editingId, payload)
      } else {
        await api.createPurchaseOrder(payload)
      }

      setShowForm(false)
      setEditingId(null)
      setForm(emptyForm)
      await load()
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'Failed to save purchase order')
    }
  }

  const handleDelete = async (po: PurchaseOrder) => {
    if (!window.confirm(`Delete purchase order ${po.purchase_order}?`)) return
    setLocalError('')
    try {
      await api.deletePurchaseOrder(po.iPurchaseorderId)
      if (editingId === po.iPurchaseorderId) {
        setEditingId(null)
        setShowForm(false)
      }
      await load()
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'Failed to delete purchase order')
    }
  }

  const handlePrint = async (id: number) => {
    try {
      const res = await api.printPurchaseOrder(id)
      const w = window.open('', '_blank')
      if (w) {
        w.document.write(res.html)
        w.document.close()
      }
    } catch {
      setLocalError('Failed to load print view')
    }
  }

  const handleField = (field: keyof POForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <>
      <div className="page-header">
        <div>
          <p className="section-label">Procurement</p>
          <h1>Purchase Orders</h1>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={beginCreate} type="button"><Plus size={16} /> New Purchase Order</button>
        </div>
      </div>

      <div className="filter-bar">
        <div className="date-filter">
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <span>to</span>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <span className="record-count">{orders.length} orders</span>
      </div>

      {localError && <div className="error-banner">{localError}</div>}

      <div className="table-card">
        {loading ? <p className="empty-state">Loading...</p> : (
          <DataTable
            columns={[
              { key: 'date', label: 'Date' },
              { key: 'agency_name', label: 'Agency' },
              { key: 'reporting_address', label: 'Address' },
              { key: 'purchase_order', label: 'PO No' },
              { key: 'vendor_ref_no', label: 'Vendor Ref' },
              { key: 'vendor_ref_date', label: 'Ref Date' },
              { key: 'total_amount', label: 'Total' },
              { key: 'actions', label: '', sortable: false },
            ]}
            rows={orders.map((po) => ({
              date: <span className="mono">{po.date ?? '-'}</span>,
              agency_name: po.agency_name ?? '-',
              reporting_address: <span className="text-muted">{po.reporting_address ?? '-'}</span>,
              purchase_order: <span className="uid-cell">{po.purchase_order}</span>,
              vendor_ref_no: po.vendor_ref_no ?? '-',
              vendor_ref_date: <span className="mono">{po.vendor_ref_date ?? '-'}</span>,
              total_amount: <span className="mono">{money(po.total_amount)}</span>,
              actions: <div className="row-actions-inline">
                <button className="icon-btn" onClick={() => { setEditingId(null); void handlePrint(po.iPurchaseorderId) }} type="button" title="Print"><Printer size={15} /></button>
                <button className="icon-btn" onClick={() => { beginEdit(po) }} type="button" title="Edit"><Pencil size={15} /></button>
                <button className="icon-btn" onClick={() => void handleDelete(po)} type="button" title="Delete"><Trash2 size={15} /></button>
              </div>,
            }))}
            exportable={true}
            filename="purchase-orders"
          />
        )}
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => { setShowForm(false); setEditingId(null) }}>
          <div className="modal-content modal-lg" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => { setShowForm(false); setEditingId(null) }} type="button"><X size={20} /></button>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 20 }}>
                <p className="section-label">{editingId ? 'Update' : 'Create'}</p>
                <h2>{editingId ? 'Edit Purchase Order' : 'New Purchase Order'}</h2>
              </div>

              <div className="form-grid-2">
                <label className="form-field"><span>Date *</span><input type="date" value={form.date} onChange={(e) => handleField('date', e.target.value)} required /></label>
                <label className="form-field"><span>PO No *</span><input value={form.purchase_order} onChange={(e) => handleField('purchase_order', e.target.value)} required /></label>
              </div>
              <label className="form-field" style={{ marginTop: 12 }}><span>Agency Name</span><input value={form.agency_name} onChange={(e) => handleField('agency_name', e.target.value)} /></label>
              <label className="form-field" style={{ marginTop: 12 }}><span>Address</span><textarea value={form.reporting_address} onChange={(e) => handleField('reporting_address', e.target.value)} rows={2} /></label>
              <div className="form-grid-2" style={{ marginTop: 12 }}>
                <label className="form-field"><span>Vendor Ref No</span><input value={form.vendor_ref_no} onChange={(e) => handleField('vendor_ref_no', e.target.value)} /></label>
                <label className="form-field"><span>Vendor Ref Date</span><input type="date" value={form.vendor_ref_date} onChange={(e) => handleField('vendor_ref_date', e.target.value)} /></label>
              </div>

              <div style={{ marginTop: 20, marginBottom: 8 }}><strong style={{ fontSize: '0.84rem' }}>Line Items</strong></div>
              <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', marginBottom: 12, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-sunken)' }}>
                      <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: '0.7rem', textTransform: 'uppercase' }}>Description</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', width: 60, fontSize: '0.7rem', textTransform: 'uppercase' }}>Rate</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center', width: 50, fontSize: '0.7rem', textTransform: 'uppercase' }}>Unit</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', width: 60, fontSize: '0.7rem', textTransform: 'uppercase' }}>Disc</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', width: 70, fontSize: '0.7rem', textTransform: 'uppercase' }}>Amount</th>
                      <th style={{ padding: '8px 10px', width: 32 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.items.map((item, index) => (
                      <tr key={index} style={{ borderTop: '1px solid var(--color-border-light)' }}>
                        <td style={{ padding: 2 }}><input value={item.description} onChange={(e) => updateItem(index, 'description', e.target.value)} placeholder="Description" style={{ width: '100%', border: 'none', padding: '6px 4px', fontSize: '0.82rem' }} /></td>
                        <td style={{ padding: 2 }}><input type="number" value={item.rate} onChange={(e) => updateItem(index, 'rate', e.target.value)} style={{ width: '100%', border: 'none', padding: '6px 4px', textAlign: 'right', fontSize: '0.82rem' }} /></td>
                        <td style={{ padding: 2 }}><input value={item.unit} onChange={(e) => updateItem(index, 'unit', e.target.value)} placeholder="Unit" style={{ width: '100%', border: 'none', padding: '6px 4px', textAlign: 'center', fontSize: '0.82rem' }} /></td>
                        <td style={{ padding: 2 }}><input type="number" value={item.discount} onChange={(e) => updateItem(index, 'discount', e.target.value)} style={{ width: '100%', border: 'none', padding: '6px 4px', textAlign: 'right', fontSize: '0.82rem' }} /></td>
                        <td style={{ padding: 2 }}><span className="mono" style={{ display: 'block', padding: '6px 4px', textAlign: 'right' }}>{parseFloat(item.amount || '0').toFixed(2)}</span></td>
                        <td style={{ padding: 2 }}><button className="icon-btn" onClick={() => removeItem(index)} type="button" title="Remove" style={{ width: 28, height: 28 }}><X size={14} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button className="ghost-button" onClick={addItem} type="button" style={{ width: '100%', fontSize: '0.82rem', borderTop: '1px solid var(--color-border)', borderRadius: 0 }}>+ Add Item</button>
              </div>

              <div className="form-grid-2">
                <label className="form-field"><span>Transportation</span><input type="number" value={form.transportation} onChange={(e) => setForm((prev) => recalcTotals({ ...prev, transportation: e.target.value }))} /></label>
                <label className="form-field"><span>Advance Amount</span><input type="number" value={form.advance_amount} onChange={(e) => setForm((prev) => recalcTotals({ ...prev, advance_amount: e.target.value }))} /></label>
                <label className="form-field"><span>GST @ 18%</span><input type="number" value={form.gst_amount} readOnly style={{ background: 'var(--surface-sunken)' }} /></label>
                <label className="form-field"><span>Net Amount</span><input type="number" value={form.net_amount} readOnly style={{ background: 'var(--surface-sunken)', fontWeight: 700 }} /></label>
              </div>
              <label className="form-field" style={{ marginTop: 12 }}><span>Remark</span><textarea value={form.remark} onChange={(e) => handleField('remark', e.target.value)} rows={2} /></label>

              {localError && <div className="error-banner" style={{ marginTop: 12 }}>{localError}</div>}
              <div style={{ marginTop: 20, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn btn-outline" onClick={() => { setShowForm(false); setEditingId(null) }} type="button">Cancel</button>
                <button type="submit" className="btn btn-primary">{editingId ? 'Update PO' : 'Create PO'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
