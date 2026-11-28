import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  ArrowLeft, Bell, BellRing, Briefcase, ChevronRight, ClipboardCheck, Download, FlaskConical, Home,
  Inbox, LayoutGrid, LogIn, LogOut, Mail, Monitor, PanelBottom, Share, SquarePlus, WifiOff, type LucideIcon,
} from 'lucide-react'
import { useAuth } from '../lib/auth'
import { api } from '../lib/api'
import { canUserAccess, getRoleConfig } from '../lib/roleConfig'
import { useUsageClock } from '../lib/useTracking'
import { duration, hrApi, type AttendanceStatus } from '../lib/hr'
import { PUNCH_EVENT } from '../components/PunchButton'
import { iconMap } from '../components/navIcons'
import { HomeDashboard } from '../components/HomeDashboard'
import { MailPage } from '../pages/MailPage'
import type { MyQueueItem } from '../lib/types'
import {
  clearDeepLink, enablePush, moduleForNotification, onServiceWorkerMessage, promptInstall, pushApi, readDeepLink, setAppBadge,
  useInstallState, useOnline, usePushState,
} from '../lib/pwa'
import { PunchSheet } from './PunchSheet'
import { findFilterBars, useCardTables } from './useCardTables'
import { FilterToggle } from './FilterSheet'
import { TabsSettingsScreen } from './BarTabs'
import { MAX_TABS, useBarTabs } from './mobileApi'
import { ApprovalsTab } from './ApprovalsTab'
import { approvalsApi } from './mobileApi'
import { NotificationsScreen, PushSettingsScreen, type NotificationItem } from './NotificationScreens'

interface NavItem { key: string; label: string }
interface NavGroup { label: string; icon: LucideIcon; items: NavItem[] }

/** 'home', 'more', a built-in tab (approvals, jobs, alerts) or a module key chosen for the bottom bar */
type Tab = string
const BUILTIN_TABS: Array<{ key: string; label: string; icon: LucideIcon }> = [
  { key: 'approvals', label: 'Approvals', icon: Inbox },
  { key: 'jobs', label: 'Jobs & Lab', icon: FlaskConical },
  { key: 'alerts', label: 'Notifications', icon: Bell },
]
const DEFAULT_TABS = ['approvals', 'jobs']
/** Screens of the phone app itself; everything else is a module page */
const SCREEN_TITLES: Record<string, string> = { m_notifications: 'Notifications', m_push: 'Phone alerts', m_tabs: 'Bottom bar', mail: 'Mail' }

interface Props {
  groups: NavGroup[]
  /** Enquiries, Proposals, Tenders: outside the groups on the computer too */
  extras: NavItem[]
  canMail: boolean
  activeModule: string
  /** 'dashboard' = back to the tabs */
  setActiveModule: (key: string) => void
  renderPage: (key: string) => ReactNode
  onOpenAnalysis?: (id: number) => void
  onUseDesktop: () => void
}

