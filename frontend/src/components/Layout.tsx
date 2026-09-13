import { FlaskConical, RefreshCcw, LogOut } from 'lucide-react'
import { useAuth } from '../lib/auth'

interface LayoutProps {
  children: React.ReactNode
}

export function Layout({ children }: LayoutProps) {
  const { user, status, logout, refresh } = useAuth()

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-mark">
          <FlaskConical size={24} />
          <span>NCRC</span>
        </div>

        <nav>
          {children && null}
        </nav>

        <div className="user-block">
          <strong>{user?.name}</strong>
          <span>{user?.is_admin ? 'Administrator' : 'Staff'}</span>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="section-label">NCRC</p>
            <h1>Dashboard</h1>
          </div>
          <div className="topbar-actions">
            <span className="sync-pill">{status}</span>
            <button className="icon-button" onClick={() => void refresh()} type="button" title="Refresh">
              <RefreshCcw size={18} />
            </button>
            <button className="icon-button" onClick={() => void logout()} type="button" title="Sign out">
              <LogOut size={18} />
            </button>
          </div>
        </header>

        {children}
      </section>
    </main>
  )
}
