import { useState, type FormEvent } from 'react'
import { UserPlus, UserCog, Trash2 } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { DataTable } from '../components/DataTable'
import type { UserFormData, UserRecord } from '../lib/types'
import { api } from '../lib/api'
import { FEATURES, JOB_ROLES } from '../lib/roleConfig'
import { Req } from '../components/ui'
import { Modal } from '../components/Modal'
import { DateInput } from '../components/DateInput'
import { Select } from '../components/Select'
import { showSaved } from '../lib/toast'

const emptyUserForm: UserFormData = {
  username: '', email: '', password: '', password_confirmation: '',
  firstname: '', lastname: '', phone: '', gender: '1', is_active: '1',
  date_of_birth: '', is_admin: false, tracker_role: '', allowed_modules: [],
}

const FEATURE_GROUPS = [...new Set(FEATURES.map((f) => f.group))]

function jobRoleOf(record: UserRecord): UserFormData['tracker_role'] {
  // The role set in the form, else the one from their old group; never "admin" or "staff" (= no job role)
  const role = record.job_role || record.tracker_role
  return JOB_ROLES.find((r) => r.key === role)?.key ?? ''
}

function accessSummary(record: UserRecord): string {
  if (record.is_admin) return 'Full access'
  if (!Array.isArray(record.allowed_modules)) return 'Role defaults'
  const n = record.allowed_modules.filter((key) => FEATURES.some((f) => f.key === key)).length
  return `${n} feature${n === 1 ? '' : 's'}`
}