export function MobileApp({ groups, extras, canMail, activeModule, setActiveModule, renderPage, onOpenAnalysis, onUseDesktop }: Props) {
  const { user, logout } = useAuth()
  useUsageClock(activeModule === 'dashboard' ? 'mobile' : activeModule)
  const online = useOnline()
  const [tab, setTab] = useState<Tab>(() => readDeepLink().tab || 'home')
  const [punchOpen, setPunchOpen] = useState(() => readDeepLink().punch)
  const [approvalCount, setApprovalCount] = useState<number | null>(null)

  // ─── Notifications (bell) ───
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unread, setUnread] = useState(0)
  const loadNotifs = useCallback(async () => {
    try {
      const [n, u] = await Promise.all([api.notifications(), api.unreadCount()])
      setNotifications(n.data)
      setUnread(u.count)
      setAppBadge(u.count)
    } catch { /* keep the last list */ }
  }, [])

  const allModules = useMemo(() => [...extras, ...groups.flatMap((g) => g.items)], [extras, groups])

  // ─── Bottom bar: Home · the user's tabs · More ───
  const tabChoices = useMemo(() => [
    ...BUILTIN_TABS,
    ...(canMail ? [{ key: 'mail', label: 'Mail', icon: Mail as LucideIcon }] : []),
    ...allModules.map((m) => ({ key: m.key, label: m.label, icon: iconMap[m.key] ?? ClipboardCheck })),
  ], [allModules, canMail])
  const [barTabs, setBarTabs] = useBarTabs(user?.id ?? 0)
  const shownTabs = (barTabs ?? DEFAULT_TABS).map((k) => tabChoices.find((c) => c.key === k)).filter((c): c is (typeof tabChoices)[number] => Boolean(c)).slice(0, MAX_TABS)
  const titleOf = (key: string) => SCREEN_TITLES[key] ?? allModules.find((m) => m.key === key)?.label ?? (key.startsWith('report') ? 'Lab Reports' : key)

  /** Opens what a notification is about; returns false when there is no screen for it */
  const openForType = useCallback((type: string, data?: Record<string, unknown> | null) => {
    if (type === 'tender_analysis' && onOpenAnalysis && Number(data?.analysis_id)) {
      onOpenAnalysis(Number(data?.analysis_id))
      return true
    }
    const target = moduleForNotification(type, Boolean(user?.is_admin))
    if (!target || (target === 'mail' ? !canMail : !canUserAccess(user, target))) return false
    setActiveModule(target)
    return true
  }, [user, canMail, setActiveModule, onOpenAnalysis])

  const openFromUrl = useCallback(async (href: string) => {
    const link = readDeepLink(href)
    if (link.tab) { setActiveModule('dashboard'); setTab(link.tab) }
    if (link.punch) { setActiveModule('dashboard'); setTab('home'); setPunchOpen(true) }
    if (link.notificationId) {
      await api.markNotificationRead(link.notificationId).catch(() => undefined)
      if (!link.type || !openForType(link.type)) setActiveModule('m_notifications')
      void loadNotifs()
    }
  }, [openForType, setActiveModule, loadNotifs])

  // Opened from a notification or a home-screen shortcut
  const handledLink = useRef(false)
  useEffect(() => {
    if (handledLink.current) return
    handledLink.current = true
    const href = window.location.href
    clearDeepLink()
    void openFromUrl(href)
  }, [openFromUrl])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadNotifs()
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void loadNotifs() }, 60000)
    const back = () => { if (document.visibilityState === 'visible') void loadNotifs() }
    document.addEventListener('visibilitychange', back)
    const off = onServiceWorkerMessage((msg) => {
      if (msg.type === 'push-received') void loadNotifs()
      if (msg.type === 'open-url' && msg.url) void openFromUrl(msg.url)
    })
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', back); off() }
  }, [loadNotifs, openFromUrl])

  // Android back button / swipe: from a module back to the tabs, not out of the app
  useEffect(() => {
    if (activeModule === 'dashboard') return
    window.history.pushState({ mobileScreen: activeModule }, '')
    const onPop = () => setActiveModule('dashboard')
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [activeModule, setActiveModule])
  const goBack = () => {
    if (window.history.state?.mobileScreen) window.history.back()
    else setActiveModule('dashboard')
  }

  const tapNotification = (n: NotificationItem) => {
    if (!n.read) api.markNotificationRead(n.id).then(loadNotifs).catch(() => undefined)
    openForType(n.type, n.data)
  }

  const inModule = activeModule !== 'dashboard'
  const closePunch = useCallback(() => setPunchOpen(false), [])

  return (
    <div className="m-app">
      {!online ? <div className="m-offline" role="status"><WifiOff size={15} /> No internet. You can look around, but saving needs a connection.</div> : null}

      {inModule ? (
        <>
          <header className="m-topbar">
            <button type="button" className="m-icon-btn" onClick={goBack} aria-label="Back"><ArrowLeft size={21} /></button>
            <h1>{titleOf(activeModule)}</h1>
            {activeModule !== 'm_notifications' ? <BellButton unread={unread} onClick={() => setActiveModule('m_notifications')} /> : <span className="m-icon-btn" />}
          </header>
          <main className={`m-content${activeModule.startsWith('m_') ? '' : ' m-content--module'}`}>
            {activeModule === 'm_notifications' ? (
              <NotificationsScreen items={notifications} unread={unread} onTap={tapNotification} onSettings={() => setActiveModule('m_push')}
                onMarkAll={() => void api.markAllNotificationsRead().then(loadNotifs)} />
            ) : activeModule === 'm_push' ? (
              <PushSettingsScreen />
            ) : activeModule === 'm_tabs' ? (
              <TabsSettingsScreen choices={tabChoices} selected={shownTabs.map((t) => t.key)} onSave={setBarTabs} />
            ) : activeModule === 'mail' ? (
              <MailPage onBack={goBack} />
            ) : <ModulePage moduleKey={activeModule}>{renderPage(activeModule)}</ModulePage>}
          </main>
        </>
      ) : (
        <>
          {BUILTIN_TABS.some((b) => b.key === tab) || tab === 'home' || tab === 'more' ? (
            <header className="m-topbar m-topbar--brand">
              <span className="m-topbar__side" aria-hidden="true" />
              <img src={`${import.meta.env.BASE_URL}namotech-logo.png`} alt="Namotech" className="m-topbar__logo" />
              <BellButton unread={unread} onClick={() => setActiveModule('m_notifications')} />
            </header>
          ) : (
            <header className="m-topbar m-topbar--tab">
              <span className="m-topbar__side" aria-hidden="true" />
              <h1>{titleOf(tab)}</h1>
              <BellButton unread={unread} onClick={() => setActiveModule('m_notifications')} />
            </header>
          )}
          <main className={`m-content${tabChoices.some((c) => c.key === tab) && !BUILTIN_TABS.some((b) => b.key === tab) ? ' m-content--tabmodule' : ''}`}>
            {tab === 'alerts' ? (
              <NotificationsScreen items={notifications} unread={unread} onTap={tapNotification} onSettings={() => setActiveModule('m_push')}
                onMarkAll={() => void api.markAllNotificationsRead().then(loadNotifs)} />
            ) : tab === 'mail' && canMail ? (
              <MailPage onBack={() => setTab('home')} />
            ) : tab !== 'home' && tab !== 'more' && !BUILTIN_TABS.some((b) => b.key === tab) && allModules.some((m) => m.key === tab) ? (
              <ModulePage moduleKey={tab}>{renderPage(tab)}</ModulePage>
            ) : tab === 'home' || !['approvals', 'jobs', 'more'].includes(tab) ? (
              <HomeTab onCountApprovals={setApprovalCount} allModules={allModules} canMail={canMail}
                onOpen={setActiveModule} onTab={setTab} onPunch={() => setPunchOpen(true)} />
            ) : tab === 'approvals' ? (
              <ApprovalsTab onOpen={setActiveModule} onCount={setApprovalCount} />
            ) : tab === 'jobs' ? (
              <JobsTab onOpen={setActiveModule} />
            ) : (
              <MoreTab groups={groups} extras={extras} canMail={canMail} onOpen={setActiveModule} onUseDesktop={onUseDesktop}
                userName={user?.name ?? ''} roleLabel={user?.is_super_admin ? 'Super admin' : getRoleConfig(user?.tracker_role ?? 'staff').label} onLogout={() => void logout()} />
            )}
          </main>
          <nav className="m-tabbar keep-cols" aria-label="Main" style={{ gridTemplateColumns: `repeat(${shownTabs.length + 2}, 1fr)` }}>
            <TabButton icon={Home} label="Home" active={tab === 'home'} onClick={() => setTab('home')} />
            {shownTabs.map((t) => (
              <TabButton key={t.key} icon={t.icon} label={t.label} active={tab === t.key} onClick={() => setTab(t.key)}
                badge={t.key === 'approvals' ? approvalCount ?? 0 : t.key === 'alerts' ? unread : 0} />
            ))}
            <TabButton icon={LayoutGrid} label="More" active={tab === 'more'} onClick={() => setTab('more')} />
          </nav>
        </>
      )}

      {punchOpen ? <PunchLoader onClose={closePunch} /> : <DailyCheckIn />}
    </div>
  )
}

