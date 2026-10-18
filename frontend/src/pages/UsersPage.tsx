import { useState, type FormEvent } from 'react'
import { UserPlus, UserCog, Trash2, X, Activity, Clock } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { DataTable } from '../components/DataTable'
import type { UserFormData, UserRecord } from '../lib/types'
import { api } from '../lib/api'

const emptyUserForm: UserFormData = {
  username: '', email: '', password: '', password_confirmation: '',
  firstname: '', lastname: '', phone: '', gender: '1', group_id: '1', is_active: '1',
}

export function UsersPage() {
  const { users: userRecords, roles, refresh, setStatus, error, clearError } = useAuth()
  const [form, setForm] = useState<UserFormData>(emptyUserForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [localError, setLocalError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [activityUser, setActivityUser] = useState<UserRecord | null>(null)
  const [activities, setActivities] = useState<Array<{ id: number; action: string; module: string | null; created_at: string | null; time_ago: string | null }>>([])
  const [activityLoading, setActivityLoading] = useState(false)

  const displayError = error || localError
  const beginCreate = () => {
    setEditingId(null); setForm({ ...emptyUserForm, group_id: roles[0]?.id ? String(roles[0].id) : '1', is_active: '1' })
    clearError(); setLocalError(''); setStatus('Creating user'); setShowForm(true)
  }

  const beginEdit = (record: UserRecord) => {
    setEditingId(record.id); setForm({
      username: record.username, email: record.email, password: '', password_confirmation: '',
      firstname: record.firstname, lastname: record.lastname ?? '', phone: record.phone ?? '',
      gender: String(record.gender ?? 1), group_id: String(record.group?.id ?? roles[0]?.id ?? 1), is_active: record.is_active ? '1' : '0',
    }); clearError(); setLocalError(''); setStatus('Editing user'); setShowForm(true)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setLocalError(''); setStatus(editingId ? 'Updating user' : 'Creating user')
    try {
      const payload = { ...form, gender: Number(form.gender), group_id: Number(form.group_id), is_active: form.is_active === '1' }
      if (editingId) { await api.updateUser(editingId, payload) } else { await api.createUser(payload) }
      setForm({ ...emptyUserForm, group_id: roles[0]?.id ? String(roles[0].id) : '1' }); setEditingId(null); setShowForm(false)
      await refresh(); setStatus(editingId ? 'User updated' : 'User created')
    } catch (e) { setLocalError(e instanceof Error ? e.message : 'Unable to save user'); setStatus('Needs attention') }
  }

  const handleDelete = async (record: UserRecord) => {
    if (!window.confirm(`Delete ${record.name || record.username}?`)) return
    setLocalError(''); setStatus('Removing user')
    try {
      await api.deleteUser(record.id)
      if (editingId === record.id) { setForm({ ...emptyUserForm, group_id: roles[0]?.id ? String(roles[0].id) : '1' }); setEditingId(null); setShowForm(false) }
      await refresh(); setStatus('User removed')
    } catch (e) { setLocalError(e instanceof Error ? e.message : 'Unable to delete user'); setStatus('Needs attention') }
  }

  const showActivity = async (record: UserRecord) => {
    setActivityUser(record)
    setActivityLoading(true)
    try {
      const response = await api.userActivity(record.id)
      setActivities((response.activities ?? []).filter((entry) => entry.action !== 'page_visit'))
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'Unable to load user activity')
    } finally {
      setActivityLoading(false)
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <p className="section-label">Administration</p>
          <h1>User Directory</h1>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={beginCreate} type="button"><UserPlus size={16} /> New User</button>
        </div>
      </div>

      <div className="table-card">
        <DataTable
          searchable={false}
          exportable={false}
          showHeader={false}
          columns={[
            { key: 'name', label: 'Name' }, { key: 'username', label: 'Username' }, { key: 'email', label: 'Email' },
            { key: 'group', label: 'Job Tracker Role' }, { key: 'is_active', label: 'Active' },
            { key: 'actions', label: '', sortable: false },
          ]}
          rows={userRecords.map((record) => ({
            name: <span className="uid-cell">{record.name}</span>,
            username: record.username, email: record.email,
            group: (
              <span className="badge" style={{ background: '#f1f5f9', color: '#0f172a', fontWeight: 600 }}>
                {record.group?.group_name ?? 'Staff'}
              </span>
            ),
            is_active: record.is_active !== false ? <span className="badge badge-success">Active</span> : <span className="badge badge-danger">Inactive</span>,
            actions: <div className="row-actions-inline">
              <button className="icon-btn" onClick={() => void showActivity(record)} type="button" title="View activity"><Activity size={15} /></button>
              <button className="icon-btn" onClick={() => beginEdit(record)} type="button" title="Edit"><UserCog size={15} /></button>
              <button className="icon-btn" onClick={() => void handleDelete(record)} type="button" title="Delete"><Trash2 size={15} /></button>
            </div>,
          }))}
        />
      </div>

      {activityUser && (
        <div className="modal-overlay" onClick={() => setActivityUser(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <button className="modal-close" onClick={() => setActivityUser(null)} type="button"><X size={20} /></button>
            <div style={{ marginBottom: 18 }}>
              <p className="section-label">User activity</p>
              <h2>{activityUser.name || activityUser.username}</h2>
            </div>
            {activityLoading ? <p className="empty-state">Loading activity...</p> : activities.length === 0 ? <p className="empty-state">No activity recorded.</p> : (
              <div className="session-stack" style={{ maxHeight: 420, overflowY: 'auto' }}>
                {activities.map((entry) => (
                  <div className="session-row" key={entry.id}>
                    <div>
                      <strong>{entry.action.replace(/_/g, ' ')}</strong>
                      <span>{entry.module || 'System'}</span>
                    </div>
                    <small><Clock size={12} /> {entry.time_ago || entry.created_at || ''}</small>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowForm(false)} type="button"><X size={20} /></button>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 20 }}>
                <p className="section-label">{editingId ? 'Update' : 'Create'}</p>
                <h2>{editingId ? 'Edit user' : 'New user'}</h2>
              </div>
              <div className="form-grid-2">
                <label className="form-field"><span>Username</span><input value={form.username} onChange={(e) => setForm((c) => ({ ...c, username: e.target.value }))} /></label>
                <label className="form-field"><span>Email</span><input type="email" value={form.email} onChange={(e) => setForm((c) => ({ ...c, email: e.target.value }))} /></label>
                <label className="form-field"><span>First name</span><input value={form.firstname} onChange={(e) => setForm((c) => ({ ...c, firstname: e.target.value }))} /></label>
                <label className="form-field"><span>Last name</span><input value={form.lastname} onChange={(e) => setForm((c) => ({ ...c, lastname: e.target.value }))} /></label>
                <label className="form-field"><span>Phone</span><input value={form.phone} onChange={(e) => setForm((c) => ({ ...c, phone: e.target.value }))} /></label>
                <label className="form-field"><span>Gender</span>
                  <select value={form.gender} onChange={(e) => setForm((c) => ({ ...c, gender: e.target.value }))}><option value="1">Male</option><option value="2">Female</option></select>
                </label>
              </div>
              <label className="form-field" style={{ marginTop: 12 }}>
                <span>Job Tracker System Role</span>
                <select value={form.group_id} onChange={(e) => setForm((c) => ({ ...c, group_id: e.target.value }))}>
                  {roles.length === 0 && <option value="1">Administrator</option>}
                  {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
                </select>
                <span style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 4, display: 'block' }}>
                  Determines allowed workflow stages, sidebar modules, and dashboard queues based on the Excel Tracker.
                </span>
              </label>
              <label className="checkbox-label" style={{ marginTop: 12 }}>
                <input type="checkbox" checked={form.is_active === '1'} onChange={(e) => setForm((c) => ({ ...c, is_active: e.target.checked ? '1' : '0' }))} />
                Active
              </label>
              <div className="form-grid-2" style={{ marginTop: 12 }}>
                <label className="form-field"><span>Password</span>
                  <input type="password" value={form.password} onChange={(e) => setForm((c) => ({ ...c, password: e.target.value }))} placeholder={editingId ? 'Leave blank to keep' : 'Enter password'} />
                </label>
                <label className="form-field"><span>Confirm password</span>
                  <input type="password" value={form.password_confirmation} onChange={(e) => setForm((c) => ({ ...c, password_confirmation: e.target.value }))} />
                </label>
              </div>
              {displayError && <div className="error-banner" style={{ marginTop: 12 }}>{displayError}</div>}
              <div style={{ marginTop: 20, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn btn-outline" onClick={() => setShowForm(false)} type="button">Cancel</button>
                <button type="submit" className="btn btn-primary">{editingId ? 'Update User' : 'Create User'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