export function UsersPage() {
  const { users: userRecords, refresh, setStatus, error, clearError } = useAuth()
  const [form, setForm] = useState<UserFormData>(emptyUserForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const editingSuper = Boolean(userRecords.find((u) => u.id === editingId)?.is_super_admin)
  const [localError, setLocalError] = useState('')
  const [showForm, setShowForm] = useState(false)

  const displayError = error || localError
  const beginCreate = () => {
    setEditingId(null); setForm({ ...emptyUserForm })
    clearError(); setLocalError(''); setStatus('Creating user'); setShowForm(true)
  }

  const beginEdit = (record: UserRecord) => {
    const jobRole = jobRoleOf(record)
    setEditingId(record.id); setForm({
      username: record.username, email: record.email, password: '', password_confirmation: '',
      firstname: record.firstname, lastname: record.lastname ?? '', phone: record.phone ?? '',
      gender: String(record.gender ?? 1), is_active: record.is_active !== false ? '1' : '0',
      date_of_birth: record.date_of_birth ?? '',
      is_admin: Boolean(record.is_admin),
      tracker_role: jobRole,
      // Not configured yet → start from what the user can open today (their role's defaults)
      allowed_modules: Array.isArray(record.allowed_modules) ? record.allowed_modules.filter((key) => FEATURES.some((f) => f.key === key)) : [],
    }); clearError(); setLocalError(''); setStatus('Editing user'); setShowForm(true)
  }

  const toggleFeature = (key: string) => setForm((c) => ({
    ...c,
    allowed_modules: c.allowed_modules.includes(key) ? c.allowed_modules.filter((k) => k !== key) : [...c.allowed_modules, key],
  }))

  const setAllFeatures = (on: boolean) => setForm((c) => ({ ...c, allowed_modules: on ? FEATURES.map((f) => f.key) : [] }))

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setLocalError(''); setStatus(editingId ? 'Updating user' : 'Creating user')
    try {
      const payload = { ...form, gender: Number(form.gender), is_active: form.is_active === '1', tracker_role: editingSuper ? null : form.tracker_role || null }
      if (editingId) { await api.updateUser(editingId, payload) } else { await api.createUser(payload) }
      setForm({ ...emptyUserForm }); setEditingId(null); setShowForm(false)
      showSaved(editingId ? 'User updated' : 'User created')
      await refresh(); setStatus(editingId ? 'User updated' : 'User created')
    } catch (e) { setLocalError(e instanceof Error ? e.message : 'Unable to save user'); setStatus('Needs attention') }
  }

  const handleDelete = async (record: UserRecord) => {
    if (!window.confirm(`Delete ${record.name || record.username}?`)) return
    setLocalError(''); setStatus('Removing user')
    try {
      await api.deleteUser(record.id)
      if (editingId === record.id) { setForm({ ...emptyUserForm }); setEditingId(null); setShowForm(false) }
      await refresh(); setStatus('User removed')
    } catch (e) { setLocalError(e instanceof Error ? e.message : 'Unable to delete user'); setStatus('Needs attention') }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <p className="section-label">Administration</p>
          <h2>User Directory</h2>
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
            { key: 'group', label: 'Job Role' }, { key: 'access', label: 'Access' }, { key: 'is_active', label: 'Active' },
            { key: 'actions', label: '', sortable: false },
          ]}
          rows={userRecords.map((record) => ({
            name: <span className="uid-cell">{record.name}</span>,
            username: record.username, email: record.email,
            group: (
              <span className="badge" style={{ background: '#f1f5f9', color: '#0f172a', fontWeight: 600 }}>
                {JOB_ROLES.find((r) => r.key === jobRoleOf(record))?.label ?? '—'}
              </span>
            ),
            access: record.is_super_admin
              ? <span className="badge" style={{ background: '#fef3c7', color: '#92400e', fontWeight: 700 }}>Super admin</span>
              : record.is_admin
              ? <span className="badge" style={{ background: '#ede9fe', color: '#6d28d9', fontWeight: 700 }}>Full access</span>
              : <span style={{ fontSize: '0.8rem', color: '#475569' }}>{accessSummary(record)}</span>,
            is_active: record.is_active !== false ? <span className="badge badge-success">Active</span> : <span className="badge badge-danger">Inactive</span>,
            actions: <div className="row-actions-inline">
              <button className="icon-btn" onClick={() => beginEdit(record)} type="button" title="Edit"><UserCog size={15} /></button>
              {record.is_super_admin ? null : <button className="icon-btn" onClick={() => void handleDelete(record)} type="button" title="Delete"><Trash2 size={15} /></button>}
            </div>,
          }))}
        />
      </div>

      {showForm && (
        <Modal title={editingId ? 'Edit user' : 'New user'} subtitle={editingId ? 'Update' : 'Create'} onClose={() => setShowForm(false)} onSubmit={handleSubmit} saveLabel={editingId ? 'Update User' : 'Create User'}>
              <div className="form-grid-2">
                <label className="form-field"><span>Username<Req /></span><input value={form.username} onChange={(e) => setForm((c) => ({ ...c, username: e.target.value }))} /></label>
                <label className="form-field"><span>Email<Req /></span><input type="email" value={form.email} onChange={(e) => setForm((c) => ({ ...c, email: e.target.value }))} /></label>
                <label className="form-field"><span>First name<Req /></span><input value={form.firstname} onChange={(e) => setForm((c) => ({ ...c, firstname: e.target.value }))} /></label>
                <label className="form-field"><span>Last name</span><input value={form.lastname} onChange={(e) => setForm((c) => ({ ...c, lastname: e.target.value }))} /></label>
                <label className="form-field"><span>Phone</span><input value={form.phone} onChange={(e) => setForm((c) => ({ ...c, phone: e.target.value }))} /></label>
                <label className="form-field"><span>Gender<Req /></span>
                  <Select value={form.gender} onChange={(e) => setForm((c) => ({ ...c, gender: e.target.value }))}><option value="1">Male</option><option value="2">Female</option></Select>
                </label>
                <label className="form-field"><span>Date of birth</span><DateInput value={form.date_of_birth} onChange={(date_of_birth) => setForm((c) => ({ ...c, date_of_birth }))} /></label>
              </div>
              {editingSuper ? null : <label className="form-field" style={{ marginTop: 12 }}>
                <span>Job role</span>
                <Select value={form.tracker_role} onChange={(e) => setForm((c) => ({ ...c, tracker_role: e.target.value as UserFormData['tracker_role'] }))}>
                  <option value="">No job role</option>
                  {JOB_ROLES.map((role) => <option key={role.key} value={role.key}>{role.label}</option>)}
                </Select>
                <span style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 4, display: 'block' }}>
                  A label shown with their name. It does not change which pages they can open: tick those below.
                </span>
              </label>}

              <div style={{ marginTop: 16, border: '1px solid var(--color-border, #e2e8f0)', borderRadius: 10, padding: 14 }}>
                <label className="checkbox-label" style={{ fontWeight: 700 }}>
                  <input type="checkbox" checked={form.is_admin} disabled={editingSuper} title={editingSuper ? 'The super admin always has full access' : undefined} onChange={(e) => setForm((c) => ({ ...c, is_admin: e.target.checked }))} />
                  Full admin access (all features)
                </label>

                {form.is_admin ? (
                  <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '8px 0 0' }}>This user can open every feature.</p>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '12px 0 6px' }}>
                      <strong style={{ fontSize: '0.85rem' }}>Features this user can open ({form.allowed_modules.length}/{FEATURES.length})</strong>
                      <span style={{ display: 'flex', gap: 10 }}>
                        <button type="button" className="ghost-button" style={{ fontSize: '0.78rem' }} onClick={() => setAllFeatures(true)}>Select all</button>
                        <button type="button" className="ghost-button" style={{ fontSize: '0.78rem' }} onClick={() => setAllFeatures(false)}>Clear</button>
                      </span>
                    </div>
                    {FEATURE_GROUPS.map((group) => (
                      <div key={group} style={{ marginTop: 8 }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#94a3b8', marginBottom: 4 }}>{group}</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '4px 12px' }}>
                          {FEATURES.filter((f) => f.group === group).map((feature) => (
                            <label key={feature.key} className="checkbox-label" style={{ fontSize: '0.84rem' }}>
                              <input type="checkbox" checked={form.allowed_modules.includes(feature.key)} onChange={() => toggleFeature(feature.key)} />
                              {feature.label}
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                    <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '10px 0 0' }}>Dashboard, Help, Attendance, Leave and Holidays are always available. Mail, Documents and approvals are ticked in “Access and approvals” above the user list.</p>
                  </>
                )}
              </div>
              <label className="checkbox-label" style={{ marginTop: 12 }}>
                <input type="checkbox" checked={form.is_active === '1'} disabled={editingSuper} title={editingSuper ? 'The super admin is always active' : undefined} onChange={(e) => setForm((c) => ({ ...c, is_active: e.target.checked ? '1' : '0' }))} />
                Active
              </label>
              <div className="form-grid-2" style={{ marginTop: 12 }}>
                <label className="form-field"><span>Password{editingId ? null : <Req />}</span>
                  <input type="password" value={form.password} onChange={(e) => setForm((c) => ({ ...c, password: e.target.value }))} placeholder={editingId ? 'Leave blank to keep' : 'Enter password'} />
                </label>
                <label className="form-field"><span>Confirm password{editingId ? null : <Req />}</span>
                  <input type="password" value={form.password_confirmation} onChange={(e) => setForm((c) => ({ ...c, password_confirmation: e.target.value }))} />
                </label>
              </div>
              {displayError && <div className="error-banner" style={{ marginTop: 12 }}>{displayError}</div>}
        </Modal>
      )}
    </>
  )
}
