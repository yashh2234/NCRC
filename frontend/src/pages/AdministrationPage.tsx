import { UsersPage } from './UsersPage'
import { AiProvidersPanel } from '../components/AiProvidersPanel'
import { MailAccessPanel } from '../components/MailAccessPanel'
import { useAuth } from '../lib/auth'

/** Administration: users and their per-user feature access (groups are no longer used). */
export function AdministrationPage() {
  const { user } = useAuth()
  return (
    <div>
      <div className="page-header">
        <div>
          <p className="section-label">Administration</p>
          <p className="text-muted">Add users and choose exactly which features each person can open.</p>
        </div>
      </div>
      <MailAccessPanel />
      <MailAccessPanel module="documents_site" />
      {user?.is_admin ? <AiProvidersPanel /> : null}
      <UsersPage />
    </div>
  )
}
