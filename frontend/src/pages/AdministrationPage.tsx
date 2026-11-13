import { UsersPage } from './UsersPage'

/** Administration: users and their per-user feature access (groups are no longer used). */
export function AdministrationPage() {
  return (
    <div>
      <div className="page-header">
        <div>
          <p className="section-label">Administration</p>
          <p className="text-muted">Add users and choose exactly which features each person can open.</p>
        </div>
      </div>
      <UsersPage />
    </div>
  )
}