/** A computer page in the app: list tables shown as cards */
function ModulePage({ moduleKey, children }: { moduleKey: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useCardTables(ref, moduleKey)

  // Filter rows of the page: folded behind a Filters button, opened as a bottom sheet
  const [bars, setBars] = useState<HTMLElement[]>([])
  const [openBar, setOpenBar] = useState<HTMLElement | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let frame = 0
    const scan = () => {
      frame = 0
      const found = findFilterBars(el)
      setBars((old) => (old.length === found.length && old.every((b, i) => b === found[i]) ? old : found))
    }
    scan()
    const observer = new MutationObserver(() => { if (!frame) frame = requestAnimationFrame(scan) })
    observer.observe(el, { childList: true, subtree: true })
    return () => { observer.disconnect(); if (frame) cancelAnimationFrame(frame) }
  }, [moduleKey])

  return (
    <div ref={ref} className="m-module">
      {children}
      {bars.map((bar, i) => (
        <FilterToggle key={i} bar={bar} open={openBar === bar} onToggle={() => setOpenBar((o) => (o === bar ? null : bar))} />
      ))}
      {openBar ? <div className="m-filter-backdrop" onClick={() => setOpenBar(null)} aria-hidden="true" /> : null}
    </div>
  )
}

function BellButton({ unread, onClick }: { unread: number; onClick: () => void }) {
  return (
    <button type="button" className="m-icon-btn m-bell" onClick={onClick} aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}>
      <Bell size={21} />
      {unread > 0 ? <span className="m-badge">{unread > 99 ? '99+' : unread}</span> : null}
    </button>
  )
}

