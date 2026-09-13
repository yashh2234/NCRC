import { useState, useEffect, type FormEvent, type ReactNode } from 'react'
import { Building2, Plus, Phone, Mail, MapPin, User, MessageSquare, ChevronRight, X, Trash2, Edit3, Users, FileText } from 'lucide-react'
import { request } from '../lib/api'
import { DataTable } from '../components/DataTable'

interface ClientRecord {
  id: number
  uid: string | null
  company_name: string
  contact_person: string | null
  phone: string | null
  mobile: string | null
  email: string | null
  address: string | null
  city: string | null
  state: string | null
  gst_no: string | null
  category: string | null
  is_active: boolean
  notes: string | null
  created_at: string | null
  contacts_count?: number
  registrations_count?: number
  contacts?: Array<{
    id: number; name: string; designation: string | null
    phone: string | null; mobile: string | null; email: string | null; is_primary: boolean
  }>
  communications?: Array<{
    id: number; type: string; subject: string | null; body: string | null
    communication_date: string | null; user?: { id: number; name: string }
  }>
  registrations?: Array<{ iClientId: number; uid_no: string; received_date: string | null; name_of_work: string | null; total_payment: number }>
}

const emptyClient = {
  company_name: '', contact_person: '', phone: '', mobile: '', email: '',
  website: '', address: '', city: '', state: '', pincode: '',
  gst_no: '', pan_no: '', category: '', notes: '',
}

