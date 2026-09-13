import { useEffect, useState } from 'react';
import { request } from '../lib/api';

type QuotationItem = {
  id?: number;
  description: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
};

type Quotation = {
  id: number;
  quotation_no: string;
  inquiry_id: number | null;
  date: string;
  valid_until: string | null;
  client_name: string;
  agency_name: string | null;
  total_amount: number;
  discount: number;
  tax_amount: number;
  net_amount: number;
  status: string;
  sent_via: string | null;
  items: QuotationItem[];
  created_at: string;
};

const STATUS_COLORS: Record<string, string> = {
  draft: '#9e9e9e', sent: '#2196f3', accepted: '#4caf50', rejected: '#f44336', expired: '#ff9800',
};

export default function QuotationsPage() {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Quotation | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({
    client_name: '', agency_name: '', contact_person: '', mobile_no: '', email: '',
    date: new Date().toISOString().slice(0, 10), valid_until: '', discount: 0, tax_amount: 0,
    terms_and_conditions: '', notes: '', inquiry_id: null as number | null,
  });
  const [items, setItems] = useState<QuotationItem[]>([
    { description: '', quantity: 1, unit: 'nos', rate: 0, amount: 0 },
  ]);
  const [converting, setConverting] = useState<number | null>(null);
  const [registering, setRegistering] = useState<number | null>(null);

  const fetchQuotations = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (search) params.set('search', search);
      const data = await request<any>(`/quotations?${params}`);
      setQuotations(data.data || []);
    } catch { setQuotations([]); }
    setLoading(false);
  };

  useEffect(() => { fetchQuotations(); }, [statusFilter, search]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      client_name: '', agency_name: '', contact_person: '', mobile_no: '', email: '',
      date: new Date().toISOString().slice(0, 10), valid_until: '', discount: 0, tax_amount: 0,
      terms_and_conditions: '', notes: '', inquiry_id: null,
    });
    setItems([{ description: '', quantity: 1, unit: 'nos', rate: 0, amount: 0 }]);
    setShowModal(true);
  };

  const openEdit = (q: Quotation) => {
    setEditing(q);
    setForm({
      client_name: q.client_name, agency_name: q.agency_name || '',
      contact_person: '', mobile_no: '', email: '',
      date: q.date, valid_until: q.valid_until || '', discount: q.discount,
      tax_amount: q.tax_amount, terms_and_conditions: '', notes: '', inquiry_id: q.inquiry_id,
    });
    setItems(q.items.length > 0 ? q.items.map(i => ({
      description: i.description, quantity: i.quantity, unit: i.unit, rate: i.rate, amount: i.amount,
    })) : [{ description: '', quantity: 1, unit: 'nos', rate: 0, amount: 0 }]);
    setShowModal(true);
  };

  const updateItem = (idx: number, field: string, value: string | number) => {
    const newItems = [...items];
    (newItems[idx] as any)[field] = value;
    if (field === 'quantity' || field === 'rate') {
      newItems[idx].amount = newItems[idx].quantity * newItems[idx].rate;
    }
    setItems(newItems);
  };

  const addItem = () => setItems([...items, { description: '', quantity: 1, unit: 'nos', rate: 0, amount: 0 }]);
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));

  const totalAmount = items.reduce((sum, i) => sum + i.amount, 0);
  const netAmount = totalAmount - (form.discount || 0) + (form.tax_amount || 0);

  const handleSave = async () => {
    try {
      const method = editing ? 'PUT' : 'POST';
      const url = editing ? `/quotations/${editing.id}` : '/quotations';
      await request(url, { method, body: JSON.stringify({ ...form, items }) });
      setShowModal(false);
      fetchQuotations();
    } catch (e: any) { alert(e.message || 'Save failed'); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this quotation?')) return;
    try {
      await request(`/quotations/${id}`, { method: 'DELETE' });
      fetchQuotations();
    } catch { /* ignore */ }
  };

  const handleStatusChange = async (id: number, status: string) => {
    try {
      await request(`/quotations/${id}`, {
        method: 'PUT', body: JSON.stringify({ status }),
      });
      fetchQuotations();
    } catch { /* ignore */ }
  };

  const handleConvertToWorkOrder = async (id: number) => {
    setConverting(id);
    try {
      await request(`/quotations/${id}/convert-to-work-order`, { method: 'POST' });
      fetchQuotations();
    } catch (e: any) { alert(e.message || 'Conversion failed'); }
    setConverting(null);
  };

  const handleConvertToRegistration = async (id: number) => {
    setRegistering(id);
    try {
      const data = await request<any>(`/quotations/${id}/convert-to-registration`, { method: 'POST' });
      alert(`Client registered! UID: ${data.uid_no}`);
      fetchQuotations();
    } catch (e: any) { alert(e.message || 'Registration failed'); }
    setRegistering(null);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Quotations</h1>
        <button className="btn btn-primary" onClick={openCreate}>+ New Quotation</button>
      </div>

      <div className="filters-bar">
        <input type="text" className="form-input" placeholder="Search quotations..." value={search}
          onChange={(e) => setSearch(e.target.value)} style={{ flex: 1 }} />
        <select className="form-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="accepted">Accepted</option>
          <option value="rejected">Rejected</option>
          <option value="expired">Expired</option>
        </select>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Quotation No</th>
              <th>Client</th>
              <th>Date</th>
              <th>Amount</th>
              <th>Net Amount</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7}>Loading...</td></tr>
            ) : quotations.length === 0 ? (
              <tr><td colSpan={7}>No quotations found</td></tr>
            ) : quotations.map((q) => (
              <tr key={q.id}>
                <td><strong>{q.quotation_no}</strong></td>
                <td>{q.client_name}</td>
                <td>{q.date}</td>
                <td>₹{Number(q.total_amount).toLocaleString()}</td>
                <td>₹{Number(q.net_amount).toLocaleString()}</td>
                <td>
                  <span className="badge" style={{ backgroundColor: STATUS_COLORS[q.status] || '#999', color: '#fff' }}>
                    {q.status}
                  </span>
                </td>
                <td>
                  <button className="btn btn-sm" onClick={() => openEdit(q)}>Edit</button>
                  <button className="btn btn-sm btn-danger" onClick={() => handleDelete(q.id)}>Delete</button>
                  {q.status === 'draft' && (
                    <button className="btn btn-sm" style={{ backgroundColor: '#2196f3', color: '#fff' }}
                      onClick={() => handleStatusChange(q.id, 'sent')}>Send</button>
                  )}
                  {q.status === 'sent' && (
                    <button className="btn btn-sm" style={{ backgroundColor: '#4caf50', color: '#fff' }}
                      onClick={() => handleStatusChange(q.id, 'accepted')}>Accept</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 800 }}>
            <h2>{editing ? 'Edit Quotation' : 'New Quotation'}</h2>
            <div className="form-grid">
              <div className="form-group">
                <label>Client Name *</label>
                <input className="form-input" value={form.client_name}
                  onChange={(e) => setForm({ ...form, client_name: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Agency Name</label>
                <input className="form-input" value={form.agency_name}
                  onChange={(e) => setForm({ ...form, agency_name: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Date *</label>
                <input className="form-input" type="date" value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Valid Until</label>
                <input className="form-input" type="date" value={form.valid_until}
                  onChange={(e) => setForm({ ...form, valid_until: e.target.value })} />
              </div>
            </div>

            <h3 style={{ marginTop: 16 }}>Line Items</h3>
            <table className="data-table" style={{ fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ width: '40%' }}>Description</th>
                  <th>Qty</th>
                  <th>Unit</th>
                  <th>Rate</th>
                  <th>Amount</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx}>
                    <td><input className="form-input" value={item.description}
                      onChange={(e) => updateItem(idx, 'description', e.target.value)} /></td>
                    <td><input className="form-input" type="number" value={item.quantity} style={{ width: 70 }}
                      onChange={(e) => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)} /></td>
                    <td><input className="form-input" value={item.unit} style={{ width: 60 }}
                      onChange={(e) => updateItem(idx, 'unit', e.target.value)} /></td>
                    <td><input className="form-input" type="number" value={item.rate} style={{ width: 100 }}
                      onChange={(e) => updateItem(idx, 'rate', parseFloat(e.target.value) || 0)} /></td>
                    <td>₹{item.amount.toLocaleString()}</td>
                    <td>{items.length > 1 && (
                      <button className="btn btn-sm btn-danger" onClick={() => removeItem(idx)}>X</button>
                    )}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="btn btn-sm" onClick={addItem} style={{ marginTop: 8 }}>+ Add Item</button>

            <div className="form-grid" style={{ marginTop: 16 }}>
              <div className="form-group">
                <label>Discount</label>
                <input className="form-input" type="number" value={form.discount}
                  onChange={(e) => setForm({ ...form, discount: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="form-group">
                <label>Tax Amount</label>
                <input className="form-input" type="number" value={form.tax_amount}
                  onChange={(e) => setForm({ ...form, tax_amount: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="form-group">
                <label>Total: ₹{totalAmount.toLocaleString()}</label>
              </div>
              <div className="form-group">
                <label><strong>Net: ₹{netAmount.toLocaleString()}</strong></label>
              </div>
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Notes</label>
              <textarea className="form-input" rows={2} value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>

            <div className="modal-actions">
              <button className="btn" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}>
                {editing ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