function TabButton({ icon: Icon, label, active, onClick, badge = 0 }: { icon: LucideIcon; label: string; active: boolean; onClick: () => void; badge?: number }) {
  return (
    <button type="button" className={active ? 'active' : ''} onClick={onClick} aria-current={active ? 'page' : undefined}>
      <span className="m-tabbar__icon"><Icon size={22} />{badge > 0 ? <span className="m-badge">{badge > 99 ? '99+' : badge}</span> : null}</span>
      <span>{label}</span>
    </button>
  )
}

// ─── Attendance ──────────────────────────────────────────────────────

function useAttendance() {
  const [status, setStatus] = useState<AttendanceStatus | null>(null)
  const [loadedAt, setLoadedAt] = useState(0)
  const [now, setNow] = useState(0)
  const load = useCallback(() => hrApi.status().then((s) => { setStatus(s); setLoadedAt(Date.now()); setNow(Date.now()) }).catch(() => undefined), [])
  useEffect(() => {
    void load()
    const tick = window.setInterval(() => setNow(Date.now()), 30000)
    const changed = () => void load()
    window.addEventListener(PUNCH_EVENT, changed)
    document.addEventListener('visibilitychange', changed)
    return () => { window.clearInterval(tick); window.removeEventListener(PUNCH_EVENT, changed); document.removeEventListener('visibilitychange', changed) }
  }, [load])
  const seconds = status ? status.seconds + (status.checked_in ? Math.max(0, Math.round((now - loadedAt) / 1000)) : 0) : 0
  return { status, seconds }
}

/** A working day and not checked in yet: the check in shows over everything and cannot be closed */
function DailyCheckIn() {
  const { status, seconds } = useAttendance()
  if (!status?.kept || !status.must_check_in || status.checked_in) return null
  return <PunchSheet status={status} seconds={seconds} locked onClose={() => undefined} />
}

function PunchLoader({ onClose }: { onClose: () => void }) {
  const { status, seconds } = useAttendance()
  // Not in the attendance lists (e.g. the super admin): nothing to punch
  useEffect(() => { if (status && !status.kept) onClose() }, [status, onClose])
  if (!status?.kept) return null
  return <PunchSheet status={status} seconds={seconds} onClose={onClose} />
}

// ─── Home ────────────────────────────────────────────────────────────

/** Home on the phone: greeting, check in, then the user's dashboard */
function HomeTab({ onCountApprovals, allModules, canMail, onOpen, onTab, onPunch }: {
  onCountApprovals: (n: number) => void
  allModules: NavItem[]
  canMail: boolean
  onOpen: (key: string) => void
  onTab: (tab: Tab) => void
  onPunch: () => void
}) {
  const { user } = useAuth()
  const { status, seconds } = useAttendance()
  const install = useInstallState()
  const [push, setPush] = usePushState()
  const [pushKey, setPushKey] = useState<string | null>(null)
  const [pushError, setPushError] = useState('')

  useEffect(() => {
    approvalsApi.list().then((r) => onCountApprovals(r.data.length)).catch(() => undefined)
    pushApi.config().then((c) => setPushKey(c.public_key)).catch(() => undefined)
  }, [onCountApprovals])

  const hour = Number(new Date().toLocaleString('en-GB', { hour: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }))
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="m-page">
      <div className="m-hello">
        <span className="m-muted">{greeting},</span>
        <h1>{user?.firstname || user?.name || 'there'}</h1>
        <span className="m-muted m-small">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Kolkata' })}</span>
      </div>

      {status?.kept && !user?.is_super_admin ? (
        <section className={`m-card m-punch${status.checked_in ? ' m-punch--in' : ''}`}>
          <div>
            <span className="m-muted m-small">{status.checked_in ? 'Checked in' : status.spells.length ? 'Checked out' : 'Not checked in yet'}</span>
            <strong className="m-punch__time">{duration(seconds)}</strong>
            <span className="m-muted m-small">worked today</span>
          </div>
          <button type="button" className={`m-btn ${status.checked_in ? 'm-btn--danger' : 'm-btn--primary'}`} onClick={onPunch}>
            {status.checked_in ? <><LogOut size={17} /> Check Out</> : <><LogIn size={17} /> Check In</>}
          </button>
        </section>
      ) : null}

      {install ? <InstallCard kind={install} /> : null}

      {pushKey && push === 'off' ? (
        <section className="m-card m-banner">
          <BellRing size={22} />
          <div><strong>Get alerts on this phone</strong><span className="m-muted m-small">Approvals, new jobs and mail, even when the app is closed.</span>
            {pushError ? <span className="m-error m-small">{pushError}</span> : null}</div>
          <button type="button" className="m-btn m-btn--primary m-btn--sm" onClick={() => { setPushError(''); enablePush(pushKey).then(setPush).catch((e: Error) => setPushError(e.message)) }}>Turn on</button>
        </section>
      ) : null}

      {/* The user's own dashboard: the same cards as on the computer, laid out for the phone */}
      <HomeDashboard phone modules={[...allModules, ...(canMail ? [{ key: 'mail', label: 'Mail' }] : [])]} onOpen={onOpen} onApprovals={() => onTab('approvals')} />
    </div>
  )
}

