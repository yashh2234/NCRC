import { useState, type FormEvent } from 'react'
import { Plus, Trash2, Edit3, X } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { request } from '../lib/api'
import type { RoleSummary } from '../lib/types'

const AVAILABLE_PERMISSIONS = [
  'createUser', 'updateUser', 'viewUser', 'deleteUser',
  'createGroup', 'updateGroup', 'viewGroup', 'deleteGroup',
  'createBilling', 'updateBilling', 'viewBilling', 'deleteBilling',
  'createRegistration', 'updateRegistration', 'viewRegistration', 'deleteRegistration',
  'createOrder', 'updateOrder', 'viewOrder', 'deleteOrder',
  'viewReports', 'updateCompany', 'viewProfile', 'updateSetting',
]

export function RolesPage() {
  const { roles, refresh, setStatus } = useAuth()
  const [editingRole, setEditingRole] = useState<RoleSummary | null>(null)
  const [name, setName] = useState('')
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([])
  const [localError, setLocalError] = useState('')
  const [showForm, setShowForm] = useState(false)

  const beginCreate = () => { setEditingRole(null); setName(''); setSelectedPermissions([]); setLocalError(''); setShowForm(true); setStatus('Creating role') }
  const beginEdit = (role: RoleSummary) => { setEditingRole(role); setName(role.name); setSelectedPermissions([...role.permissions]); setLocalError(''); setShowForm(true); setStatus('Editing role') }
  const togglePermission = (perm: string) => { setSelectedPermissions((prev) => prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]) }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setLocalError(''); setStatus(editingRole ? 'Updating role' : 'Creating role')
    try {
      const payload = { group_name: name, permissions: selectedPermissions }
      if (editingRole) { await request(`/roles/${editingRole.id}`, { method: 'PUT', body: JSON.stringify(payload) }) }
      else { await request('/roles', { method: 'POST', body: JSON.stringify(payload) }) }
      setShowForm(false); setEditingRole(null); await refresh(); setStatus(editingRole ? 'Role updated' : 'Role created')
    } catch (err) { setLocalError(err instanceof Error ? err.message : 'Unable to save role'); setStatus('Needs attention') }
  }

  const handleDelete = async (role: RoleSummary) => {
    if (role.id === 1) { setLocalError('Cannot delete the Administrator role.'); return }
    if (!window.confirm(`Delete role "${role.name}"?`)) return
    setLocalError(''); setStatus('Deleting role')
    try { await request(`/roles/${role.id}`, { method: 'DELETE' }); await refresh(); setStatus('Role deleted') }
    catch (err) { setLocalError(err instanceof Error ? err.message : 'Unable to delete role'); setStatus('Needs attention') }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <p className="section-label">Access Control</p>
          <h1>Roles & Permissions</h1>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={beginCreate} type="button"><Plus size={16} /> New Role</button>
        </div>
      </div>

      {localError && <div className="error-banner">{localError}</div>}

      <div className="role-grid">
        {roles.map((role) => (
          <article className="role-card" key={role.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: '1rem' }}>{role.name}</strong>
              <div className="row-actions-inline">
                <button className="icon-btn" onClick={() => beginEdit(role)} type="button" title="Edit"><Edit3 size={15} /></button>
                {role.id !== 1 && <button className="icon-btn" onClick={() => void handleDelete(role)} type="button" title="Delete"><Trash2 size={15} /></button>}
              </div>
            </div>
            <span className="text-muted">{role.users_count} users</span>
            <small className="text-subtle">{role.permissions_count} permissions</small>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
              {role.permissions.slice(0, 6).map((perm) => (
                <span key={perm} className="sync-pill" style={{ fontSize: '0.7rem', minHeight: 24, padding: '0 8px' }}>{perm}</span>
              ))}
              {role.permissions.length > 6 && <span className="sync-pill" style={{ fontSize: '0.7rem', minHeight: 24, padding: '0 8px' }}>+{role.permissions.length - 6}</span>}
            </div>
          </article>
        ))}
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowForm(false)} type="button"><X size={20} /></button>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 20 }}>
                <p className="section-label">{editingRole ? 'Update' : 'Create'}</p>
                <h2>{editingRole ? 'Edit role' : 'New role'}</h2>
              </div>
              <label className="form-field"><span>Role name</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Lab Technician" /></label>
              <div style={{ marginTop: 16 }}>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.82rem', fontWeight: 700, marginBottom: 8 }}>Permissions</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
                  {AVAILABLE_PERMISSIONS.map((perm) => (
                    <label key={perm} style={{
                      display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem',
                      fontWeight: 500, cursor: 'pointer', padding: '6px 8px', borderRadius: 6,
                      border: '1px solid var(--color-border)', background: selectedPermissions.includes(perm) ? 'var(--color-primary-tint)' : 'var(--color-input-bg)',
                    }}>
                      <input type="checkbox" checked={selectedPermissions.includes(perm)} onChange={() => togglePermission(perm)} style={{ width: 'auto', minHeight: 'auto' }} />
                      {perm.replace(/([a-z])([A-Z])/g, '$1 $2')}
                    </label>
                  ))}
                </div>
              </div>
              <div style={{ marginTop: 20, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn btn-outline" onClick={() => setShowForm(false)} type="button">Cancel</button>
                <button type="submit" className="btn btn-primary">{editingRole ? 'Update Role' : 'Create Role'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
