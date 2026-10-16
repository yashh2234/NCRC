import { useCallback, useEffect, useState } from 'react'
import { Pencil, Trash2, Download, Link2, Calendar, Search, CheckCircle2, AlertCircle, X, FileSpreadsheet } from 'lucide-react'
import { api } from '../lib/api'
import { useTracking } from '../lib/useTracking'

interface UlrLink {
  id: number
  uid_no: string
  ulr_no: string
  date: string
  name_of_department: string
  name_of_agency: string
  name_of_project: string
  sample_details: string
  qty?: string
  parameters?: string
  testing_period?: string
  sample_received_date?: string | null
  report_dispatch_date?: string | null
  bill_details?: string
  signature_remark?: string
}

interface DropdownItem {
  id?: number
  ulr_no: string
  uid_no?: string | null
  is_assigned: boolean
  label: string
}

export function UlrLinkPage() {
  useTracking('ulr_links')

  const [activeTab, setActiveTab] = useState<'link' | 'register'>('link')
  const [links, setLinks] = useState<UlrLink[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Date filters for register table
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // Quick link table form states (exact flow as Old software Ulrlink/index.php)
  const todayStr = new Date().toISOString().slice(0, 10)
  const [quickDate, setQuickDate] = useState(todayStr)
  const [quickUid, setQuickUid] = useState('')
  const [quickUlr, setQuickUlr] = useState('')
  const [newUlrInput, setNewUlrInput] = useState('')
  const [quickDept, setQuickDept] = useState('')
  const [quickAgency, setQuickAgency] = useState('')
  const [quickWork, setQuickWork] = useState('')
  const [quickSample, setQuickSample] = useState('')
  const [dropdownUlrList, setDropdownUlrList] = useState<DropdownItem[]>([])
  const [isLinking, setIsLinking] = useState(false)
  const [lookupStatus, setLookupStatus] = useState<string>('')

  // Full edit modal/view
  const [editingItem, setEditingItem] = useState<UlrLink | null>(null)
  const [editForm, setEditForm] = useState<Partial<UlrLink>>({})

  // Load ULR list for active date
  const loadDateDropdown = useCallback(async (date: string) => {
    try {
      const res = await api.ulrDropdown(date)
      setDropdownUlrList(res.data)
    } catch {
      // fallback
    }
  }, [])

  // Load register table
  const loadLinks = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params: Record<string, string> = {}
      if (startDate && endDate) {
        params.start_date = startDate
        params.end_date = endDate
      }
      const res = Object.keys(params).length > 0
        ? await api.ulrLinksFiltered(params)
        : await api.ulrLinks()
      setLinks(res.data as UlrLink[])
    } catch {
      setError('Failed to load ULR links')
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate])

  useEffect(() => {
    void loadDateDropdown(quickDate)
  }, [quickDate, loadDateDropdown])

  useEffect(() => {
    void loadLinks()
  }, [loadLinks])

  // Lookup UID automatically or on blur (like Old getuiddetails)
  const handleUidLookup = async (uidToLookup?: string) => {
    const uid = (uidToLookup ?? quickUid).trim()
    if (!uid) {
      setLookupStatus('')
      return
    }
    setLookupStatus('Searching...')
    try {
      const res = await api.ulrClientDetails(uid)
      if (res.data) {
        setQuickAgency(res.data.agency_name || '')
        setQuickDept(res.data.reporting_address || '')
        setQuickWork(res.data.name_of_work || '')
        setQuickSample(res.data.sample_details || '')
        setLookupStatus('Found!')
        setSuccessMsg(`Details loaded for ${uid}`)
        setTimeout(() => setSuccessMsg(''), 4000)
      } else {
        setLookupStatus('UID not found in registrations')
      }
    } catch {
      setLookupStatus('Lookup error')
    }
  }

  // Submit linking (Old formsubmit flow)
  const handleQuickLinkSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!quickUid.trim()) {
      setError('Please enter UID No.')
      return
    }
    if (!quickAgency.trim()) {
      setError('Please enter Agency Name')
      return
    }
    if (!quickUlr) {
      setError('Please select or create ULR No.')
      return
    }
    if (quickUlr === 'new' && !newUlrInput.trim()) {
      setError('Please enter the New ULR No.')
      return
    }

    setIsLinking(true)
    setError('')
    try {
      await api.createUlrLink({
        date: quickDate,
        uid_no: quickUid,
        ulr_no: quickUlr,
        new_ulr_no: quickUlr === 'new' ? newUlrInput : undefined,
        name_of_department: quickDept,
        name_of_agency: quickAgency,
        name_of_project: quickWork,
        sample_details: quickSample,
      })
      setSuccessMsg('ULR Linked and assigned successfully!')
      setQuickUid('')
      setQuickAgency('')
      setQuickDept('')
      setQuickWork('')
      setQuickSample('')
      setQuickUlr('')
      setNewUlrInput('')
      setLookupStatus('')
      void loadDateDropdown(quickDate)
      void loadLinks()
      setTimeout(() => setSuccessMsg(''), 5000)
    } catch {
      setError('Failed to link ULR. Please check inputs.')
    } finally {
      setIsLinking(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Do you really want to remove this ULR record?')) return
    try {
      await api.deleteUlrLink(id)
      setSuccessMsg('Record removed successfully')
      void loadLinks()
      void loadDateDropdown(quickDate)
      setTimeout(() => setSuccessMsg(''), 4000)
    } catch {
      setError('Failed to delete')
    }
  }

  const handleExport = async () => {
    try {
      const params: Record<string, string> = {}
      if (startDate && endDate) { params.start_date = startDate; params.end_date = endDate }
      const d = await api.ulrLinksExport(params)
      const rows = d.data
      const header = 'Date,ULR Number,UID Number,Name of Agency,Name of Work,Sample Details\n'
      const csv = header + rows.map(r => `"${r.date}","${r.ulr_no}","${r.uid_no}","${r.name_of_agency || ''}","${r.name_of_project || ''}","${r.sample_details || ''}"`).join('\n')
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ulr_register_${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setError('Failed to export CSV')
    }
  }

  const handleSaveEdit = async () => {
    if (!editingItem) return
    try {
      await api.updateUlrLink(editingItem.id, editForm)
      setEditingItem(null)
      setSuccessMsg('ULR details updated')
      void loadLinks()
      setTimeout(() => setSuccessMsg(''), 4000)
    } catch {
      setError('Failed to update ULR')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Link2 size={24} color="#2563eb" />
            Manage ULR
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '0.84rem', color: '#64748b' }}>
            Link ULR numbers to sample UID registrations & view historical ULR register
          </p>
        </div>

        {/* Tab switchers */}
        <div style={{ display: 'flex', gap: 8, background: '#f1f5f9', padding: 4, borderRadius: 8 }}>
          <button
            type="button"
            onClick={() => setActiveTab('link')}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: 'none',
              background: activeTab === 'link' ? '#ffffff' : 'transparent',
              color: activeTab === 'link' ? '#0f172a' : '#64748b',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              boxShadow: activeTab === 'link' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
            }}
          >
            + Link / Add ULR
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('register')}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: 'none',
              background: activeTab === 'register' ? '#ffffff' : 'transparent',
              color: activeTab === 'register' ? '#0f172a' : '#64748b',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              boxShadow: activeTab === 'register' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
            }}
          >
            ULR Register ({links.length})
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '10px 16px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
          <AlertCircle size={16} />
          {error}
          <button type="button" onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', cursor: 'pointer', color: '#b91c1c' }}><X size={14} /></button>
        </div>
      )}
      {successMsg && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', padding: '10px 16px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
          <CheckCircle2 size={16} />
          {successMsg}
        </div>
      )}

      {/* SECTION 1: INLINE ADD / LINK ULR TABLE (Old software flow) */}
      <section className="surface" style={{ padding: 20, borderRadius: 12, border: '1px solid #e2e8f0', background: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: '#1e293b' }}>
            Add / Link ULR No.
          </h3>
          <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
            Type UID number and press tab or Lookup to auto-fill details
          </span>
        </div>

        <form onSubmit={handleQuickLinkSubmit}>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', minWidth: 900 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={{ width: '12%', minWidth: 120 }}>Date</th>
                  <th style={{ width: '16%', minWidth: 150 }}>UID NO *</th>
                  <th style={{ width: '18%', minWidth: 170 }}>ULR NO *</th>
                  <th style={{ width: '14%' }}>Name of Dept</th>
                  <th style={{ width: '15%' }}>Name of Agency *</th>
                  <th style={{ width: '15%' }}>Name of Work</th>
                  <th style={{ width: '15%' }}>Sample Details</th>
                  <th style={{ width: '8%', textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  {/* Date */}
                  <td style={{ verticalAlign: 'top', padding: 8 }}>
                    <input
                      type="date"
                      value={quickDate}
                      onChange={e => {
                        setQuickDate(e.target.value)
                        void loadDateDropdown(e.target.value)
                      }}
                      style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                    />
                  </td>

                  {/* UID NO with Auto-Lookup */}
                  <td style={{ verticalAlign: 'top', padding: 8 }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <input
                        type="text"
                        placeholder="e.g. Namo/MC/2026/00001"
                        value={quickUid}
                        onChange={e => setQuickUid(e.target.value)}
                        onBlur={() => void handleUidLookup()}
                        style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                      />
                      <button
                        type="button"
                        onClick={() => void handleUidLookup()}
                        className="ghost-button"
                        style={{ padding: '6px 8px' }}
                        title="Lookup UID registration details"
                      >
                        <Search size={14} />
                      </button>
                    </div>
                    {lookupStatus && (
                      <span style={{ fontSize: '0.72rem', color: lookupStatus.includes('Found') ? '#16a34a' : '#d97706', display: 'block', marginTop: 3 }}>
                        {lookupStatus}
                      </span>
                    )}
                  </td>

                  {/* ULR Dropdown + New Create (Old software style) */}
                  <td style={{ verticalAlign: 'top', padding: 8 }}>
                    <select
                      value={quickUlr}
                      onChange={e => setQuickUlr(e.target.value)}
                      style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', background: '#fff' }}
                    >
                      <option value="">Select ULR No.</option>
                      {dropdownUlrList.map(item => (
                        <option key={item.ulr_no} value={item.ulr_no}>
                          {item.label}
                        </option>
                      ))}
                      <option value="new">+ New Create</option>
                    </select>

                    {quickUlr === 'new' && (
                      <input
                        type="text"
                        placeholder="Enter New ULR No. (Optional)"
                        value={newUlrInput}
                        onChange={e => setNewUlrInput(e.target.value)}
                        style={{ width: '100%', marginTop: 6, padding: '5px 8px', borderRadius: 6, border: '1px solid #93c5fd', fontSize: '0.8rem', background: '#eff6ff' }}
                      />
                    )}
                  </td>

                  {/* Department */}
                  <td style={{ verticalAlign: 'top', padding: 8 }}>
                    <input
                      type="text"
                      placeholder="Department"
                      value={quickDept}
                      onChange={e => setQuickDept(e.target.value)}
                      style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                    />
                  </td>

                  {/* Agency */}
                  <td style={{ verticalAlign: 'top', padding: 8 }}>
                    <input
                      type="text"
                      placeholder="Agency Name *"
                      value={quickAgency}
                      onChange={e => setQuickAgency(e.target.value)}
                      style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                    />
                  </td>

                  {/* Work Name */}
                  <td style={{ verticalAlign: 'top', padding: 8 }}>
                    <input
                      type="text"
                      placeholder="Name of Work"
                      value={quickWork}
                      onChange={e => setQuickWork(e.target.value)}
                      style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                    />
                  </td>

                  {/* Sample Details */}
                  <td style={{ verticalAlign: 'top', padding: 8 }}>
                    <input
                      type="text"
                      placeholder="Sample Details"
                      value={quickSample}
                      onChange={e => setQuickSample(e.target.value)}
                      style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                    />
                  </td>

                  {/* Link Action */}
                  <td style={{ verticalAlign: 'top', padding: 8, textAlign: 'center' }}>
                    <button
                      type="submit"
                      disabled={isLinking}
                      className="primary-button"
                      style={{ width: '100%', padding: '6px 12px', fontSize: '0.82rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                    >
                      <Link2 size={14} /> {isLinking ? 'Linking...' : 'Link'}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </form>
      </section>

      {/* SECTION 2: ULR REGISTER TABLE (Old software ulr_register.php) */}
      <section className="surface" style={{ padding: 20, borderRadius: 12, border: '1px solid #e2e8f0', background: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: '#1e293b' }}>
            Manage ULR Register
          </h3>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <Calendar size={14} color="#64748b" />
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                style={{ padding: '5px 8px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: '0.82rem' }}
              />
              <span style={{ color: '#64748b', fontSize: '0.82rem' }}>to</span>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                style={{ padding: '5px 8px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: '0.82rem' }}
              />
              <button className="primary-button" onClick={() => void loadLinks()} style={{ padding: '5px 12px', fontSize: '0.82rem' }}>
                GO
              </button>
              {(startDate || endDate) && (
                <button
                  className="ghost-button"
                  onClick={() => { setStartDate(''); setEndDate(''); void loadLinks() }}
                  style={{ padding: '5px 10px', fontSize: '0.82rem' }}
                >
                  Clear
                </button>
              )}
            </div>

            <button
              className="ghost-button"
              onClick={() => void handleExport()}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', padding: '6px 12px' }}
            >
              <Download size={14} /> Export CSV
            </button>
          </div>
        </div>

        {loading ? (
          <p className="empty-state">Loading ULR register...</p>
        ) : links.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 16px', color: '#64748b' }}>
            <FileSpreadsheet size={36} color="#cbd5e1" style={{ margin: '0 auto 10px', display: 'block' }} />
            <p style={{ fontWeight: 600, margin: '0 0 4px' }}>No ULR records found</p>
            <p style={{ fontSize: '0.82rem', margin: 0 }}>Use the form above to link a ULR number to a UID registration.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th>Date</th>
                  <th>ULR NO</th>
                  <th>UID NO</th>
                  <th>Name of Department</th>
                  <th>Name of Agency</th>
                  <th>Name of Work</th>
                  <th>Sample Details</th>
                  <th style={{ textAlign: 'center', width: 90 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {links.map(l => (
                  <tr key={l.id}>
                    <td style={{ fontSize: '0.82rem', whiteSpace: 'nowrap', color: '#334155' }}>{l.date}</td>
                    <td style={{ fontSize: '0.84rem', fontFamily: 'monospace', fontWeight: 700, color: '#0f766e' }}>
                      {l.ulr_no}
                    </td>
                    <td style={{ fontSize: '0.84rem', fontWeight: 600, color: '#2563eb' }}>
                      {l.uid_no}
                    </td>
                    <td style={{ fontSize: '0.82rem', color: '#475569' }}>{l.name_of_department || '-'}</td>
                    <td style={{ fontSize: '0.82rem', fontWeight: 500, color: '#1e293b' }}>{l.name_of_agency}</td>
                    <td style={{ fontSize: '0.82rem', color: '#475569' }}>{l.name_of_project || '-'}</td>
                    <td style={{ fontSize: '0.82rem', color: '#475569' }}>{l.sample_details || '-'}</td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button
                          className="icon-button"
                          onClick={() => { setEditingItem(l); setEditForm(l) }}
                          title="Edit details"
                          style={{ border: '1px solid #cbd5e1', borderRadius: 4, padding: '4px 6px' }}
                        >
                          <Pencil size={14} color="#2563eb" />
                        </button>
                        <button
                          className="icon-button"
                          onClick={() => void handleDelete(l.id)}
                          title="Delete record"
                          style={{ border: '1px solid #fee2e2', borderRadius: 4, padding: '4px 6px', background: '#fef2f2' }}
                        >
                          <Trash2 size={14} color="#ef4444" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Edit Modal */}
      {editingItem && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 16
        }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: '100%', maxWidth: 640, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>
                Edit ULR: {editingItem.ulr_no}
              </h3>
              <button type="button" onClick={() => setEditingItem(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            <div className="form-grid-2">
              <label className="form-field">
                <span>UID No</span>
                <input value={editForm.uid_no || ''} onChange={e => setEditForm(f => ({ ...f, uid_no: e.target.value }))} />
              </label>
              <label className="form-field">
                <span>Date</span>
                <input type="date" value={editForm.date || ''} onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))} />
              </label>
              <label className="form-field">
                <span>Department</span>
                <input value={editForm.name_of_department || ''} onChange={e => setEditForm(f => ({ ...f, name_of_department: e.target.value }))} />
              </label>
              <label className="form-field">
                <span>Agency Name</span>
                <input value={editForm.name_of_agency || ''} onChange={e => setEditForm(f => ({ ...f, name_of_agency: e.target.value }))} />
              </label>
              <label className="form-field">
                <span>Project / Work Name</span>
                <input value={editForm.name_of_project || ''} onChange={e => setEditForm(f => ({ ...f, name_of_project: e.target.value }))} />
              </label>
              <label className="form-field">
                <span>Sample Details</span>
                <input value={editForm.sample_details || ''} onChange={e => setEditForm(f => ({ ...f, sample_details: e.target.value }))} />
              </label>
            </div>

            <div style={{ marginTop: 20, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="ghost-button" onClick={() => setEditingItem(null)}>Cancel</button>
              <button className="primary-button" onClick={() => void handleSaveEdit()}>Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

