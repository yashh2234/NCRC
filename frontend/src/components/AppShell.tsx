import { useCallback, useEffect, useRef, useState } from 'react'
import { Bell, Mail, FlaskConical, LogOut, LayoutDashboard, Users, ClipboardList, ReceiptText, BarChart3, ShieldCheck, IndianRupee, FileText, Settings, History, Check, Receipt, AlertTriangle, ClipboardCheck, Briefcase, Building2, ChevronDown, ChevronRight, Activity, PanelLeft, PhoneCall, FileSignature, FileMinus, FileClock, FolderOpen } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { api } from '../lib/api'
import { useTracking } from '../lib/useTracking'
import { getRoleConfig } from '../lib/roleConfig'
import { mailApi } from '../lib/mail'

const iconMap: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  lab: FlaskConical,
  users: Users,
  roles: ShieldCheck,
  clients: Building2,
  registrations: ClipboardList,
  billing: ReceiptText,
  performa: FileClock,
  credit_notes: FileMinus,
  reports: BarChart3,
  tenders: FileText,
  admin: Users,
  expenses: IndianRupee,
  purchase_orders: FileText,
  invoices: Receipt,
  due_reports: AlertTriangle,
  final_reports: ClipboardCheck,
  ulr_add: FileText,
  ulr_register: FileText,
  ulr_links: FileText,
  workflow_templates: Settings,
  jobs: Briefcase,
  permissions: ShieldCheck,
  documents: FileText,
  audit: History,
  user_tracking: Activity,
  settings: Settings,
  inquiries: PhoneCall,
  quotations: ReceiptText,
  proposals: FileSignature,
  work_orders: FileText,
  dispatches: FileText,
  outsource: FlaskConical,
  departments: Building2,
  vendors: Building2,
  tests: FlaskConical,
  test_categories: FileText,
  test_standards: FileText,
  test_methods: FlaskConical,
  designations: Users,
}

interface NavItem {
  key: string
  label: string
}

interface NavGroup {
  label: string
  icon: LucideIcon
  items: NavItem[]
}

interface AppShellProps {
  groups: NavGroup[]
  showInquiries: boolean
  showProposals: boolean
  showTenders: boolean
  /** Documents button left of Mail (documents.namotech.in) */
  showDocuments: boolean
  /** Shown as the Mail button in the top bar when the user has Mail access. */
  onOpenMail?: () => void
  /** A finished tender analysis, clicked in the notifications */
  onOpenAnalysis?: (id: number) => void
  activeModule: string
  onModuleChange: (key: string) => void
  children: React.ReactNode
}

interface NotificationItem {
  id: number
  type: string
  title: string
  message: string | null
  data: Record<string, unknown> | null
  read: boolean
  created_at: string | null
  time_ago: string | null
}

/** The Namotech document drive (its own logins) */
const DOCUMENTS_URL = 'https://documents.namotech.in'

const COMPACT_BREAKPOINT = 1024

function isCompactViewport() {
  return typeof window !== 'undefined' && window.innerWidth <= COMPACT_BREAKPOINT
}

const STANDALONE_TITLES: Record<string, string> = {
  dashboard: 'Dashboard',
  inquiries: 'Inquiries',
  proposals: 'Proposals',
  tenders: 'Tenders',
}