function InstallCard({ kind }: { kind: 'prompt' | 'ios' }) {
  const [hidden, setHidden] = useState(() => sessionStorage.getItem('hide_install') === '1')
  if (hidden) return null
  const hide = () => { sessionStorage.setItem('hide_install', '1'); setHidden(true) }
  return (
    <section className="m-card m-banner">
      <Download size={22} />
      <div>
        <strong>Install the NCRC app</strong>
        {kind === 'prompt'
          ? <span className="m-muted m-small">Opens from your home screen like any app.</span>
          : <span className="m-muted m-small">Tap <Share size={12} /> Share, then <SquarePlus size={12} /> Add to Home Screen.</span>}
      </div>
      {kind === 'prompt'
        ? <button type="button" className="m-btn m-btn--primary m-btn--sm" onClick={() => void promptInstall()}>Install</button>
        : <button type="button" className="m-btn m-btn--ghost m-btn--sm" onClick={hide}>OK</button>}
    </section>
  )
}

// ─── Jobs & Lab ──────────────────────────────────────────────────────

interface ReportType { key: string; label: string; total: number; pending: number; testing: number; generated: number; assigned_to_me: number }

function JobsTab({ onOpen }: { onOpen: (key: string) => void }) {
  const { user } = useAuth()
  const canReports = canUserAccess(user, 'reports')
  const [types, setTypes] = useState<ReportType[] | null>(null)
  const [queue, setQueue] = useState<MyQueueItem[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (canReports) api.reportTypes().then((r) => setTypes(r.data)).catch((e: Error) => setError(e.message))
    api.myQueue().then((r) => setQueue(r.queue)).catch(() => setQueue([]))
  }, [canReports])

  const links = [
    { key: 'final_reports', label: 'Final Reports' },
    { key: 'due_reports', label: 'UID w/o Report' },
    { key: 'ulr_register', label: 'ULR Register' },
    { key: 'registrations', label: 'Client Registrations' },
  ].filter((l) => canUserAccess(user, l.key))

  const active = (types ?? []).filter((t) => t.pending + t.testing + t.generated + t.assigned_to_me > 0)
  const mine = (types ?? []).reduce((n, t) => n + t.assigned_to_me, 0)

  return (
    <div className="m-page">
      <div className="m-page__head"><h1>Jobs &amp; Lab</h1></div>
      {error ? <p className="m-error">{error}</p> : null}

      {canReports ? (
        <>
          <h2 className="m-heading">Lab reports{mine ? ` · ${mine} assigned to me` : ''}</h2>
          {types === null ? <div className="m-skeleton-list"><span /><span /></div> : active.length === 0 ? (
            <p className="m-muted">No reports are in progress.</p>
          ) : (
            <ul className="m-list">
              {active.map((t) => (
                <li key={t.key}>
                  <button type="button" className="m-card m-rowcard" onClick={() => onOpen(`report_${t.key}`)}>
                    <span className="m-rowcard__main">
                      <strong>{t.label}</strong>
                      <span className="m-pills">
                        {t.assigned_to_me ? <span className="m-pill m-pill--blue">{t.assigned_to_me} mine</span> : null}
                        {t.pending ? <span className="m-pill">{t.pending} pending</span> : null}
                        {t.testing ? <span className="m-pill m-pill--amber">{t.testing} testing</span> : null}
                        {t.generated ? <span className="m-pill m-pill--green">{t.generated} to approve</span> : null}
                      </span>
                    </span>
                    <ChevronRight size={18} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" className="m-btn m-btn--ghost m-btn--block" onClick={() => onOpen('reports')}><FlaskConical size={16} /> All lab reports</button>
        </>
      ) : null}

      {queue && queue.length ? (
        <>
          <h2 className="m-heading">My job queue</h2>
          <ul className="m-list">
            {queue.slice(0, 25).map((j) => (
              <li key={j.id} className="m-card m-job">
                <span className="m-job__row"><strong>{j.uid_no}</strong>{j.is_overdue ? <span className="m-pill m-pill--red">Overdue</span> : <span className="m-pill">{j.current_stage}</span>}</span>
                <span className="m-muted">{j.client_name || j.title || ''}</span>
                <span className="m-muted m-small">{Math.abs(j.days_at_stage)} day{Math.abs(j.days_at_stage) === 1 ? '' : 's'} at this stage{j.assigned_to ? ` · ${j.assigned_to}` : ''}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {links.length ? (
        <>
          <h2 className="m-heading">More</h2>
          <div className="m-card m-menu">
            {links.map((l) => {
              const Icon = iconMap[l.key] ?? Briefcase
              return <button type="button" key={l.key} onClick={() => onOpen(l.key)}><Icon size={19} /><span>{l.label}</span><ChevronRight size={17} /></button>
            })}
          </div>
        </>
      ) : null}
    </div>
  )
}

// ─── More ────────────────────────────────────────────────────────────

function MoreTab({ groups, extras, canMail, onOpen, onUseDesktop, userName, roleLabel, onLogout }: {
  groups: NavGroup[]
  extras: NavItem[]
  canMail: boolean
  onOpen: (key: string) => void
  onUseDesktop: () => void
  userName: string
  roleLabel: string
  onLogout: () => void
}) {
  const install = useInstallState()
  const sections: Array<{ label: string; items: NavItem[] }> = [
    { label: 'Work', items: [...extras, ...(canMail ? [{ key: 'mail', label: 'Mail' }] : [])] },
    ...groups.map((g) => ({ label: g.label, items: g.items })),
  ].filter((s) => s.items.length)

  return (
    <div className="m-page">
      <section className="m-card m-profile">
        <span className="m-avatar">{userName.trim().charAt(0).toUpperCase() || 'U'}</span>
        <div><strong>{userName}</strong><span className="m-muted m-small">{roleLabel}</span></div>
      </section>

      {sections.map((s) => (
        <div key={s.label}>
          <h2 className="m-heading">{s.label}</h2>
          <div className="m-card m-menu">
            {s.items.map((item) => {
              const Icon = item.key === 'mail' ? Mail : iconMap[item.key] ?? ClipboardCheck
              return <button type="button" key={item.key} onClick={() => onOpen(item.key)}><Icon size={19} /><span>{item.label}</span><ChevronRight size={17} /></button>
            })}
          </div>
        </div>
      ))}

      <h2 className="m-heading">App</h2>
      <div className="m-card m-menu">
        <button type="button" onClick={() => onOpen('m_notifications')}><Bell size={19} /><span>Notifications</span><ChevronRight size={17} /></button>
        <button type="button" onClick={() => onOpen('m_push')}><BellRing size={19} /><span>Phone alerts</span><ChevronRight size={17} /></button>
        <button type="button" onClick={() => onOpen('m_tabs')}><PanelBottom size={19} /><span>Customise bottom bar</span><ChevronRight size={17} /></button>
        {install === 'prompt' ? <button type="button" onClick={() => void promptInstall()}><Download size={19} /><span>Install app</span><ChevronRight size={17} /></button> : null}
        <button type="button" onClick={onUseDesktop}><Monitor size={19} /><span>Use computer layout</span><ChevronRight size={17} /></button>
        <button type="button" className="m-menu__danger" onClick={onLogout}><LogOut size={19} /><span>Log out</span></button>
      </div>
      <p className="m-muted m-small m-center">NCRC · Namotech Software</p>
    </div>
  )
}
