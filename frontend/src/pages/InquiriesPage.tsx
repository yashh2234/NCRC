import { useEffect, useState } from 'react';

type Inquiry = {
  id: number;
  inquiry_no: string;
  client_name: string;
  agency_name: string | null;
  contact_person: string | null;
  mobile_no: string | null;
  email: string | null;
  inquiry_type: string;
  scope_of_work: string | null;
  source_location: string | null;
  priority: string;
  status: string;
  notes: string | null;
  received_date: string;
  contacted_at: string | null;
  created_at: string;
  assigned_user?: { id: number; name: string } | null;
};

const STATUS_COLORS: Record<string, string> = {
  new: '#2196f3',
  contacted: '#ff9800',
  quoted: '#9c27b0',
  converted: '#4caf50',
  cancelled: '#f44336',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: '#9e9e9e',
  normal: '#2196f3',
  high: '#ff9800',
  urgent: '#f44336',
};

export default function InquiriesPage() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Inquiry | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({
    client_name: '', agency_name: '', contact_person: '', mobile_no: '',
    email: '', inquiry_type: 'walk_in', scope_of_work: '', source_location: '',
    priority: 'normal', notes: '', received_date: new Date().toISOString().slice(0, 10),
  });

  const fetchInquiries = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (search) params.set('search', search);
    const res = await fetch(`/api/inquiries?${params}`);
    const data = await res.json();
    setInquiries(data.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchInquiries(); }, [statusFilter, search]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      client_name: '', agency_name: '', contact_person: '', mobile_no: '',
      email: '', inquiry_type: 'walk_in', scope_of_work: '', source_location: '',
      priority: 'normal', notes: '', received_date: new Date().toISOString().slice(0, 10),
    });
    setShowModal(true);
  };

  const openEdit = (inq: Inquiry) => {
    setEditing(inq);
    setForm({
      client_name: inq.client_name, agency_name: inq.agency_name || '',
      contact_person: inq.contact_person || '', mobile_no: inq.mobile_no || '',
      email: inq.email || '', inquiry_type: inq.inquiry_type,
      scope_of_work: inq.scope_of_work || '', source_location: inq.source_location || '',
      priority: inq.priority, notes: inq.notes || '', received_date: inq.received_date,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    const method = editing ? 'PUT' : 'POST';
    const url = editing ? `/api/inquiries/${editing.id}` : '/api/inquiries';
    await fetch(url, {
      method, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setShowModal(false);
    fetchInquiries();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this inquiry?')) return;
    await fetch(`/api/inquiries/${id}`, { method: 'DELETE' });
    fetchInquiries();
  };

  const handleStatusChange = async (id: number, status: string) => {
    await fetch(`/api/inquiries/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    fetchInquiries();
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Inquiries</h1>
        <button className="btn btn-primary" onClick={openCreate}>+ New Inquiry</button>
      </div>

      <div className="filters-bar">
        <input
          type="text"
          className="form-input"
          placeholder="Search inquiries..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1 }}
        />
        <select className="form-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          <option value="new">New</option>
          <option value="contacted">Contacted</option>
          <option value="quoted">Quoted</option>
          <option value="converted">Converted</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Inquiry No</th>
              <th>Client</th>
              <th>Agency</th>
              <th>Contact</th>
              <th>Type</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9}>Loading...</td></tr>
            ) : inquiries.length === 0 ? (
              <tr><td colSpan={9}>No inquiries found</td></tr>
            ) : inquiries.map((inq) => (
              <tr key={inq.id}>
                <td><strong>{inq.inquiry_no}</strong></td>
                <td>{inq.client_name}</td>
                <td>{inq.agency_name || '-'}</td>
                <td>{inq.contact_person || inq.mobile_no || '-'}</td>
                <td>{inq.inquiry_type.replace('_', ' ')}</td>
                <td>
                  <span className="badge" style={{ backgroundColor: PRIORITY_COLORS[inq.priority] || '#999', color: '#fff' }}>
                    {inq.priority}
                  </span>
                </td>
                <td>
                  <span className="badge" style={{ backgroundColor: STATUS_COLORS[inq.status] || '#999', color: '#fff' }}>
                    {inq.status}
                  </span>
                </td>
                <td>{inq.received_date}</td>
                <td>
                  <button className="btn btn-sm" onClick={() => openEdit(inq)}>Edit</button>
                  <button className="btn btn-sm btn-danger" onClick={() => handleDelete(inq.id)}>Del</button>
                  {inq.status === 'new' && (
                    <button className="btn btn-sm" style={{ backgroundColor: '#ff9800', color: '#fff' }}
                      onClick={() => handleStatusChange(inq.id, 'contacted')}>Contact</button>
                  )}
                  {inq.status === 'contacted' && (
                    <button className="btn btn-sm" style={{ backgroundColor: '#9c27b0', color: '#fff' }}
                      onClick={() => handleStatusChange(inq.id, 'quoted')}>Quote</button>
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
            <h2>{editing ? 'Edit Inquiry' : 'New Inquiry'}</h2>
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
                <label>Email</label>
                <input className="form-input" type="email" value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Inquiry Type *</label>
                <select className="form-input" value={form.inquiry_type}
                  onChange={(e) => setForm({ ...form, inquiry_type: e.target.value })}>
                  <option value="walk_in">Walk In</option>
                  <option value="phone">Phone</option>
                  <option value="email">Email</option>
                  <option value="letter">Letter</option>
                  <option value="reference">Reference</option>
                </select>
              </div>
              <div className="form-group">
                <label>Priority *</label>
                <select className="form-input" value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div className="form-group">
                <label>Received Date *</label>
                <input className="form-input" type="date" value={form.received_date}
                  onChange={(e) => setForm({ ...form, received_date: e.target.value })} />
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