export function AppShell({ groups, showInquiries, showProposals, showTenders, showDocuments, onOpenMail, onOpenAnalysis, activeModule, onModuleChange, children }: AppShellProps) {
  const { user, logout, error } = useAuth()
  useTracking()
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unread, setUnread] = useState(0)
  const [showNotifs, setShowNotifs] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState<boolean>(() => {
    if (isCompactViewport()) return false
    const saved = localStorage.getItem('sidebar_drawer_open')
    return saved !== null ? saved === 'true' : true
  })

  const toggleDrawer = () => {
    setDrawerOpen((prev) => {
      const next = !prev
      // Only remember the desktop preference; on small screens the drawer is an overlay
      if (!isCompactViewport()) localStorage.setItem('sidebar_drawer_open', String(next))
      return next
    })
  }

  const pageTitle = STANDALONE_TITLES[activeModule]
    ?? groups.flatMap((group) => group.items).find((item) => item.key === activeModule)?.label
    ?? 'Dashboard'

  const navigate = (key: string) => {
    onModuleChange(key)
    if (isCompactViewport()) setDrawerOpen(false)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isCompactViewport()) setDrawerOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('nav_expanded')
    return saved ? new Set(JSON.parse(saved)) : new Set(['Client Registration', 'Lab Reports', 'Invoice', 'Groups', 'Setting'])
  })
  const notifRef = useRef<HTMLDivElement>(null)

  const toggleGroup = (label: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      localStorage.setItem('nav_expanded', JSON.stringify([...next]))
      return next
    })
  }

  const loadNotifs = useCallback(async () => {
    try {
      const [nData, uData] = await Promise.all([api.notifications(), api.unreadCount()])
      setNotifications(nData.data)
      setUnread(uData.count)
    } catch { }
  }, [])

  useEffect(() => {
    void loadNotifs()
    // Poll so new notifications show up without reloading the page
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadNotifs()
    }, 60000)
    return () => window.clearInterval(timer)
  }, [loadNotifs])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifs(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Unread count for the Mail button. The server check also creates the new-mail bell notifications.
  const [mailUnread, setMailUnread] = useState<number | null>(null)
  const canMail = Boolean(onOpenMail)
  const loadMailUnread = useCallback(async (fresh = false) => {
    try {
      const res = await mailApi.unread(fresh)
      setMailUnread((previous) => {
        if (res.unread !== null && previous !== null && res.unread > previous) void loadNotifs()
        return res.unread
      })
    } catch { /* keep the last count */ }
  }, [loadNotifs])

  useEffect(() => {
    if (!canMail) return
    let last = Date.now()
    void loadMailUnread(true)
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadMailUnread()
    }, 3 * 60 * 1000)
    // Back from the Mail tab: what was read there is no longer unread
    const back = () => {
      if (document.visibilityState !== 'visible' || Date.now() - last < 20000) return
      last = Date.now()
      void loadMailUnread(true)
    }
    document.addEventListener('visibilitychange', back)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', back)
    }
  }, [canMail, loadMailUnread])

  const handleMarkRead = async (id: number) => {
    try {
      await api.markNotificationRead(id)
      await loadNotifs()
    } catch { }
  }

  /** Opening Mail is seeing the new mail: its notifications no longer count */
  const openMail = () => {
    onOpenMail?.()
    api.markAllNotificationsRead('new_mail').then(loadNotifs).catch(() => undefined)
  }

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead()
      await loadNotifs()
    } catch { }
  }

  return (
    <main className={`app-shell ${drawerOpen ? 'drawer-open' : 'drawer-closed'}`}>
      <div className="drawer-backdrop" onClick={() => setDrawerOpen(false)} aria-hidden="true" />

      <aside className="sidebar" aria-label="Main navigation">
        <div className="sidebar-brand">
          <img className="sidebar-brand__img" src={`${import.meta.env.BASE_URL}namotech-logo.png`} alt="Namotech Consultancy" />
          <button className="sidebar-drawer-toggle sidebar-collapse" onClick={toggleDrawer} type="button" title="Hide menu" aria-label="Hide menu">
            <PanelLeft size={18} />
          </button>
        </div>

        <nav>
          {/* Dashboard is always at top, outside groups */}
          <button
            className={activeModule === 'dashboard' ? 'active' : ''}
            onClick={() => navigate('dashboard')}
            type="button"
          >
            <LayoutDashboard size={17} />
            Dashboard
          </button>
          {showInquiries ? (
            <button
              className={activeModule === 'inquiries' ? 'active' : ''}
              onClick={() => navigate('inquiries')}
              type="button"
            >
              <PhoneCall size={17} />
              Inquiries
            </button>
          ) : null}
          {showProposals ? (
            <button
              className={activeModule === 'proposals' ? 'active' : ''}
              onClick={() => navigate('proposals')}
              type="button"
            >
              <FileSignature size={17} />
              Proposals
            </button>
          ) : null}
          {showTenders ? (
            <button
              className={activeModule === 'tenders' ? 'active' : ''}
              onClick={() => navigate('tenders')}
              type="button"
            >
              <FileText size={17} />
              Tenders
            </button>
          ) : null}

          {groups.map((group) => {
            const isExpanded = expandedGroups.has(group.label)
            const GroupIcon = group.icon

            // Single-item groups render as a direct nav button (no dropdown)
            if (group.items.length === 1) {
              const item = group.items[0]
              const Icon = iconMap[item.key] || LayoutDashboard
              return (
                <button
                  key={group.label}
                  className={activeModule === item.key ? 'active' : ''}
                  onClick={() => navigate(item.key)}
                  type="button"
                >
                  <Icon size={17} />
                  {group.label}
                </button>
              )
            }

            return (
              <div key={group.label} className="nav-group">
                <button
                  className="nav-group-header"
                  onClick={() => toggleGroup(group.label)}
                  type="button"
                >
                  <GroupIcon size={15} />
                  <span>{group.label}</span>
                  {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                </button>
                {isExpanded ? group.items.map((item) => {
                  const Icon = iconMap[item.key] || LayoutDashboard
                  return (
                    <button
                      className={activeModule === item.key ? 'active nav-child' : 'nav-child'}
                      key={item.key}
                      onClick={() => navigate(item.key)}
                      type="button"
                    >
                      <Icon size={15} />
                      {item.label}
                    </button>
                  )
                }) : null}
              </div>
            )
          })}
        </nav>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="topbar__title">
            {!drawerOpen ? (
              <button
                className="sidebar-drawer-toggle"
                onClick={toggleDrawer}
                type="button"
                title="Show menu"
                aria-label="Show menu"
                aria-expanded={false}
              >
                <PanelLeft size={18} />
              </button>
            ) : null}
            <h1>{pageTitle}</h1>
          </div>
          <div className="topbar-actions">
            {/*
            <div ref={searchRef} style={{ position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ position: 'relative', width: 260 }}>
                  <Search size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-300)' }} />
                  <input
                    type="text"
                    placeholder="Search UID, tests, clients..."
                    value={searchQuery}
                    onChange={(e) => handleSearchInput(e.target.value)}
                    style={{
                      width: '100%', paddingLeft: 40, paddingRight: 14,
                      minHeight: 38, borderRadius: 999,
                      border: '1px solid var(--color-border)',
                      background: 'var(--gray-50)',
                      fontSize: '0.84rem', outline: 'none',
                      transition: 'border-color 0.15s, box-shadow 0.15s',
                    }}
                    onFocus={(e) => { e.target.style.borderColor = 'var(--color-primary)'; e.target.style.boxShadow = '0 0 0 3px var(--color-primary-ring)' }}
                    onBlur={(e) => { e.target.style.borderColor = 'var(--color-border)'; e.target.style.boxShadow = 'none' }}
                  />
                </div>
                <button className="icon-button" onClick={() => setShowFilters(!showFilters)} type="button" title="Filters"
                  style={{ background: showFilters ? 'var(--color-primary-tint)' : undefined, color: showFilters ? 'var(--color-primary)' : undefined }}>
                  <Filter size={16} />
                </button>
              </div>

              {showFilters ? (
                <div style={{ display: 'flex', gap: 8, padding: '10px 0', flexWrap: 'wrap', alignItems: 'center' }}>
                  <input value={filterStage} onChange={e => setFilterStage(e.target.value)} placeholder="Stage" style={{ width: 110, fontSize: '0.78rem', padding: '6px 10px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)' }} />
                  <div style={{ width: 150 }}><DepartmentSelector value={filterDept} onChange={setFilterDept} placeholder="Dept" /></div>
                  <DateRangeFilter start={filterDateFrom} end={filterDateTo} onApply={(start, end) => { setFilterDateFrom(start); setFilterDateTo(end) }} />
                  <button className="icon-button" onClick={() => { setFilterStage(''); setFilterDept(null); setFilterDateFrom(''); setFilterDateTo('') }} type="button" title="Clear filters"><X size={14} /></button>
                </div>
              ) : null}

              Search results dropdown
              {showResults ? (
                <div style={{
                  position: 'absolute', top: '100%', right: 0, marginTop: 8,
                  width: 420, maxHeight: 400, overflowY: 'auto',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-lg)',
                  boxShadow: 'var(--shadow-lg)',
                  zIndex: 100,
                }}>
                  {searching ? <p style={{ padding: 20, color: 'var(--gray-400)', textAlign: 'center', fontSize: '0.85rem' }}>Searching...</p>
                    : searchResults.length === 0 ? <p style={{ padding: 20, color: 'var(--gray-400)', textAlign: 'center', fontSize: '0.85rem' }}>No results found.</p>
                      : searchResults.map((r) => (
                        <div key={`${r.type}-${r.id}`}
                          style={{
                            padding: '12px 16px',
                            borderBottom: '1px solid var(--color-border-light)',
                            cursor: 'pointer',
                            transition: 'background 0.15s',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--gray-50)')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                          onClick={() => { setShowResults(false); setSearchQuery('') }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <strong style={{ fontSize: '0.88rem', color: 'var(--gray-900)' }}>{r.uid_no}</strong>
                            <span style={{ fontSize: '0.7rem', color: 'var(--color-primary)', background: 'var(--color-primary-tint)', padding: '2px 10px', borderRadius: 999, fontWeight: 600 }}>{r.type}</span>
                          </div>
                          <div style={{ fontSize: '0.82rem', color: 'var(--gray-600)', marginTop: 2 }}>{r.title}</div>
                          <div style={{ fontSize: '0.76rem', color: 'var(--gray-400)' }}>{r.subtitle} {r.mobile ? `| ${r.mobile}` : ''}</div>
                        </div>
                      ))}
                </div>
              ) : null}
            </div>

            */}
            {showDocuments ? (
              <a className="topbar-mail" href={DOCUMENTS_URL} target="_blank" rel="noopener noreferrer" title="Open Namotech Documents in a new tab" aria-label="Documents">
                <FolderOpen size={17} /> <span>Documents</span>
              </a>
            ) : null}
            {onOpenMail ? (
              <button className="topbar-mail" onClick={openMail} type="button" title="Check mails" aria-label="Check mails">
                <Mail size={17} /> <span>Mail</span>
                {mailUnread ? <span className="topbar-mail__badge" aria-label={`${mailUnread} unread`}>{mailUnread > 99 ? '99+' : mailUnread}</span> : null}
              </button>
            ) : null}
            {/* Notifications */}
            <div ref={notifRef} className="notif-wrap">
              <button className="icon-button" onClick={() => { void loadNotifs(); setShowNotifs((s) => !s) }} type="button" title="Notifications" aria-label="Notifications">
                <Bell size={18} />
                {unread > 0 ? <span className="notif-badge" aria-label={`${unread} unread`}>{unread > 99 ? '99+' : unread}</span> : null}
              </button>
              {showNotifs ? (
                <div className="notif-panel">
                  <div className="notif-panel__head">
                    <strong>Notifications</strong>
                    {unread > 0 ? <button className="btn btn-outline btn-xs" onClick={() => void handleMarkAllRead()} type="button"><Check size={13} /> Mark all read</button> : null}
                  </div>
                  {notifications.length === 0 ? (
                    <p className="notif-empty">You&apos;re all caught up</p>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`notif-item${n.read ? '' : ' unread'}`}
                        onClick={() => { if (!n.read) void handleMarkRead(n.id); if (n.type === 'new_mail' && onOpenMail) { setShowNotifs(false); openMail() } if (n.type === 'tender_analysis' && onOpenAnalysis && Number(n.data?.analysis_id)) { setShowNotifs(false); onOpenAnalysis(Number(n.data?.analysis_id)) } if (n.type === 'quotation_approval') { setShowNotifs(false); navigate('quotations') } }}
                      >
                        <div className="notif-item__row">
                          <strong>{n.title}</strong>
                          <span>{n.time_ago}</span>
                        </div>
                        {n.message ? <p>{n.message}</p> : null}
                      </div>
                    ))
                  )}
                </div>
              ) : null}
            </div>

            {/* Actions */}
            <button
              className="topbar-user"
              onClick={() => void logout()}
              type="button"
              title={`${getRoleConfig(user?.tracker_role ?? 'staff').label} · Log out`}
              aria-label={`Log out ${user?.name ?? ''}`}
            >
              <span className="topbar-user__name">{user?.name || 'User'}</span>
              <LogOut size={16} />
            </button>
          </div>
        </header>

        <div className="workspace-body">
          {error ? <div className="error-banner">{error}</div> : null}

          {children}
        </div>
      </section>
    </main>
  )
}
