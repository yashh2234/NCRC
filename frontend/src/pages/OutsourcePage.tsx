import { useEffect, useState } from 'react';
import { request } from '../lib/api';

type WorkOrderOption = {
  id: number;
  work_order_no: string;
  client_name: string;
};

type OutsourceAssignment = {
  id: number;
  work_order_id: number;
  registration_id: number | null;
  party_name: string;
  party_contact: string | null;
  party_email: string | null;
  scope_of_work: string | null;
  agreed_amount: number;
  advance_payment: number;
  remaining_payment: number;
  payment_status: string;
  payment_amount: number;
  payment_date: string | null;
  payment_reference: string | null;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  completion_details: string | null;
  delivery_date: string | null;
  notes: string | null;
  work_order?: { work_order_no: string; client_name: string } | null;
  created_at: string;
};

const STATUS_COLORS: Record<string, string> = {
  assigned: '#2196f3', in_progress: '#ff9800', completed: '#4caf50', cancelled: '#f44336',
};

const PAYMENT_COLORS: Record<string, string> = {
  pending: '#f44336', partial: '#ff9800', paid: '#4caf50',
};

export default function OutsourcePage() {
  const [assignments, setAssignments] = useState<OutsourceAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<OutsourceAssignment | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [workOrders, setWorkOrders] = useState<WorkOrderOption[]>([]);
  const [form, setForm] = useState({
    work_order_id: 0, party_name: '', party_contact: '', party_email: '',
    scope_of_work: '', agreed_amount: 0, advance_payment: 0, notes: '',
    registration_id: null as number | null,
  });

  const remainingPayment = (form.agreed_amount || 0) - (form.advance_payment || 0);

  const fetchAssignments = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (search) params.set('search', search);
      const data = await request<any>(`/outsource?${params}`);
      setAssignments(data.data || []);
    } catch { setAssignments([]); }
    setLoading(false);
  };

  const fetchWorkOrders = async () => {
    try {
      const data = await request<any>('/work-orders?per_page=500');
      setWorkOrders((data.data || []).map((wo: any) => ({
        id: wo.id,
        work_order_no: wo.work_order_no,
        client_name: wo.client_name,
      })));
    } catch { /* ignore */ }
  };

  useEffect(() => { fetchAssignments(); }, [statusFilter, search]);
  useEffect(() => { fetchWorkOrders(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({
      work_order_id: 0, party_name: '', party_contact: '', party_email: '',
      scope_of_work: '', agreed_amount: 0, advance_payment: 0, notes: '',
      registration_id: null,
    });
    setShowModal(true);
  };

  const openEdit = (a: OutsourceAssignment) => {
    setEditing(a);
    setForm({
      work_order_id: a.work_order_id, party_name: a.party_name,
      party_contact: a.party_contact || '', party_email: a.party_email || '',
      scope_of_work: a.scope_of_work || '', agreed_amount: a.agreed_amount,
      advance_payment: a.advance_payment || 0,
      notes: a.notes || '', registration_id: a.registration_id,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    try {
      const method = editing ? 'PUT' : 'POST';
      const url = editing ? `/outsource/${editing.id}` : '/outsource';
      await request(url, { method, body: JSON.stringify(form) });
      setShowModal(false);
      fetchAssignments();
    } catch (e: any) { alert(e.message || 'Save failed'); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this assignment?')) return;
    try {
      await request(`/outsource/${id}`, { method: 'DELETE' });
      fetchAssignments();
    } catch { /* ignore */ }
  };

  const handleStatusChange = async (id: number, status: string, extra: Record<string, any> = {}) => {
    try {
      await request(`/outsource/${id}`, {
        method: 'PUT', body: JSON.stringify({ status, ...extra }),
      });
      fetchAssignments();
    } catch { /* ignore */ }
  };

  const handlePaymentUpdate = async (id: number) => {
    const amount = prompt('Payment amount:');
    if (!amount) return;
    const ref = prompt('Payment reference:');
    try {
      await request(`/outsource/${id}`, {
        method: 'PUT', body: JSON.stringify({
          payment_status: 'paid',
          payment_amount: parseFloat(amount),
          payment_date: new Date().toISOString().slice(0, 10),
          payment_reference: ref || '',
        }),
      });
      fetchAssignments();
    } catch { /* ignore */ }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Outsource Assignments</h1>
        <button className="btn btn-primary" onClick={openCreate}>+ New Assignment</button>
      </div>

      <div className="filters-bar">
        <input type="text" className="form-input" placeholder="Search assignments..." value={search}
          onChange={(e) => setSearch(e.target.value)} style={{ flex: 1 }} />
        <select className="form-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          <option value="assigned">Assigned</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Party</th>
              <th>Contact</th>
              <th>Work Order</th>
              <th>Amount</th>
              <th>Advance</th>
              <th>Remaining</th>
              <th>Payment</th>
              <th>Status</th>
              <th>Delivery</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10}>Loading...</td></tr>
            ) : assignments.length === 0 ? (
              <tr><td colSpan={10}>No assignments found</td></tr>
            ) : assignments.map((a) => (
              <tr key={a.id}>
                <td><strong>{a.party_name}</strong></td>
                <td>{a.party_contact || a.party_email || '-'}</td>
                <td>
                  <span className="badge" style={{ backgroundColor: '#8b5cf6', color: '#fff' }}>
                    {a.work_order?.work_order_no || '-'}
                  </span>
                </td>
                <td>₹{Number(a.agreed_amount).toLocaleString()}</td>
                <td>₹{Number(a.advance_payment || 0).toLocaleString()}</td>
                <td style={{ color: Number(a.remaining_payment || 0) > 0 ? '#f44336' : '#4caf50', fontWeight: 600 }}>
                  ₹{Number(a.remaining_payment || 0).toLocaleString()}
                </td>
                <td>
                  <span className="badge" style={{ backgroundColor: PAYMENT_COLORS[a.payment_status] || '#999', color: '#fff' }}>
                    {a.payment_status} {a.payment_amount > 0 ? `(₹${Number(a.payment_amount).toLocaleString()})` : ''}
                  </span>
                </td>
                <td>
                  <span className="badge" style={{ backgroundColor: STATUS_COLORS[a.status] || '#999', color: '#fff' }}>
                    {a.status}
                  </span>
                </td>
                <td>{a.delivery_date || '-'}</td>
                <td>
                  <button className="btn btn-sm" onClick={() => openEdit(a)}>Edit</button>
                  <button className="btn btn-sm btn-danger" onClick={() => handleDelete(a.id)}>Delete</button>
                  {a.status === 'assigned' && (
                    <button className="btn btn-sm" style={{ backgroundColor: '#ff9800', color: '#fff' }}
                      onClick={() => handleStatusChange(a.id, 'in_progress')}>Start</button>
                  )}
                  {a.status === 'in_progress' && (
                    <button className="btn btn-sm" style={{ backgroundColor: '#4caf50', color: '#fff' }}
                      onClick={() => {
                        const details = prompt('Completion details:');
                        if (details) handleStatusChange(a.id, 'completed', {
                          completion_details: details,
                          delivery_date: new Date().toISOString().slice(0, 10),
                        });
                      }}>Complete</button>
                  )}
                  {a.payment_status !== 'paid' && (
                    <button className="btn btn-sm" style={{ backgroundColor: '#9c27b0', color: '#fff' }}
                      onClick={() => handlePaymentUpdate(a.id)}>Pay</button>
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
            <h2>{editing ? 'Edit Assignment' : 'New Outsource Assignment'}</h2>
            <div className="form-grid">
              <div className="form-group">
                <label>Work Order *</label>
                <select className="form-input" value={form.work_order_id}
                  onChange={(e) => setForm({ ...form, work_order_id: parseInt(e.target.value) || 0 })}>
                  <option value={0}>-- Select Work Order --</option>
                  {workOrders.map((wo) => (
                    <option key={wo.id} value={wo.id}>
                      {wo.work_order_no} — {wo.client_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Party Name *</label>
                <input className="form-input" value={form.party_name}
                  onChange={(e) => setForm({ ...form, party_name: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Party Contact</label>
                <input className="form-input" value={form.party_contact}
                  onChange={(e) => setForm({ ...form, party_contact: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Party Email</label>
                <input className="form-input" type="email" value={form.party_email}
                  onChange={(e) => setForm({ ...form, party_email: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Agreed Amount *</label>
                <input className="form-input" type="number" value={form.agreed_amount}
                  onChange={(e) => setForm({ ...form, agreed_amount: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="form-group">
                <label>Advance Payment</label>
                <input className="form-input" type="number" value={form.advance_payment}
                  onChange={(e) => setForm({ ...form, advance_payment: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="form-group">
                <label>Remaining Payment</label>
                <input className="form-input" type="number" value={remainingPayment} readOnly
                  style={{ background: '#f5f5f5', fontWeight: 600, color: remainingPayment > 0 ? '#f44336' : '#4caf50' }} />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Scope of Work</label>
                <textarea className="form-input" rows={3} value={form.scope_of_work}
                  onChange={(e) => setForm({ ...form, scope_of_work: e.target.value })} />
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
