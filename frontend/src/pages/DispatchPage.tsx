import { useEffect, useState } from 'react';

type Dispatch = {
  id: number;
  report_id: number | null;
  work_order_id: number | null;
  registration_id: number | null;
  dispatch_date: string;
  dispatch_method: string;
  courier_name: string | null;
  tracking_number: string | null;
  recipient_name: string | null;
  recipient_address: string | null;
  received_by: string | null;
  received_at: string | null;
  status: string;
  notes: string | null;
  work_order?: { work_order_no: string } | null;
  created_at: string;
};

const STATUS_COLORS: Record<string, string> = {
  pending: '#ff9800', dispatched: '#2196f3', delivered: '#4caf50', returned: '#f44336',
};

export default function DispatchPage() {
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Dispatch | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({
    dispatch_date: new Date().toISOString().slice(0, 10),
    dispatch_method: 'courier', courier_name: '', tracking_number: '',
    recipient_name: '', recipient_address: '', notes: '',
    work_order_id: null as number | null, registration_id: null as number | null,
    report_id: null as number | null,
  });

  const fetchDispatches = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (search) params.set('search', search);
    const res = await fetch(`/api/dispatches?${params}`);
    const data = await res.json();
    setDispatches(data.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchDispatches(); }, [statusFilter, search]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      dispatch_date: new Date().toISOString().slice(0, 10),
      dispatch_method: 'courier', courier_name: '', tracking_number: '',
      recipient_name: '', recipient_address: '', notes: '',
      work_order_id: null, registration_id: null, report_id: null,
    });
    setShowModal(true);
  };

  const openEdit = (d: Dispatch) => {
    setEditing(d);
    setForm({
      dispatch_date: d.dispatch_date, dispatch_method: d.dispatch_method,
      courier_name: d.courier_name || '', tracking_number: d.tracking_number || '',
      recipient_name: d.recipient_name || '', recipient_address: d.recipient_address || '',
      notes: d.notes || '', work_order_id: d.work_order_id, registration_id: d.registration_id,
      report_id: d.report_id,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    const method = editing ? 'PUT' : 'POST';
    const url = editing ? `/api/dispatches/${editing.id}` : '/api/dispatches';
    await fetch(url, {
      method, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setShowModal(false);
    fetchDispatches();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this dispatch?')) return;
    await fetch(`/api/dispatches/${id}`, { method: 'DELETE' });
    fetchDispatches();
  };

  const handleStatusChange = async (id: number, status: string, extra: Record<string, any> = {}) => {
    await fetch(`/api/dispatches/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, ...extra }),
    });
    fetchDispatches();
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Dispatch</h1>
        <button className="btn btn-primary" onClick={openCreate}>+ New Dispatch</button>
      </div>

      <div className="filters-bar">
        <input type="text" className="form-input" placeholder="Search dispatches..." value={search}
          onChange={(e) => setSearch(e.target.value)} style={{ flex: 1 }} />
        <select className="form-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="dispatched">Dispatched</option>
          <option value="delivered">Delivered</option>
          <option value="returned">Returned</option>
        </select>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Method</th>
              <th>Courier</th>
              <th>Tracking</th>
              <th>Recipient</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7}>Loading...</td></tr>
            ) : dispatches.length === 0 ? (
              <tr><td colSpan={7}>No dispatches found</td></tr>
            ) : dispatches.map((d) => (
              <tr key={d.id}>
                <td>{d.dispatch_date}</td>
                <td>{d.dispatch_method.replace('_', ' ')}</td>
                <td>{d.courier_name || '-'}</td>
                <td>{d.tracking_number || '-'}</td>
                <td>{d.recipient_name || '-'}</td>
                <td>
                  <span className="badge" style={{ backgroundColor: STATUS_COLORS[d.status] || '#999', color: '#fff' }}>
                    {d.status}
                  </span>
                </td>
                <td>
                  <button className="btn btn-sm" onClick={() => openEdit(d)}>Edit</button>
                  <button className="btn btn-sm btn-danger" onClick={() => handleDelete(d.id)}>Del</button>
                  {d.status === 'pending' && (
                    <button className="btn btn-sm" style={{ backgroundColor: '#2196f3', color: '#fff' }}
                      onClick={() => handleStatusChange(d.id, 'dispatched')}>Dispatch</button>
                  )}
                  {d.status === 'dispatched' && (
                    <button className="btn btn-sm" style={{ backgroundColor: '#4caf50', color: '#fff' }}
                      onClick={() => {
                        const receivedBy = prompt('Received by:');
                        if (receivedBy) handleStatusChange(d.id, 'delivered', { received_by: receivedBy, received_at: new Date().toISOString() });
                      }}>Deliver</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{editing ? 'Edit Dispatch' : 'New Dispatch'}</h2>
            <div className="form-grid">
              <div className="form-group">
                <label>Dispatch Date *</label>
                <input className="form-input" type="date" value={form.dispatch_date}
                  onChange={(e) => setForm({ ...form, dispatch_date: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Method *</label>
                <select className="form-input" value={form.dispatch_method}
                  onChange={(e) => setForm({ ...form, dispatch_method: e.target.value })}>
                  <option value="courier">Courier</option>
                  <option value="hand_delivery">Hand Delivery</option>
                  <option value="email">Email</option>
                  <option value="post">Post</option>
                </select>
              </div>
              <div className="form-group">
                <label>Courier Name</label>
                <input className="form-input" value={form.courier_name}
                  onChange={(e) => setForm({ ...form, courier_name: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Tracking Number</label>
                <input className="form-input" value={form.tracking_number}
                  onChange={(e) => setForm({ ...form, tracking_number: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Recipient Name</label>
                <input className="form-input" value={form.recipient_name}
                  onChange={(e) => setForm({ ...form, recipient_name: e.target.value })} />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Recipient Address</label>
                <textarea className="form-input" rows={2} value={form.recipient_address}
                  onChange={(e) => setForm({ ...form, recipient_address: e.target.value })} />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Notes</label>
                <textarea className="form-input" rows={2} value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
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
