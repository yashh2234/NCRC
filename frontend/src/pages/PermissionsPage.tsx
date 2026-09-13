import { useState, useEffect, type FormEvent } from 'react'
import { ShieldCheck, Check, X, Users, Loader, Sparkles } from 'lucide-react'
import { request } from '../lib/api'
import type { RoleSummary } from '../lib/types'

interface PermissionGroup {
  module: string
  permissions: Array<{ id: number; name: string; action: string; description: string }>
}

export function PermissionsPage() {
  const [groups, setGroups] = useState<PermissionGroup[]>([])
  const [roles, setRoles] = useState<RoleSummary[]>([])
  const [selectedRole, setSelectedRole] = useState<RoleSummary | null>(null)
  const [rolePerms, setRolePerms] = useState<Record<number, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showUserAssign, setShowUserAssign] = useState(false)
  const [users, setUsers] = useState<Array<{ id: number; name: string }>>([])
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)

  useEffect(() => { void loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [permsData, rolesData, usersData] = await Promise.all([
        request<PermissionGroup[]>('/permissions'),
        request<{ data: RoleSummary[] }>('/roles'),
        request<{ data: Array<{ id: number; name: string }> }>('/users'),
      ])
      setGroups(permsData)
      setRoles(rolesData.data)
      setUsers(usersData.data)
      if (rolesData.data.length > 0 && !selectedRole) {
        void loadRolePermissions(rolesData.data[0])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally { setLoading(false) }
  }

  const loadRolePermissions = async (role: RoleSummary) => {
    setSelectedRole(role)
    setError('')
    setSuccess('')
    try {
      const data = await request<{ role: RoleSummary; permissions: Array<{ id: number; name: string; assigned: boolean }> }>(`/permissions/roles/${role.id}`)
      const permMap: Record<number, boolean> = {}
      data.permissions.forEach((p) => { permMap[p.id] = p.assigned })
      setRolePerms(permMap)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load role permissions')
    }
  }

  const togglePermission = (permId: number) => {
    setRolePerms((prev) => ({ ...prev, [permId]: !prev[permId] }))
  }

  const selectAllInModule = (modulePerms: Array<{ id: number }>, value: boolean) => {
    const newPerms = { ...rolePerms }
    modulePerms.forEach((p) => { newPerms[p.id] = value })
    setRolePerms(newPerms)
  }

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    if (!selectedRole) return
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const permNames = groups.flatMap((g) =>
        g.permissions.filter((p) => rolePerms[p.id]).map((p) => p.name)
      )
      await request(`/permissions/roles/${selectedRole.id}/sync`, {
        method: 'POST',
        body: JSON.stringify({ permissions: permNames }),
      })
      setSuccess(`Permissions saved successfully for "${selectedRole.name}"`)
      // Refresh roles to update permissions count badge
      const rolesData = await request<{ data: RoleSummary[] }>('/roles')
      setRoles(rolesData.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save permissions')
    } finally { setSaving(false) }
  }

  const handleSeed = async () => {
    try {
      await request('/permissions/seed', { method: 'POST' })
      await loadData()
      setSuccess('Default permissions successfully seeded')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to seed')
    }
  }

  const handleUserAssign = async () => {
    if (!selectedUserId) return
    try {
      const permNames = groups.flatMap((g) =>
        g.permissions.filter((p) => rolePerms[p.id]).map((p) => p.name)
      )
      await request('/permissions/users/assign', {
        method: 'POST',
        body: JSON.stringify({ user_id: selectedUserId, permissions: permNames }),
      })
      setSuccess('Direct permissions assigned to user successfully')
      setShowUserAssign(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign')
    }
  }

  const assignedCount = Object.values(rolePerms).filter(Boolean).length

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '300px minmax(0, 1fr)', gap: 20, minHeight: 'calc(100vh - 120px)', alignItems: 'start' }}>
      {/* Left: Role list */}
      <section className="surface p-5 rounded-xl border border-default-200 bg-content1 shadow-sm" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p className="text-xs font-semibold text-primary uppercase tracking-wider">Access Control</p>
            <h2 className="text-lg font-bold text-default-900">System Roles</h2>
          </div>
          <ShieldCheck size={20} className="text-primary" />
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="ghost-button" onClick={() => void handleSeed()} type="button" style={{ minHeight: 34, fontSize: '0.78rem', padding: '0 12px' }}>
            <Sparkles size={14} /> Seed Defaults
          </button>
          <span className="sync-pill" style={{ fontSize: '0.72rem' }}>{roles.length} roles</span>
        </div>

        {error ? <div className="error-banner">{error}</div> : null}
        {success ? <div className="success-banner">{success}</div> : null}

        {loading ? (
          <p style={{ padding: 24, textAlign: 'center', color: '#6b7280', fontSize: '0.85rem' }}>Loading roles...</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', maxHeight: 'calc(100vh - 280px)' }}>
            {roles.map((role) => {
              const isSelected = selectedRole?.id === role.id
              return (
                <div
                  key={role.id}
                  onClick={() => void loadRolePermissions(role)}
                  style={{
                    padding: '14px 16px',
                    borderRadius: 10,
                    cursor: 'pointer',
                    background: isSelected ? 'var(--color-primary-tint, #ecfdf5)' : 'var(--color-surface, #ffffff)',
                    border: isSelected ? '2px solid var(--color-primary, #059669)' : '1px solid var(--color-border, #e5e7eb)',
                    transition: 'all 0.15s ease',
                    boxShadow: isSelected ? '0 2px 8px rgba(5, 150, 105, 0.12)' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <strong style={{ fontSize: '0.92rem', color: isSelected ? 'var(--color-primary, #059669)' : '#111827' }}>
                      {role.name}
                    </strong>
                    <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: 999, background: isSelected ? 'rgba(5, 150, 105, 0.15)' : 'rgba(0,0,0,0.05)', fontWeight: 600, color: isSelected ? '#065f46' : '#6b7280' }}>
                      {role.users_count} users
                    </span>
                  </div>
                  <small style={{ fontSize: '0.76rem', color: '#6b7280' }}>{role.permissions_count} permissions enabled</small>
                </div>
              )
            })}
          </div>
        )}

        <div style={{ marginTop: 'auto', paddingTop: 8 }}>
          <button className="ghost-button" onClick={() => { setShowUserAssign(true) }} type="button" style={{ width: '100%', minHeight: 38, fontSize: '0.82rem' }}>
            <Users size={15} /> Direct User Assignment
          </button>
        </div>
      </section>

      {/* Right: Permission matrix */}
      <section className="surface p-5 rounded-xl border border-default-200 bg-content1 shadow-sm">
        {!selectedRole ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#6b7280' }}>
            <ShieldCheck size={48} style={{ opacity: 0.3, margin: '0 auto 12px' }} />
            <p style={{ fontSize: '0.9rem' }}>Select a role from the left panel to edit its permissions.</p>
          </div>
        ) : (
          <form onSubmit={handleSave}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--color-border-light, #f3f4f6)' }}>
              <div>
                <p className="text-xs font-semibold text-primary uppercase tracking-wider">Role Permissions</p>
                <h2 className="text-xl font-extrabold text-default-900" style={{ margin: 0 }}>
                  {selectedRole.name} <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#6b7280' }}>({assignedCount} selected)</span>
                </h2>
              </div>
              <div>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    padding: '8px 22px', borderRadius: 999,
                    background: 'var(--color-primary, #059669)', color: '#ffffff',
                    border: 0, fontWeight: 700, fontSize: '0.85rem',
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    cursor: saving ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 8px rgba(5, 150, 105, 0.25)',
                  }}
                >
                  {saving ? <Loader size={14} className="animate-spin" /> : <Check size={14} />}
                  {saving ? 'Saving...' : 'Save Role Permissions'}
                </button>
              </div>
            </div>

            {groups.length === 0 ? (
              <p style={{ padding: 32, color: '#6b7280', textAlign: 'center', fontSize: '0.88rem' }}>
                No permissions defined in system. Click "Seed Defaults" on the left to populate permission set.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxHeight: 'calc(100vh - 280px)', overflowY: 'auto', paddingRight: 4 }}>
                {groups.map((group) => {
                  const groupAssigned = group.permissions.filter((p) => rolePerms[p.id]).length
                  const total = group.permissions.length
                  return (
                    <div key={group.module} style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden', background: '#ffffff' }}>
                      <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        background: '#f9fafb', padding: '10px 16px', borderBottom: '1px solid #f3f4f6',
                      }}>
                        <strong style={{ fontSize: '0.88rem', color: '#111827' }}>{group.module}</strong>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <button
                            type="button"
                            onClick={() => selectAllInModule(group.permissions, true)}
                            style={{
                              padding: '3px 10px', borderRadius: 6, border: '1px solid #d1d5db',
                              background: '#ffffff', fontSize: '0.72rem', fontWeight: 600, color: '#374151', cursor: 'pointer',
                            }}
                          >
                            Select All
                          </button>
                          <button
                            type="button"
                            onClick={() => selectAllInModule(group.permissions, false)}
                            style={{
                              padding: '3px 10px', borderRadius: 6, border: '1px solid #d1d5db',
                              background: '#ffffff', fontSize: '0.72rem', fontWeight: 600, color: '#6b7280', cursor: 'pointer',
                            }}
                          >
                            Clear
                          </button>
                          <span style={{
                            fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                            background: groupAssigned > 0 ? 'var(--color-primary-tint, #ecfdf5)' : '#f3f4f6',
                            color: groupAssigned > 0 ? 'var(--color-primary, #059669)' : '#9ca3af',
                          }}>
                            {groupAssigned}/{total}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8, padding: '12px 16px' }}>
                        {group.permissions.map((perm) => (
                          <label
                            key={perm.id}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                              padding: '6px 10px', borderRadius: 8, fontSize: '0.80rem',
                              background: rolePerms[perm.id] ? 'var(--color-primary-tint, #ecfdf5)' : '#f9fafb',
                              border: rolePerms[perm.id] ? '1px solid var(--color-primary, #059669)' : '1px solid #f3f4f6',
                              transition: 'all 0.15s ease',
                            }}
                            title={perm.description}
                          >
                            <input
                              type="checkbox"
                              checked={!!rolePerms[perm.id]}
                              onChange={() => togglePermission(perm.id)}
                              style={{ width: 16, height: 16, minHeight: 16, accentColor: 'var(--color-primary, #059669)', cursor: 'pointer' }}
                            />
                            <span style={{ fontWeight: rolePerms[perm.id] ? 600 : 400, color: rolePerms[perm.id] ? '#065f46' : '#374151', textTransform: 'capitalize' }}>
                              {perm.action ? perm.action.replace(/_/g, ' ') : perm.name}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--color-border-light, #f3f4f6)', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="submit"
                disabled={saving}
                style={{
                  padding: '10px 26px', borderRadius: 999,
                  background: 'var(--color-primary, #059669)', color: '#ffffff',
                  border: 0, fontWeight: 700, fontSize: '0.88rem',
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 8px rgba(5, 150, 105, 0.25)',
                }}
              >
                {saving ? <Loader size={14} className="animate-spin" /> : <Check size={14} />}
                {saving ? 'Saving Changes...' : 'Save Role Permissions'}
              </button>
            </div>
          </form>
        )}
      </section>

      {/* User assign modal */}
      {showUserAssign ? (
        <div className="modal-overlay" onClick={() => setShowUserAssign(false)}>
          <div className="surface p-6 rounded-xl border border-default-200 bg-content1 shadow-lg" style={{ width: 420 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 className="text-lg font-bold text-default-900">Assign Direct Permissions</h2>
              <button className="icon-button" onClick={() => setShowUserAssign(false)} type="button"><X size={18} /></button>
            </div>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.84rem', fontWeight: 600, color: '#374151' }}>
              Select User
              <select value={selectedUserId ?? ''} onChange={(e) => setSelectedUserId(e.target.value ? Number(e.target.value) : null)} style={{ width: '100%', minHeight: 40 }}>
                <option value="">Choose user...</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </label>
            <p style={{ fontSize: '0.78rem', color: '#6b7280', margin: '12px 0 20px' }}>
              This will assign the currently selected permission set directly to the chosen user as custom overrides.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="ghost-button" onClick={() => setShowUserAssign(false)} type="button">Cancel</button>
              <button
                onClick={() => void handleUserAssign()}
                type="button"
                disabled={!selectedUserId}
                style={{
                  padding: '8px 20px', borderRadius: 999, background: 'var(--color-primary, #059669)',
                  color: '#fff', border: 0, fontWeight: 600, fontSize: '0.84rem', cursor: selectedUserId ? 'pointer' : 'not-allowed',
                }}
              >
                Assign Permissions
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
