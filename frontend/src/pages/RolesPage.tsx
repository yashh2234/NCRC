import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Check, Edit3, Plus, ShieldCheck, Trash2, X } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { request } from '../lib/api'
import type { RoleSummary } from '../lib/types'

interface PermissionGroup {
  module: string
  permissions: Array<{ id: number; name: string; description: string }>
}

function labelForModule(module: string) {
  return module.replace(/([a-z])([A-Z])/g, '$1 $2')
}

export function RolesPage() {
  const { roles, refresh, setStatus } = useAuth()
  const [groups, setGroups] = useState<PermissionGroup[]>([])
  const [selectedRole, setSelectedRole] = useState<RoleSummary | null>(null)
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([])
  const [name, setName] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    void request<PermissionGroup[]>('/permissions')
      .then(setGroups)
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load sections'))
      .finally(() => setLoading(false))
  }, [])

  const selectRole = async (role: RoleSummary) => {
    setSelectedRole(role)
    setError('')
    try {
      const data = await request<{ permissions: Array<{ name: string; assigned: boolean }> }>(`/permissions/roles/${role.id}`)
      setSelectedPermissions(data.permissions.filter((permission) => permission.assigned).map((permission) => permission.name))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load group access')
    }
  }

  const togglePermission = (nameToToggle: string) => {
    setSelectedPermissions((current) => current.includes(nameToToggle)
      ? current.filter((name) => name !== nameToToggle)
      : [...current, nameToToggle])
  }

  const toggleSection = (section: PermissionGroup) => {
    const names = section.permissions.map((permission) => permission.name)
    const allSelected = names.every((name) => selectedPermissions.includes(name))
    setSelectedPermissions((current) => allSelected
      ? current.filter((name) => !names.includes(name))
      : [...new Set([...current, ...names])])
  }

  const openCreate = () => {
    setSelectedRole(null)
    setSelectedPermissions([])
    setName('')
    setShowForm(true)
  }

  const openEdit = (role: RoleSummary) => {
    setName(role.name)
    setSelectedRole(role)
    setShowForm(true)
  }

  const saveRole = async (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setError('')
    try {
      if (selectedRole) {
        await request(`/roles/${selectedRole.id}`, { method: 'PUT', body: JSON.stringify({ group_name: name.trim(), permissions: selectedPermissions }) })
      } else {
        await request('/roles', { method: 'POST', body: JSON.stringify({ group_name: name.trim(), permissions: selectedPermissions }) })
      }
      setShowForm(false)
      await refresh()
      setStatus('Group saved')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save group')
    } finally {
      setSaving(false)
    }
  }

  const saveAccess = async () => {
    if (!selectedRole) return
    setSaving(true)
    setError('')
    try {
      await request(`/permissions/roles/${selectedRole.id}/sync`, {
        method: 'POST',
        body: JSON.stringify({ permissions: selectedPermissions }),
      })
      await refresh()
      setStatus('Group access saved')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save group access')
    } finally {
      setSaving(false)
    }
  }

  const deleteRole = async (role: RoleSummary) => {
    if (role.id === 1 || !window.confirm(`Delete group "${role.name}"?`)) return
    try {
      await request(`/roles/${role.id}`, { method: 'DELETE' })
      if (selectedRole?.id === role.id) setSelectedRole(null)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete group')
    }
  }

  const selectedCountBySection = useMemo(() => new Map(
    groups.map((group) => [
      group.module,
      group.permissions.filter((permission) => selectedPermissions.includes(permission.name)).length,
    ]),
  ), [groups, selectedPermissions])

  return (
    <>
      <div className="page-header">
        <div>
          <p className="section-label">Administration</p>
          <h2>Groups & Permissions</h2>
          <p className="text-muted">Choose a group, then select the sections that group can open.</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate} type="button"><Plus size={16} /> New Group</button>
      </div>

      {error ? <div className="error-banner">{error}</div> : null}

      <div style={{ display: 'grid', gridTemplateColumns: '280px minmax(0, 1fr)', gap: 20, alignItems: 'start' }}>
        <section className="surface" style={{ padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <ShieldCheck size={18} style={{ color: 'var(--color-primary)' }} />
            <strong>Groups</strong>
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {roles.map((role) => (
              <div key={role.id} onClick={() => void selectRole(role)} style={{
                padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
                border: selectedRole?.id === role.id ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                background: selectedRole?.id === role.id ? 'var(--color-primary-tint)' : 'var(--color-surface)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <strong>{role.name}</strong>
                  <span className="text-muted">{role.users_count}</span>
                </div>
                <small className="text-muted">{role.permissions_count} section permissions</small>
                <div className="row-actions-inline" style={{ marginTop: 8 }}>
                  <button className="icon-btn" onClick={(event) => { event.stopPropagation(); openEdit(role) }} type="button" title="Rename group"><Edit3 size={14} /></button>
                  {role.id !== 1 ? <button className="icon-btn" onClick={(event) => { event.stopPropagation(); void deleteRole(role) }} type="button" title="Delete group"><Trash2 size={14} /></button> : null}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="surface" style={{ padding: 18 }}>
          {!selectedRole ? (
            <p className="empty-state">Select a group to assign which sections it can open.</p>
          ) : loading ? (
            <p className="empty-state">Loading sections...</p>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div>
                  <p className="section-label">Access for</p>
                  <h2>{selectedRole.name}</h2>
                </div>
                <button className="btn btn-primary" onClick={() => void saveAccess()} disabled={saving} type="button">
                  <Check size={15} /> {saving ? 'Saving...' : 'Save Access'}
                </button>
              </div>
              <div style={{ display: 'grid', gap: 10 }}>
                {groups.map((group) => {
                  const selected = selectedCountBySection.get(group.module) ?? 0
                  const complete = selected === group.permissions.length
                  return (
                    <div key={group.module} style={{ border: '1px solid var(--color-border)', borderRadius: 10, padding: 14 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700, cursor: 'pointer' }}>
                        <input type="checkbox" checked={complete} onChange={() => toggleSection(group)} />
                        {labelForModule(group.module)}
                        <span className="text-muted" style={{ marginLeft: 'auto', fontSize: '0.75rem' }}>{selected}/{group.permissions.length}</span>
                      </label>
                      <div style={{ overflowX: 'auto', marginTop: 10, paddingLeft: 28 }}>
                        <table className="data-table" style={{ minWidth: 520 }}>
                          <thead><tr><th>Permission</th><th>Create</th><th>Update</th><th>View</th><th>Delete</th></tr></thead>
                          <tbody>
                            {[...new Set(group.permissions.map((permission) => permission.name.replace(/^(view|create|update|delete|manage)_/, '')))].map((resource) => {
                              const permissionFor = (action: string) => group.permissions.find((permission) => permission.name === `${action}${resource.charAt(0).toUpperCase()}${resource.slice(1)}` || permission.name === `${action}_${resource}`)
                              return (
                                <tr key={resource}>
                                  <td><strong>{resource.replace(/([a-z])([A-Z])/g, '$1 $2')}</strong></td>
                                  {['create', 'update', 'view', 'delete'].map((action) => {
                                    const permission = permissionFor(action)
                                    return <td key={action}>{permission ? <input type="checkbox" checked={selectedPermissions.includes(permission.name)} onChange={() => togglePermission(permission.name)} /> : <span className="text-muted">—</span>}</td>
                                  })}
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </section>
      </div>

      {showForm ? (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <form className="modal-content" onClick={(event) => event.stopPropagation()} onSubmit={saveRole}>
            <button className="modal-close" onClick={() => setShowForm(false)} type="button"><X size={20} /></button>
            <p className="section-label">{selectedRole ? 'Rename group' : 'New group'}</p>
            <h2 style={{ marginBottom: 18 }}>{selectedRole ? 'Group name' : 'Create a group'}</h2>
            <label className="form-field"><span>Group name</span><input value={name} onChange={(event) => setName(event.target.value)} autoFocus /></label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button className="btn btn-outline" onClick={() => setShowForm(false)} type="button">Cancel</button>
              <button className="btn btn-primary" disabled={saving || !name.trim()} type="submit">{saving ? 'Saving...' : 'Save Group'}</button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  )
}
