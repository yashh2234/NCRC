import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useTracking } from '../lib/useTracking'

interface OnlineUser {
  id: number
  name: string
  last_activity_at: string
}

interface UserActivitySummary {
  id: number
  name: string
  today_actions: number
}

interface ActivityEntry {
  id: number
  action: string
  module: string | null
  details: string | null
  ip_address: string | null
  created_at: string | null
  time_ago: string | null
}

interface UserInfo {
  id: number
  name: string
  username: string
  is_active: boolean
  is_admin: boolean
  last_activity_at: string | null
  online: boolean
}

export function UserTrackingPage() {
  useTracking('user-tracking')
  const [summary, setSummary] = useState<{
    online_users: OnlineUser[]
    online_count: number
    today_active_users: number
    today_activities: number
    user_activity_today: UserActivitySummary[]
    today_reports_generated: number
    today_samples_registered: number
  } | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [activities, setActivities] = useState<ActivityEntry[]>([])
  const [totalToday, setTotalToday] = useState(0)
  const [loading, setLoading] = useState(true)

  const loadSummary = useCallback(async () => {
    try {
      const data = await api.trackSummary()
      setSummary(data)
    } catch {} finally {
      setLoading(false)
    }
  }, [])

  const loadUserActivity = useCallback(async (userId: number) => {
    try {
      const data = await api.userActivity(userId)
      setUserInfo(data.user)
      setActivities((data.activities || []).filter((a: any) => a.action !== 'page_visit'))
      setTotalToday(data.total_today)
    } catch {}
  }, [])

  useEffect(() => { void loadSummary() }, [loadSummary])

  useEffect(() => {
    const interval = setInterval(() => void loadSummary(), 15000)
    return () => clearInterval(interval)
  }, [loadSummary])

  const handleSelectUser = (id: number) => {
    setSelectedUserId(id)
    void loadUserActivity(id)
  }

  const actionLabel = (action: string) => {
    const labels: Record<string, string> = {
      page_visit: 'Page Visit',
      report_generated: 'Report Generated',
      sample_registered: 'Sample Registered',
      report_assigned: 'Report Assigned',
      report_approved: 'Report Approved',
      testing_started: 'Testing Started',
      login: 'Login',
      logout: 'Logout',
    }
    return labels[action] ?? action.replace(/_/g, ' ')
  }

  return (
    <>
      <div className="two-column">
        <section className="surface">
          <div className="surface-heading">
            <div>
              <p className="section-label">Live</p>
              <h2>Online users ({summary?.online_count ?? 0})</h2>
            </div>
          </div>
          {loading ? <p className="empty-state">Loading...</p>
          : !summary?.online_users.length ? <p className="empty-state">No users currently online.</p>
          : (
            <div className="session-stack">
              {summary.online_users.map((u) => (
                <article key={u.id} className="session-row" onClick={() => handleSelectUser(u.id)} style={{ cursor: 'pointer' }}>
                  <div>
                    <strong>{u.name}</strong>
                    <span>Active {u.last_activity_at}</span>
                  </div>
                  <span className="status-tag complete">Online</span>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="surface">
          <div className="surface-heading">
            <div>
              <p className="section-label">Today</p>
              <h2>Activity summary</h2>
            </div>
          </div>
          {loading ? <p className="empty-state">Loading...</p>
          : (
            <div className="summary-list">
              <span>{summary?.today_active_users ?? 0} active users</span>
              <span>{summary?.today_activities ?? 0} total actions</span>
              <span>{summary?.today_reports_generated ?? 0} reports generated</span>
              <span>{summary?.today_samples_registered ?? 0} samples registered</span>
            </div>
          )}
        </section>
      </div>

      <div className="two-column" style={{ marginTop: '1.25rem' }}>
        <section className="surface">
          <div className="surface-heading">
            <div>
              <p className="section-label">Productivity</p>
              <h2>User activity today</h2>
            </div>
          </div>
          {loading ? <p className="empty-state">Loading...</p>
          : !summary?.user_activity_today.length ? <p className="empty-state">No activity recorded today.</p>
          : (
            <div className="session-stack">
              {summary.user_activity_today.map((u) => (
                <article key={u.id} className="session-row" onClick={() => handleSelectUser(u.id)} style={{ cursor: 'pointer', background: selectedUserId === u.id ? '#edf6f4' : undefined }}>
                  <div>
                    <strong>{u.name}</strong>
                    <span>{u.today_actions} action{u.today_actions !== 1 ? 's' : ''} today</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="surface">
          <div className="surface-heading">
            <div>
              <p className="section-label">Details</p>
              <h2>{userInfo?.name ?? 'Select a user'}</h2>
            </div>
            {userInfo ? (
              <span className={`status-tag ${userInfo.online ? 'complete' : 'cancel'}`}>
                {userInfo.online ? 'Online' : 'Offline'}
              </span>
            ) : null}
          </div>
          {!selectedUserId ? <p className="empty-state">Click a user to see their activity.</p>
          : activities.length === 0 ? <p className="empty-state">No activity found for today.</p>
          : (
            <div className="session-stack" style={{ maxHeight: 400, overflowY: 'auto' }}>
              {activities.map((a) => (
                <article key={a.id} className="session-row">
                  <div>
                    <strong>{actionLabel(a.action)}</strong>
                    <span>{a.module ?? '-'}</span>
                    <small>{a.time_ago} &middot; {a.created_at}</small>
                  </div>
                </article>
              ))}
            </div>
          )}
          {userInfo ? (
            <div style={{ padding: '10px 16px', borderTop: '1px solid #e8eef1', fontSize: '0.8rem', color: '#65737d' }}>
              {totalToday} action{totalToday !== 1 ? 's' : ''} today &middot; Last seen: {userInfo.last_activity_at ?? 'Never'}
            </div>
          ) : null}
        </section>
      </div>
    </>
  )
}
