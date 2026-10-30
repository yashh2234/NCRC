import { useState } from 'react'
import { ShieldCheck, Users } from 'lucide-react'
import { UsersPage } from './UsersPage'
import { RolesPage } from './RolesPage'

export function AdministrationPage() {
  const [tab, setTab] = useState<'users' | 'groups'>('users')

  return (
    <div>
      <div className="page-header">
        <div>
          <p className="section-label">Administration</p>
          <p className="text-muted">Manage users, groups, and Create / Update / View / Delete access together.</p>
        </div>
      </div>
      <div className="surface" style={{ padding: 8, marginBottom: 16, display: 'flex', gap: 8 }}>
        <button type="button" className={tab === 'users' ? 'btn btn-primary' : 'btn btn-outline'} onClick={() => setTab('users')}>
          <Users size={16} /> Manage Users
        </button>
        <button type="button" className={tab === 'groups' ? 'btn btn-primary' : 'btn btn-outline'} onClick={() => setTab('groups')}>
          <ShieldCheck size={16} /> Manage Groups
        </button>
      </div>
      {tab === 'users' ? <UsersPage /> : <RolesPage />}
    </div>
  )
}
