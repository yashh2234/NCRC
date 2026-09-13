import { useEffect, useState } from 'react';
import { request } from '../lib/api';

type Registration = {
  iClientId: number;
  uid_no: string;
  agency_name: string;
  mobile_no: string;
  reporting_address: string;
  name_of_work: string;
};

type WorkOrder = {
  id: number;
  work_order_no: string;
  inquiry_id: number | null;
  quotation_id: number | null;
  registration_id: number | null;
  client_name: string;
  agency_name: string | null;
  contact_person: string | null;
  mobile_no: string | null;
  scope_of_work: string | null;
  total_amount: number;
  advance_payment: number;
  balance_dues: number;
  payment_terms: string | null;
  status: string;
  assignment_type: string;
  due_date: string | null;
  notes: string | null;
  created_at: string;
  registration?: Registration | null;
  outsource_assignments?: any[];
};

const STATUS_COLORS: Record<string, string> = {
  draft: '#9e9e9e', active: '#2196f3', in_progress: '#ff9800', completed: '#4caf50', cancelled: '#f44336',
};

export default function WorkOrdersPage() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<WorkOrder | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [uidSearch, setUidSearch] = useState('');
  const [form, setForm] = useState({
    client_name: '', agency_name: '', contact_person: '', mobile_no: '',
    scope_of_work: '', total_amount: 0, advance_payment: 0, payment_terms: '',
    due_date: '', notes: '',
    inquiry_id: null as number | null, quotation_id: null as number | null,
    registration_id: null as number | null,
  });

  const fetchWorkOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (search) params.set('search', search);
      const data = await request<any>(`/work-orders?${params}`);
      setWorkOrders(data.data || []);
    } catch { setWorkOrders([]); }
    setLoading(false);
  };

  const fetchRegistrations = async () => {
    try {
      const data = await request<any>('/registrations?per_page=500');
      setRegistrations(data.data || []);
    } catch { /* ignore */ }
  };

  useEffect(() => { fetchWorkOrders(); }, [statusFilter, search]);
  useEffect(() => { fetchRegistrations(); }, []);

  const filteredRegistrations = registrations.filter((r) =>
    !uidSearch || r.uid_no.toLowerCase().includes(uidSearch.toLowerCase()) ||
    r.agency_name?.toLowerCase().includes(uidSearch.toLowerCase())
  );

  const handleUidSelect = (reg: Registration) => {
    setForm({
      ...form,
      registration_id: reg.iClientId,
      client_name: reg.agency_name || '',
      agency_name: reg.agency_name || '',
      mobile_no: reg.mobile_no || '',
      scope_of_work: reg.name_of_work || '',
    });
    setUidSearch(reg.uid_no);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({
      client_name: '', agency_name: '', contact_person: '', mobile_no: '',
      scope_of_work: '', total_amount: 0, advance_payment: 0, payment_terms: '',
      due_date: '', notes: '',
      inquiry_id: null, quotation_id: null, registration_id: null,
    });
    setUidSearch('');
    setShowModal(true);
  };

  const openEdit = (wo: WorkOrder) => {
    setEditing(wo);
    setForm({
      client_name: wo.client_name, agency_name: wo.agency_name || '',
      contact_person: wo.contact_person || '', mobile_no: wo.mobile_no || '',
      scope_of_work: wo.scope_of_work || '', total_amount: wo.total_amount,
      advance_payment: wo.advance_payment, payment_terms: wo.payment_terms || '',
      due_date: wo.due_date || '', notes: wo.notes || '',
      inquiry_id: wo.inquiry_id, quotation_id: wo.quotation_id, registration_id: wo.registration_id,
    });
    // Find the UID for the linked registration
    const linkedReg = registrations.find((r) => r.iClientId === wo.registration_id);
    setUidSearch(linkedReg?.uid_no || '');
    setShowModal(true);
  };

  const handleSave = async () => {
    try {
      const method = editing ? 'PUT' : 'POST';
      const url = editing ? `/work-orders/${editing.id}` : '/work-orders';
      await request(url, { method, body: JSON.stringify(form) });
      setShowModal(false);
      fetchWorkOrders();
    } catch (e: any) { alert(e.message || 'Save failed'); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this work order?')) return;
    try {
      await request(`/work-orders/${id}`, { method: 'DELETE' });
      fetchWorkOrders();
    } catch { /* ignore */ }
  };

  const handleStatusChange = async (id: number, status: string) => {
    try {
      await request(`/work-orders/${id}`, {
        method: 'PUT', body: JSON.stringify({ status }),
      });
      fetchWorkOrders();
    } catch { /* ignore */ }
  };

  // Resolve UID for a registration_id
  const getUidForRegistration = (regId: number | null) => {
    if (!regId) return '-';
    const reg = registrations.find((r) => r.iClientId === regId);
    return reg?.uid_no || '-';
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Work Orders</h1>
        <button className="btn btn-primary" onClick={openCreate}>+ New Work Order</button>
      </div>

      <div className="filters-bar">
        <input type="text" className="form-input" placeholder="Search work orders..." value={search}
          onChange={(e) => setSearch(e.target.value)} style={{ flex: 1 }} />
        <select className="form-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>WO No</th>
              <th>UID</th>
              <th>Client</th>
              <th>Amount</th>
              <th>Advance</th>
              <th>Remaining</th>
              <th>Status</th>
              <th>Due Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9}>Loading...</td></tr>
            ) : workOrders.length === 0 ? (
              <tr><td colSpan={9}>No work orders found</td></tr>
            ) : workOrders.map((wo) => (
              <tr key={wo.id}>
                <td><strong>{wo.work_order_no}</strong></td>
                <td>
                  <span className="badge" style={{
                    backgroundColor: '#8b5cf6',
                    color: '#fff',
                  }}>
                    {getUidForRegistration(wo.registration_id)}
                  </span>
                </td>
                <td>{wo.client_name}</td>
                <td>₹{Number(wo.total_amount).toLocaleString()}</td>
                <td>₹{Number(wo.advance_payment).toLocaleString()}</td>
                <td style={{ color: Number(wo.balance_dues) > 0 ? '#f44336' : '#4caf50', fontWeight: 600 }}>
                  ₹{Number(wo.balance_dues).toLocaleString()}
                </td>
                <td>
                  <span className="badge" style={{ backgroundColor: STATUS_COLORS[wo.status] || '#999', color: '#fff' }}>
                    {wo.status}
                  </span>
                </td>
                <td>{wo.due_date || '-'}</td>
                <td>
                  <button className="btn btn-sm" onClick={() => openEdit(wo)}>Edit</button>
                  <button className="btn btn-sm btn-danger" onClick={() => handleDelete(wo.id)}>Del</button>
                  {wo.status === 'draft' && (
                    <button className="btn btn-sm" style={{ backgroundColor: '#2196f3', color: '#fff' }}
                      onClick={() => handleStatusChange(wo.id, 'active')}>Activate</button>
                  )}
                  {wo.status === 'active' && (
                    <button className="btn btn-sm" style={{ backgroundColor: '#ff9800', color: '#fff' }}
                      onClick={() => handleStatusChange(wo.id, 'in_progress')}>Start</button>
                  )}
                  {wo.status === 'in_progress' && (
                    <button className="btn btn-sm" style={{ backgroundColor: '#4caf50', color: '#fff' }}
                      onClick={() => handleStatusChange(wo.id, 'completed')}>Complete</button>
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
            <h2>{editing ? 'Edit Work Order' : 'New Work Order'}</h2>
            <div className="form-grid">
              <div className="form-group" style={{ gridColumn: '1 / -1', position: 'relative' }}>
                <label>Link to UID *</label>
                <input className="form-input" placeholder="Search UID..."
                  value={uidSearch}
                  onChange={(e) => {
                    setUidSearch(e.target.value);
                    if (!e.target.value) {
                      setForm({ ...form, registration_id: null, client_name: '', agency_name: '', mobile_no: '', scope_of_work: '' });
                    }
                  }} />
                {uidSearch && !form.registration_id && filteredRegistrations.length > 0 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                    background: '#fff', border: '1px solid var(--color-border, #ddd)',
                    borderRadius: 8, maxHeight: 200, overflowY: 'auto',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  }}>
                    {filteredRegistrations.slice(0, 20).map((reg) => (
                      <div key={reg.iClientId}
                        style={{
                          padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #f0f0f0',
                          transition: 'background 0.15s',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#f5f5ff')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
                        onClick={() => handleUidSelect(reg)}
                      >
                        <strong style={{ color: '#8b5cf6' }}>{reg.uid_no}</strong>
                        <span style={{ marginLeft: 12, color: '#666', fontSize: '0.85rem' }}>
                          {reg.agency_name} | {reg.mobile_no}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {form.registration_id && (
                  <div style={{
                    marginTop: 6, padding: '8px 12px', background: '#f0f0ff', borderRadius: 8,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    fontSize: '0.85rem',
                  }}>
                    <span>Linked to: <strong style={{ color: '#8b5cf6' }}>{uidSearch}</strong></span>
                    <button className="btn btn-sm" style={{ minHeight: 26, padding: '0 10px', fontSize: '0.75rem' }}
                      onClick={() => {
                        setForm({ ...form, registration_id: null, client_name: '', agency_name: '', mobile_no: '', scope_of_work: '' });
                        setUidSearch('');
                      }}>Clear</button>
                  </div>
                )}
              </div>
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
                <label>Contact Person</label>
                <input className="form-input" value={form.contact_person}
                  onChange={(e) => setForm({ ...form, contact_person: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Mobile No</label>
                <input className="form-input" value={form.mobile_no}
                  onChange={(e) => setForm({ ...form, mobile_no: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Due Date</label>
                <input className="form-input" type="date" value={form.due_date}
                  onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Total Amount</label>
                <input className="form-input" type="number" value={form.total_amount}
                  onChange={(e) => setForm({ ...form, total_amount: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="form-group">
                <label>Advance Payment</label>
                <input className="form-input" type="number" value={form.advance_payment}
                  onChange={(e) => setForm({ ...form, advance_payment: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="form-group">
                <label>Remaining Amount</label>
                <input className="form-input" type="number"
                  value={(form.total_amount || 0) - (form.advance_payment || 0)}
                  readOnly
                  style={{ background: '#f5f5f5', fontWeight: 600,
                    color: ((form.total_amount || 0) - (form.advance_payment || 0)) > 0 ? '#f44336' : '#4caf50' }} />
              </div>
              <div className="form-group">
                <label>Payment Terms</label>
                <input className="form-input" value={form.payment_terms}
                  onChange={(e) => setForm({ ...form, payment_terms: e.target.value })} />
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
