import { useEffect, useState } from 'react';
import { Pencil, Trash2, Search } from 'lucide-react';
import { request } from '../lib/api';
import { softTone } from '../lib/utils'
import { Req } from '../components/ui'
import { Modal } from '../components/Modal'
import { Select } from '../components/Select'
import { HistoryButton } from '../components/History'
import { showSaved } from '../lib/toast'

type WorkOrderOption = {
  id: number;
  work_order_no: string;
  client_name: string;
};

type Vendor = {
  id: number;
  vendor_name: string;
  mobile: string | null;
  approval_status: 'pending' | 'approved' | 'rejected';
  is_active: boolean;
};

const APPROVAL_LABELS: Record<Vendor['approval_status'], { label: string; color: string }> = {
  approved: { label: 'Approved', color: '#16a34a' },
  pending: { label: 'Pending approval', color: '#d97706' },
  rejected: { label: 'Rejected', color: '#dc2626' },
};

type OutsourceAssignment = {
  id: number;
  work_order_id: number;
  registration_id: number | null;
  vendor_id: number | null;
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
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [canApprove, setCanApprove] = useState(false);
  const [vendorForm, setVendorForm] = useState<{ id: number | null; vendor_name: string; mobile: string } | null>(null);
  const [savingVendor, setSavingVendor] = useState(false);
  const [form, setForm] = useState({
    vendor_id: 0,
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

  const fetchVendors = async () => {
    try {
      const data = await request<any>('/vendors?per_page=500');
      setVendors(data.data || []);
      setCanApprove(Boolean(data.can_approve));
    } catch { setVendors([]); }
  };

  useEffect(() => { fetchAssignments(); }, [statusFilter, search]);
  useEffect(() => { fetchWorkOrders(); fetchVendors(); }, []);

  const saveVendor = async () => {
    if (!vendorForm) return;
    if (!vendorForm.vendor_name.trim()) { alert('Enter the vendor name.'); return; }
    setSavingVendor(true);
    try {
      const body = JSON.stringify({ vendor_name: vendorForm.vendor_name.trim(), mobile: vendorForm.mobile.trim() || null });
      if (vendorForm.id) await request(`/vendors/${vendorForm.id}`, { method: 'PUT', body });
      else await request('/vendors', { method: 'POST', body });
      setVendorForm(null);
      fetchVendors();
    } catch (e: any) { alert(e.message || 'Could not save vendor'); }
    setSavingVendor(false);
  };

  const deleteVendor = async (vendor: Vendor) => {
    if (!confirm(`Delete vendor ${vendor.vendor_name}?`)) return;
    try {
      await request(`/vendors/${vendor.id}`, { method: 'DELETE' });
      fetchVendors();
    } catch (e: any) { alert(e.message || 'Could not delete vendor'); }
  };

  const setApproval = async (vendor: Vendor, status: 'approved' | 'rejected') => {
    try {
      await request(`/vendors/${vendor.id}/approve`, { method: 'POST', body: JSON.stringify({ status }) });
      fetchVendors();
    } catch (e: any) { alert(e.message || 'Could not update vendor'); }
  };

  const approvedVendors = vendors.filter((v) => v.approval_status === 'approved' && v.is_active !== false);
  const pendingVendors = vendors.filter((v) => v.approval_status === 'pending');
  const selectedVendor = vendors.find((v) => v.id === form.vendor_id);

  const openCreate = () => {
    setEditing(null);
    setForm({
      vendor_id: 0,
      work_order_id: 0, party_name: '', party_contact: '', party_email: '',
      scope_of_work: '', agreed_amount: 0, advance_payment: 0, notes: '',
      registration_id: null,
    });
    setShowModal(true);
  };

  const openEdit = (a: OutsourceAssignment) => {
    setEditing(a);
    setForm({
      vendor_id: a.vendor_id || 0,
      work_order_id: a.work_order_id, party_name: a.party_name,
      party_contact: a.party_contact || '', party_email: a.party_email || '',
      scope_of_work: a.scope_of_work || '', agreed_amount: a.agreed_amount,
      advance_payment: a.advance_payment || 0,
      notes: a.notes || '', registration_id: a.registration_id,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.vendor_id) { alert('Select an approved vendor.'); return; }
    try {
      const method = editing ? 'PUT' : 'POST';
      const url = editing ? `/outsource/${editing.id}` : '/outsource';
      await request(url, { method, body: JSON.stringify(form) });
      setShowModal(false);
      fetchAssignments();
      showSaved();
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

  return (
    <div className="page-container">
      <section className="surface">
        <div className="surface-heading">
          <div>
            <p className="section-label">Outsource</p>
            <h2>Vendor Registration ({vendors.length})</h2>
          </div>
          <button className="btn btn-primary" type="button" onClick={() => setVendorForm({ id: null, vendor_name: '', mobile: '' })}>+ Add Vendor</button>
        </div>
        <p style={{ margin: '0 0 12px', fontSize: '0.8rem', color: '#64748b' }}>
          {canApprove
            ? `Only approved vendors can be chosen for an assignment.${pendingVendors.length ? ` ${pendingVendors.length} waiting for your approval.` : ''}`
            : 'New vendors need admin approval before they can be chosen for an assignment.'}
        </p>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Vendor Name</th>
                <th>Number</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {vendors.length === 0 ? (
                <tr><td colSpan={4}>No vendors registered yet.</td></tr>
              ) : vendors.map((v) => {
                const approval = APPROVAL_LABELS[v.approval_status] ?? APPROVAL_LABELS.pending;
                return (
                  <tr key={v.id}>
                    <td><strong>{v.vendor_name}</strong></td>
                    <td>{v.mobile || '-'}</td>
                    <td><span className="badge" style={softTone(approval.color)}>{approval.label}</span></td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {canApprove && v.approval_status !== 'approved' && (
                        <button className="btn btn-sm" type="button" style={softTone('#16a34a')} onClick={() => setApproval(v, 'approved')}>Approve</button>
                      )}
                      {canApprove && v.approval_status === 'pending' && (
                        <button className="btn btn-sm" type="button" style={softTone('#dc2626')} onClick={() => setApproval(v, 'rejected')}>Reject</button>
                      )}
                      <HistoryButton type="Vendor" id={v.id} title={`Vendor ${v.vendor_name ?? ''}`} />
                      <button className="icon-button" type="button" title="Edit" aria-label="Edit vendor" onClick={() => setVendorForm({ id: v.id, vendor_name: v.vendor_name, mobile: v.mobile || '' })}><Pencil size={16} /></button>
                      <button className="icon-button" type="button" title="Delete" aria-label="Delete vendor" onClick={() => deleteVendor(v)}><Trash2 size={16} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Search, status and New in one box */}
      <div className="dt-toolbar dt-toolbar--box" style={{ marginBottom: 16 }}>
        <div className="dt-toolbar__start">
          <div className="search-field dt-search">
            <Search size={15} />
            <input type="search" placeholder="Search assignments..." value={search} aria-label="Search assignments"
              onChange={(e) => setSearch(e.target.value)} />
          </div>
            <Select className="form-input" aria-label="Filter by status" style={{ width: 'auto', minWidth: 170, minHeight: 36, fontSize: '0.82rem' }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All Status</option>
              <option value="assigned">Assigned</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </Select>
        </div>
        <div className="dt-toolbar__meta">
          <button className="btn btn-primary btn-sm" type="button" onClick={openCreate}>+ New Assignment</button>
        </div>
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
                  <span className="badge" style={softTone('#8b5cf6')}>
                    {a.work_order?.work_order_no || '-'}
                  </span>
                </td>
                <td>₹{Number(a.agreed_amount).toLocaleString()}</td>
                <td>₹{Number(a.advance_payment || 0).toLocaleString()}</td>
                <td style={{ color: Number(a.remaining_payment || 0) > 0 ? '#f44336' : '#4caf50', fontWeight: 600 }}>
                  ₹{Number(a.remaining_payment || 0).toLocaleString()}
                </td>
                <td>
                  <span className="badge" style={softTone(PAYMENT_COLORS[a.payment_status] || '#64748b')}>
                    {a.payment_status} {a.payment_amount > 0 ? `(₹${Number(a.payment_amount).toLocaleString()})` : ''}
                  </span>
                </td>
                <td>
                  <span className="badge" style={softTone(STATUS_COLORS[a.status] || '#64748b')}>
                    {a.status}
                  </span>
                </td>
                <td>{a.delivery_date || '-'}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <HistoryButton type="OutsourceAssignment" id={a.id} title={`Outsource · ${a.party_name ?? ''}`} />
                  <button className="icon-button" type="button" title="Edit" aria-label="Edit assignment" onClick={() => openEdit(a)}><Pencil size={16} /></button>
                  <button className="icon-button" type="button" title="Delete" aria-label="Delete assignment" onClick={() => handleDelete(a.id)}><Trash2 size={16} /></button>
                  {a.status === 'assigned' && (
                    <button className="btn btn-sm" style={softTone('#ff9800')}
                      onClick={() => handleStatusChange(a.id, 'in_progress')}>Start</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <Modal title={editing ? 'Edit Assignment' : 'New Outsource Assignment'} onClose={() => setShowModal(false)} onSave={handleSave} saveLabel={editing ? 'Update' : 'Create'}>
            <div className="form-grid">
              <div className="form-group">
                <label><span>Work Order<Req /></span></label>
                <Select className="form-input" value={form.work_order_id}
                  onChange={(e) => setForm({ ...form, work_order_id: parseInt(e.target.value) || 0 })}>
                  <option value={0}>-- Select Work Order --</option>
                  {workOrders.map((wo) => (
                    <option key={wo.id} value={wo.id}>
                      {wo.work_order_no} — {wo.client_name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="form-group">
                <label><span>Vendor<Req /></span></label>
                <Select className="form-input" value={form.vendor_id}
                  onChange={(e) => setForm({ ...form, vendor_id: parseInt(e.target.value) || 0 })}>
                  <option value={0}>-- Select Vendor --</option>
                  {approvedVendors.map((v) => (
                    <option key={v.id} value={v.id}>{v.vendor_name}{v.mobile ? ` — ${v.mobile}` : ''}</option>
                  ))}
                  {pendingVendors.map((v) => (
                    <option key={v.id} value={v.id} disabled>{v.vendor_name} (pending approval)</option>
                  ))}
                </Select>
                {editing && !editing.vendor_id && !form.vendor_id ? (
                  <small style={{ color: '#b45309' }}>Currently “{editing.party_name}”, which is not a registered vendor. Select a vendor to save.</small>
                ) : approvedVendors.length === 0 ? (
                  <small style={{ color: '#b45309' }}>No approved vendors yet. Add one under Vendor Registration{canApprove ? ' and approve it' : ' and ask an admin to approve it'}.</small>
                ) : null}
              </div>
              <div className="form-group">
                <label>Vendor Number</label>
                <input className="form-input" value={selectedVendor?.mobile || ''} readOnly
                  style={{ background: '#f5f5f5' }} placeholder="From the selected vendor" />
              </div>
              <div className="form-group">
                <label>Party Email</label>
                <input className="form-input" type="email" value={form.party_email}
                  onChange={(e) => setForm({ ...form, party_email: e.target.value })} />
              </div>
              <div className="form-group">
                <label><span>Agreed Amount<Req /></span></label>
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
        </Modal>
      )}
      {vendorForm && (
        <Modal title={vendorForm.id ? 'Edit Vendor' : 'Add Vendor'} subtitle="Vendor Registration" onClose={() => setVendorForm(null)} onSave={saveVendor} saving={savingVendor} saveLabel={vendorForm.id ? 'Update' : 'Add Vendor'} size="sm">
          <div className="form-grid">
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label><span>Vendor Name<Req /></span></label>
              <input className="form-input" autoFocus value={vendorForm.vendor_name}
                onChange={(e) => setVendorForm({ ...vendorForm, vendor_name: e.target.value })} />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Number</label>
              <input className="form-input" type="tel" inputMode="tel" value={vendorForm.mobile}
                onChange={(e) => setVendorForm({ ...vendorForm, mobile: e.target.value })} />
            </div>
            {!canApprove ? (
              <p style={{ gridColumn: '1 / -1', margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
                {vendorForm.id ? 'Changing the name or number sends the vendor back for admin approval.' : 'The vendor can be used for assignments once an admin approves it.'}
              </p>
            ) : null}
          </div>
        </Modal>
      )}
    </div>
  );
}