export function ClientsPage() {
  const [clients, setClients] = useState<ClientRecord[]>([])
  const [selectedClient, setSelectedClient] = useState<ClientRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // Form
  const [showForm, setShowForm] = useState(false)
  const [editingClient, setEditingClient] = useState<ClientRecord | null>(null)
  const [formData, setFormData] = useState(emptyClient)

  // Contacts
  const [showContactForm, setShowContactForm] = useState(false)
  const [contactForm, setContactForm] = useState({ name: '', designation: '', phone: '', mobile: '', email: '', is_primary: false })

  // Communication
  const [showCommForm, setShowCommForm] = useState(false)
  const [commForm, setCommForm] = useState({ type: 'note', subject: '', body: '' })

  useEffect(() => { loadClients() }, [])

  const loadClients = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (searchQuery) params.set('search', searchQuery)
      params.set('per_page', '50')
      const data = await request<{ data: ClientRecord[] }>(`/clients?${params.toString()}`)
      setClients(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load clients')
    } finally { setLoading(false) }
  }

  useEffect(() => { void loadClients() }, [searchQuery])

  const loadClientDetail = async (client: ClientRecord) => {
    try {
      const data = await request<ClientRecord>(`/clients/${client.id}`)
      setSelectedClient(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load client details')
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    try {
      if (editingClient) {
        await request(`/clients/${editingClient.id}`, { method: 'PUT', body: JSON.stringify(formData) })
      } else {
        await request('/clients', { method: 'POST', body: JSON.stringify(formData) })
      }
      setShowForm(false)
      setEditingClient(null)
      setFormData(emptyClient)
      await loadClients()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save client')
    }
  }

  const handleContactSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!selectedClient) return
    try {
      await request(`/clients/${selectedClient.id}/contacts`, { method: 'POST', body: JSON.stringify(contactForm) })
      setShowContactForm(false)
      setContactForm({ name: '', designation: '', phone: '', mobile: '', email: '', is_primary: false })
      await loadClientDetail(selectedClient)
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to save contact') }
  }

  const handleCommSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!selectedClient) return
    try {
      await request(`/clients/${selectedClient.id}/communications`, { method: 'POST', body: JSON.stringify(commForm) })
      setShowCommForm(false)
      setCommForm({ type: 'note', subject: '', body: '' })
      await loadClientDetail(selectedClient)
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to log communication') }
  }

  const handleDelete = async (client: ClientRecord) => {
    if (!window.confirm(`Delete client "${client.company_name}"?`)) return
    try {
      await request(`/clients/${client.id}`, { method: 'DELETE' })
      if (selectedClient?.id === client.id) setSelectedClient(null)
      await loadClients()
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to delete') }
  }

  const beginEdit = (client: ClientRecord) => {
    setEditingClient(client)
    setFormData({
      company_name: client.company_name, contact_person: client.contact_person ?? '',
      phone: client.phone ?? '', mobile: client.mobile ?? '', email: client.email ?? '',
      website: '', address: client.address ?? '', city: client.city ?? '',
      state: client.state ?? '', pincode: '', gst_no: client.gst_no ?? '',
      pan_no: '', category: client.category ?? '', notes: client.notes ?? '',
    })
    setShowForm(true)
  }

  const COMM_ICONS: Record<string, string> = { call: '#3b82f6', email: '#f59e0b', meeting: '#8b5cf6', note: '#6b7280' }

  const columns = [
    { key: 'company', label: 'Company' },
    { key: 'contact', label: 'Contact' },
    { key: 'mobile', label: 'Mobile' },
    { key: 'city', label: 'City' },
    { key: 'registrations', label: 'Projects' },
    { key: 'status', label: 'Status' },
    { key: 'actions', label: '', sortable: false },
  ]

  const rows: Array<Record<string, ReactNode>> = clients.map((c) => ({
    company: <strong>{c.company_name}</strong>,
    contact: c.contact_person ?? '-',
    mobile: c.mobile ? <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.84rem' }}><Phone size={13} /> {c.mobile}</span> : '-',
    city: c.city ?? '-',
    registrations: <span className="sync-pill">{c.registrations_count ?? 0}</span>,
    status: c.is_active ? <span className="sync-pill" style={{ background: '#d1fae5', color: '#0a5c3c' }}>Active</span> : <span className="sync-pill" style={{ background: '#fef2f2', color: '#ef4444' }}>Inactive</span>,
    actions: (
      <div className="row-actions">
        <button className="icon-button" onClick={() => void loadClientDetail(c)} type="button" title="View"><ChevronRight size={16} /></button>
      </div>
    ),
    _id: c.id,
  }))

  const handleRowClick = (row: Record<string, ReactNode>) => {
    const id = row._id as number
    const client = clients.find((c) => c.id === id)
    if (client) void loadClientDetail(client)
  }

  return (
    <div className="two-column" style={{ height: 'calc(100vh - 64px)' }}>
      {/* Left: Client list */}
      <section className="surface" style={{ overflow: 'auto' }}>
        <div className="surface-heading">
          <div>
            <p className="section-label">CRM</p>
            <h2>Clients</h2>
          </div>
          <Building2 size={20} />
        </div>

        <div className="user-toolbar">
          <div className="search-field" style={{ width: 180 }}>
            <input placeholder="Search clients..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
          <button className="ghost-button" onClick={() => { setEditingClient(null); setFormData(emptyClient); setShowForm(true) }} type="button"><Plus size={16} /> New</button>
          <span className="sync-pill">{clients.length}</span>
        </div>

        {error ? <div className="error-banner">{error}</div> : null}

        {loading ? <p style={{ padding: 24, textAlign: 'center', color: '#65737d' }}>Loading...</p> : (
          <DataTable columns={columns} rows={rows} pageSize={20} filename="clients" exportable={false} onRowClick={handleRowClick} />
        )}
      </section>

      {/* Right: Client detail */}
      <section className="surface" style={{ overflow: 'auto' }}>
        {!selectedClient ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#65737d' }}>
            <Building2 size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
            <p>Select a client to view details</p>
          </div>
        ) : (
          <div>
            <div className="surface-heading">
              <div>
                <p className="section-label">{selectedClient.uid ?? 'Client'}</p>
                <h2>{selectedClient.company_name}</h2>
              </div>
              <div className="row-actions">
                <button className="icon-button" onClick={() => beginEdit(selectedClient)} type="button" title="Edit"><Edit3 size={16} /></button>
                <button className="icon-button" onClick={() => void handleDelete(selectedClient)} type="button" title="Delete"><Trash2 size={16} /></button>
              </div>
            </div>

            {/* Info cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.84rem' }}><User size={14} /> {selectedClient.contact_person ?? 'No contact person'}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.84rem' }}><Phone size={14} /> {selectedClient.mobile ?? selectedClient.phone ?? '-'}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.84rem' }}><Mail size={14} /> {selectedClient.email ?? '-'}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.84rem' }}><MapPin size={14} /> {selectedClient.city ?? selectedClient.state ?? '-'}</div>
            </div>
            {selectedClient.gst_no ? <div className="sync-pill" style={{ marginBottom: 12 }}>GST: {selectedClient.gst_no}</div> : null}
            {selectedClient.address ? <p style={{ fontSize: '0.84rem', color: '#4a5b66', marginBottom: 16 }}>{selectedClient.address}</p> : null}

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 16, borderBottom: '1px solid #e8eef1', marginBottom: 16 }}>
              {[
                { key: 'contacts', icon: Users, label: `Contacts (${selectedClient.contacts?.length ?? 0})` },
                { key: 'communications', icon: MessageSquare, label: `Activity (${selectedClient.communications?.length ?? 0})` },
                { key: 'projects', icon: FileText, label: `Projects (${selectedClient.registrations?.length ?? 0})` },
              ].map((tab) => (
                <button key={tab.key} className="ghost-button" onClick={() => {}} type="button" style={{ borderBottom: '2px solid transparent', borderRadius: 0, paddingBottom: 8 }}>
                  <tab.icon size={14} /> {tab.label}
                </button>
              ))}
            </div>

            {/* Contacts */}
            <div style={{ marginBottom: 16 }}>
              <div className="user-toolbar" style={{ marginBottom: 8 }}>
                <strong style={{ fontSize: '0.85rem' }}>Contacts</strong>
                <button className="ghost-button" onClick={() => setShowContactForm(true)} type="button"><Plus size={14} /> Add</button>
              </div>
              {(selectedClient.contacts ?? []).length === 0 ? (
                <p style={{ color: '#65737d', fontSize: '0.82rem' }}>No contacts added.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {(selectedClient.contacts ?? []).map((ct) => (
                    <div key={ct.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: '1px solid #e8eef1', borderRadius: 8 }}>
                      <User size={14} />
                      <strong style={{ fontSize: '0.84rem', flex: 1 }}>{ct.name}</strong>
                      {ct.is_primary ? <span className="sync-pill" style={{ background: '#dbeafe', color: '#1e40af', fontSize: '0.68rem' }}>Primary</span> : null}
                      {ct.designation ? <span style={{ fontSize: '0.78rem', color: '#65737d' }}>{ct.designation}</span> : null}
                      {ct.mobile ? <span style={{ fontSize: '0.82rem' }}>{ct.mobile}</span> : null}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Communications */}
            <div>
              <div className="user-toolbar" style={{ marginBottom: 8 }}>
                <strong style={{ fontSize: '0.85rem' }}>Activity Log</strong>
                <button className="ghost-button" onClick={() => setShowCommForm(true)} type="button"><Plus size={14} /> Log</button>
              </div>
              {(selectedClient.communications ?? []).length === 0 ? (
                <p style={{ color: '#65737d', fontSize: '0.82rem' }}>No activity logged.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {(selectedClient.communications ?? []).map((cm) => (
                    <div key={cm.id} style={{ padding: '8px 10px', border: '1px solid #e8eef1', borderRadius: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <MessageSquare size={13} color={COMM_ICONS[cm.type] ?? '#6b7280'} />
                        <strong style={{ fontSize: '0.82rem', textTransform: 'capitalize' }}>{cm.type}</strong>
                        {cm.subject ? <span style={{ fontSize: '0.84rem' }}>— {cm.subject}</span> : null}
                        <span style={{ flex: 1 }} />
                        <span style={{ fontSize: '0.72rem', color: '#65737d' }}>{cm.communication_date ? new Date(cm.communication_date).toLocaleString() : ''}</span>
                      </div>
                      {cm.body ? <p style={{ fontSize: '0.8rem', color: '#4a5b66', margin: 0 }}>{cm.body}</p> : null}
                      {cm.user ? <small style={{ color: '#65737d' }}>by {cm.user.name}</small> : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Client form modal */}
      {showForm ? (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <form className="surface" style={{ width: 560, maxHeight: '85vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
            <div className="surface-heading">
              <h2>{editingClient ? 'Edit Client' : 'New Client'}</h2>
              <button className="icon-button" onClick={() => setShowForm(false)} type="button"><X size={18} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label>Company Name *<input value={formData.company_name} onChange={(e) => setFormData({ ...formData, company_name: e.target.value })} required /></label>
              <label>Contact Person<input value={formData.contact_person} onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })} /></label>
              <label>Mobile<input value={formData.mobile} onChange={(e) => setFormData({ ...formData, mobile: e.target.value })} /></label>
              <label>Phone<input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} /></label>
              <label>Email<input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} /></label>
              <label>Category<select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })}>
                <option value="">Select...</option>
                <option value="Government">Government</option>
                <option value="Private">Private</option>
                <option value="PSU">PSU</option>
                <option value="Contractor">Contractor</option>
                <option value="Individual">Individual</option>
              </select></label>
              <label>City<input value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} /></label>
              <label>State<input value={formData.state} onChange={(e) => setFormData({ ...formData, state: e.target.value })} /></label>
              <label>GST No<input value={formData.gst_no} onChange={(e) => setFormData({ ...formData, gst_no: e.target.value })} /></label>
              <label>PAN No<input value={formData.pan_no} onChange={(e) => setFormData({ ...formData, pan_no: e.target.value })} /></label>
            </div>
            <label style={{ marginTop: 8 }}>Address<textarea value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} rows={2} /></label>
            <label>Notes<textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={2} /></label>
            <div className="form-actions">
              <button className="ghost-button" onClick={() => setShowForm(false)} type="button">Cancel</button>
              <button type="submit">{editingClient ? 'Update' : 'Create'}</button>
            </div>
          </form>
        </div>
      ) : null}

      {/* Contact form modal */}
      {showContactForm ? (
        <div className="modal-overlay" onClick={() => setShowContactForm(false)}>
          <form className="surface" style={{ width: 440 }} onClick={(e) => e.stopPropagation()} onSubmit={handleContactSubmit}>
            <div className="surface-heading">
              <h2>Add Contact</h2>
              <button className="icon-button" onClick={() => setShowContactForm(false)} type="button"><X size={18} /></button>
            </div>
            <label>Name *<input value={contactForm.name} onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })} required /></label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label>Designation<input value={contactForm.designation} onChange={(e) => setContactForm({ ...contactForm, designation: e.target.value })} /></label>
              <label>Mobile<input value={contactForm.mobile} onChange={(e) => setContactForm({ ...contactForm, mobile: e.target.value })} /></label>
            </div>
            <label>Email<input type="email" value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} /></label>
            <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={contactForm.is_primary} onChange={(e) => setContactForm({ ...contactForm, is_primary: e.target.checked })} style={{ width: 'auto', minHeight: 'auto' }} />
              Primary Contact
            </label>
            <div className="form-actions">
              <button className="ghost-button" onClick={() => setShowContactForm(false)} type="button">Cancel</button>
              <button type="submit">Add Contact</button>
            </div>
          </form>
        </div>
      ) : null}

      {/* Communication form modal */}
      {showCommForm ? (
        <div className="modal-overlay" onClick={() => setShowCommForm(false)}>
          <form className="surface" style={{ width: 480 }} onClick={(e) => e.stopPropagation()} onSubmit={handleCommSubmit}>
            <div className="surface-heading">
              <h2>Log Activity</h2>
              <button className="icon-button" onClick={() => setShowCommForm(false)} type="button"><X size={18} /></button>
            </div>
            <label>Type<select value={commForm.type} onChange={(e) => setCommForm({ ...commForm, type: e.target.value })}>
              <option value="note">Note</option>
              <option value="call">Phone Call</option>
              <option value="email">Email</option>
              <option value="meeting">Meeting</option>
            </select></label>
            <label>Subject<input value={commForm.subject} onChange={(e) => setCommForm({ ...commForm, subject: e.target.value })} /></label>
            <label>Details<textarea value={commForm.body} onChange={(e) => setCommForm({ ...commForm, body: e.target.value })} rows={4} /></label>
            <div className="form-actions">
              <button className="ghost-button" onClick={() => setShowCommForm(false)} type="button">Cancel</button>
              <button type="submit">Log Activity</button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  )
}
