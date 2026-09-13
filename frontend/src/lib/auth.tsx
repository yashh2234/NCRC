import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { LoginSession, User } from './types'
import { api, getToken, setToken } from './api'
import type { BillingItem, DashboardResponse, Registration, RoleSummary, UserRecord } from './types'

interface AuthState {
  token: string | null
  user: User | null
  loading: boolean
  error: string
  status: string
  dashboard: DashboardResponse | null
  roles: RoleSummary[]
  users: UserRecord[]
  registrations: Registration[]
  billingDue: BillingItem[]
  sessions: LoginSession[]
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
  clearError: () => void
  setStatus: (status: string) => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(getToken())
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('Ready')
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null)
  const [roles, setRoles] = useState<RoleSummary[]>([])
  const [users, setUsers] = useState<UserRecord[]>([])
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [billingDue, setBillingDue] = useState<BillingItem[]>([])
  const [sessions, setSessions] = useState<LoginSession[]>([])

  const loadWorkspace = useCallback(async () => {
    if (!token) {
      setLoading(false)
      return
    }

    setStatus('Syncing')
    try {
      const results = await Promise.allSettled([
        api.me(),
        api.dashboardSummary(),
        api.roles(),
        api.users(),
        api.registrations(),
        api.billingDue(),
        api.sessions(),
      ])

      const [meRes, summaryRes, roleRes, userRes, registrationRes, billingRes, sessionRes] = results

      if (meRes.status === 'fulfilled') {
        setUser(meRes.value.user)
      } else {
        const err = String(meRes.reason ?? '')
        if (err.toLowerCase().includes('unauthenticated') || err.toLowerCase().includes('401')) {
          setToken(null)
          setTokenState(null)
          setUser(null)
          setLoading(false)
          return
        }
      }

      if (summaryRes.status === 'fulfilled') setDashboard(summaryRes.value)
      if (roleRes.status === 'fulfilled') setRoles(roleRes.value.data ?? [])
      if (userRes.status === 'fulfilled') setUsers(userRes.value.data ?? [])
      if (registrationRes.status === 'fulfilled') setRegistrations(registrationRes.value.data ?? [])
      if (billingRes.status === 'fulfilled') setBillingDue(billingRes.value.data ?? [])
      if (sessionRes.status === 'fulfilled') setSessions(sessionRes.value.data ?? [])

      setStatus('Synced')
      setError('')
    } catch (workspaceError) {
      const message = workspaceError instanceof Error ? workspaceError.message : 'Unable to load workspace'
      setError(message)
      setStatus('Workspace error')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void loadWorkspace()
  }, [loadWorkspace])

  const login = useCallback(async (email: string, password: string) => {
    setError('')
    setStatus('Signing in')
    try {
      const payload = await api.login(email, password)
      setToken(payload.token)
      setTokenState(payload.token)
      setUser(payload.user)
      setStatus('Signed in')
    } catch (loginError) {
      const message = loginError instanceof Error ? loginError.message : 'Unable to sign in'
      setError(message)
      setStatus('Ready')
      throw loginError
    }
  }, [])

  const logout = useCallback(async () => {
    if (token) {
      await api.logout().catch(() => null)
    }
    setToken(null)
    setTokenState(null)
    setUser(null)
    setDashboard(null)
    setUsers([])
    setRegistrations([])
    setBillingDue([])
    setSessions([])
    setStatus('Signed out')
    setError('')
  }, [token])

  const clearError = useCallback(() => setError(''), [])

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        loading,
        error,
        status,
        dashboard,
        roles,
        users,
        registrations,
        billingDue,
        sessions,
        login,
        logout,
        refresh: loadWorkspace,
        clearError,
        setStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
