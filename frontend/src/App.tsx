import { AuthProvider, useAuth } from './lib/auth'
import { LoginPage } from './pages/LoginPage'
import { UsersPage } from './pages/UsersPage'
import { RegistrationsPage } from './pages/RegistrationsPage'
import { BillingPage } from './pages/BillingPage'
import { ReportsPage } from './pages/ReportsPage'
import { RolesPage } from './pages/RolesPage'
import { ExpensesPage } from './pages/ExpensesPage'
import { PurchaseOrdersPage } from './pages/PurchaseOrdersPage'
import { DueReportsPage } from './pages/DueReportsPage'
import { FinalReportsPage } from './pages/FinalReportsPage'
import { UlrLinkPage } from './pages/UlrLinkPage'
import { UlrRegisterPage } from './pages/UlrRegisterPage'
import { WorkflowTemplatesPage } from './pages/WorkflowTemplatesPage'
import { ClientsPage } from './pages/ClientsPage'
import { AnalyticsPage } from './pages/AnalyticsPage'
import QuotationsPage from './pages/QuotationsPage'
import { ProposalsPage } from './pages/ProposalsPage'
import WorkOrdersPage from './pages/WorkOrdersPage'
import OutsourcePage from './pages/OutsourcePage'
import { JobTypesPage } from './pages/JobTypesPage'
import { PerformaPage } from './pages/PerformaPage'
import { TenderPage } from './pages/TenderPage'
import { InquiriesPage } from './pages/InquiriesPage'
import { MyAttendancePage } from './pages/MyAttendancePage'
import { LeavePage } from './pages/LeavePage'
import { HolidaysPage } from './pages/HolidaysPage'
import { TeamPage } from './pages/TeamPage'
import { useUsageClock } from './lib/useTracking'
import { AdministrationPage } from './pages/AdministrationPage'
import { AppShell } from './components/AppShell'
import { TenderAnalysesDock, TenderAnalysesProvider } from './components/TenderAnalyses'
import { useTenderAnalyses } from './lib/tenderAnalyses'
import { MailPage } from './pages/MailPage'
import { MobileApp } from './mobile/MobileApp'
import { useMobileLayout } from './mobile/useMobile'
import { useCallback, useEffect, useState, useMemo } from 'react'
import { IS_MAIL_TAB, leaveMailTab, openMailTab } from './lib/mailTab'
import type { ModuleKey } from './lib/types'
import { canUserAccess } from './lib/roleConfig'
import { LoadingScreen } from './components/LoadingScreen'
import { Toaster } from './components/Toaster'
import { HomeDashboard } from './components/HomeDashboard'
import { ClipboardList, FlaskConical, Users, ReceiptText, IndianRupee, ClipboardCheck, FileClock, FileMinus, CalendarCheck, type LucideIcon } from 'lucide-react'

interface NavItem {
  key: string
  label: string
}

interface NavGroup {
  label: string
  icon: LucideIcon
  items: NavItem[]
}

function AuthenticatedApp() {
  const { user } = useAuth()
  const [activeModule, setActiveModule] = useState<ModuleKey>('dashboard')
  const showTenderPage = useCallback(() => setActiveModule('tenders' as ModuleKey), [])

  return (
    <TenderAnalysesProvider enabled={canUserAccess(user, 'tenders')} onOpen={showTenderPage}>
      <Workspace activeModule={activeModule} setActiveModule={setActiveModule} />
    </TenderAnalysesProvider>
  )
}

interface WorkspaceProps {
  activeModule: ModuleKey
  setActiveModule: (key: ModuleKey) => void
}

function Workspace({ activeModule, setActiveModule }: WorkspaceProps) {
  const { user } = useAuth()
  const { open: openAnalysis } = useTenderAnalyses()
  const canUseMail = canUserAccess(user, 'mail')

  const trackerRole = user?.tracker_role ?? 'staff'
  const [mobile, setDesktopLayout] = useMobileLayout()

  // All possible nav groups
  const allGroups: NavGroup[] = [
    {
      label: 'Clients',
      icon: ClipboardList,
      items: [
        { key: 'registrations', label: 'Client Registrations' },
        { key: 'quotations', label: 'Quotations' },
        { key: 'work_orders', label: 'Work Orders' },
        { key: 'outsource', label: 'Outsource' },
      ],
    },
    {
      label: 'Manage ULR',
      icon: ClipboardList,
      items: [
        { key: 'ulr_add', label: 'ADD ULR' },
        { key: 'ulr_register', label: 'Manage ULR Register' },
      ],
    },
    {
      label: 'Lab Reports',
      icon: FlaskConical,
      items: [
        { key: 'reports', label: 'All Lab Reports' },
      ],
    },
    {
      label: 'Final Reports',
      icon: ClipboardCheck,
      items: [
        { key: 'final_reports', label: 'Final Reports' },
      ],
    },
    {
      label: 'Invoice',
      icon: ReceiptText,
      items: [
        { key: 'billing', label: 'Invoice' },
      ],
    },
    {
      label: 'Performa Invoice',
      icon: FileClock,
      items: [
        { key: 'performa', label: 'Performa Invoice' },
      ],
    },
    {
      label: 'Credit Note',
      icon: FileMinus,
      items: [
        { key: 'credit_notes', label: 'Credit Note' },
      ],
    },
    {
      label: 'UID w/o Report',
      icon: ClipboardList,
      items: [
        { key: 'due_reports', label: 'UID w/o Report' },
      ],
    },
    {
      label: 'Daily Expenses',
      icon: IndianRupee,
      items: [
        { key: 'expenses', label: 'Daily Expenses' },
      ],
    },
    {
      label: 'Purchase Order',
      icon: IndianRupee,
      items: [
        { key: 'purchase_orders', label: 'Purchase Order' },
      ],
    },
    {
      label: 'Attendance & Leave',
      icon: CalendarCheck,
      items: [
        { key: 'my_attendance', label: 'My Attendance' },
        { key: 'leave', label: 'Leave' },
        { key: 'holidays', label: 'Holiday Calendar' },
        { key: 'team', label: 'Team Attendance' },
      ],
    },
    {
      label: 'Administration',
      icon: Users,
      items: [
        { key: 'admin', label: 'Manage Users & Groups' },
      ],
    },
  ]

  // Filter nav groups by the user's feature access (per-user list, or job-role defaults)
  const groups = useMemo(() => {
    return allGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => canUserAccess(user, item.key)),
      }))
      .filter((group) => group.items.length > 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, trackerRole])

  // When user clicks a module, check they have access
  const handleModuleChange = (key: string) => {
    if (canUserAccess(user, key)) {
      setBillingUid('')
      setActiveModule(key as ModuleKey)
    }
  }

  // Pages for the dashboard's quick actions: the menu, plus the pages that sit outside the menu groups
  const dashModules = useMemo(() => [
    ...groups.flatMap((g) => g.items),
    ...([['inquiries', 'Enquiries'], ['proposals', 'Proposals'], ['tenders', 'Tenders']] as const)
      .filter(([key]) => canUserAccess(user, key)).map(([key, label]) => ({ key, label })),
    ...(canUseMail ? [{ key: 'mail', label: 'Mail' }] : []),
  ], [groups, user, canUseMail])

  // "View" in the registration table's Bill column opens Billing filtered to that UID
  const [billingUid, setBillingUid] = useState('')
  const canViewBilling = canUserAccess(user, 'billing')
  const openBillingForUid = (uid: string) => {
    if (!canViewBilling) return
    setBillingUid(uid)
    setActiveModule('billing' as ModuleKey)
  }
  // "Create" in the Bill column starts a new bill for that UID
  const [createBillUid, setCreateBillUid] = useState('')
  const createBillForUid = (uid: string) => {
    if (!canViewBilling) return
    setBillingUid('')
    setCreateBillUid(uid)
    setActiveModule('billing' as ModuleKey)
  }
  const clearCreateBillUid = useCallback(() => setCreateBillUid(''), [])

  /** The screen of a module; the same pages are used on the computer and in the phone app */
  const renderPage = (key: string): React.ReactNode => {
    if (key.startsWith('report')) return <ReportsPage defaultType={key.startsWith('report_') ? key.replace('report_', '') : undefined} />
    switch (key) {
      case 'tenders': return <TenderPage />
      case 'admin': return <AdministrationPage />
      case 'users': return <UsersPage />
      case 'roles': return <RolesPage />
      case 'clients': return <ClientsPage />
      case 'quotations': return <QuotationsPage />
      case 'proposals': return <ProposalsPage />
      case 'work_orders': return <WorkOrdersPage />
      case 'inquiries': return <InquiriesPage />
      case 'my_attendance': return <MyAttendancePage />
      case 'leave': return <LeavePage />
      case 'holidays': return <HolidaysPage />
      case 'team': return <TeamPage />
      case 'registrations': return <RegistrationsPage onViewBill={canViewBilling ? openBillingForUid : undefined} onCreateBill={canViewBilling ? createBillForUid : undefined} />
      case 'billing': return <BillingPage uidFilter={billingUid} onClearUidFilter={() => setBillingUid('')} createForUid={createBillUid} onCreateHandled={clearCreateBillUid} />
      case 'performa': return <PerformaPage />
      case 'credit_notes': return <BillingPage mode="credit_notes" />
      case 'expenses': return <ExpensesPage />
      case 'purchase_orders': return <PurchaseOrdersPage />
      case 'due_reports': return <DueReportsPage />
      case 'final_reports': return <FinalReportsPage />
      case 'outsource': return <OutsourcePage />
      case 'ulr_add': return <UlrLinkPage />
      case 'ulr_register': return <UlrRegisterPage />
      case 'analytics': return <AnalyticsPage />
      case 'workflow_templates': return <WorkflowTemplatesPage />
      case 'job_types': return <JobTypesPage />
      default: return null
    }
  }

  if (mobile) {
    const extras = [
      canUserAccess(user, 'inquiries') ? { key: 'inquiries', label: 'Enquiries' } : null,
      canUserAccess(user, 'proposals') ? { key: 'proposals', label: 'Proposals' } : null,
      canUserAccess(user, 'tenders') ? { key: 'tenders', label: 'Tenders' } : null,
    ].filter((x): x is { key: string; label: string } => x !== null)
    return (
      <>
        <MobileApp
          groups={groups}
          extras={extras}
          canMail={canUseMail}
          activeModule={activeModule}
          setActiveModule={(key) => {
            // The phone app's own screens and Mail are not features to check
            if (key === 'dashboard' || key.startsWith('m_') || (key === 'mail' && canUseMail)) setActiveModule(key as ModuleKey)
            else handleModuleChange(key)
          }}
          renderPage={renderPage}
          onOpenAnalysis={canUserAccess(user, 'tenders') ? openAnalysis : undefined}
          onUseDesktop={() => { setActiveModule('dashboard' as ModuleKey); setDesktopLayout(true) }}
        />
        <TenderAnalysesDock />
      </>
    )
  }

  return (
    <>
    <AppShell
      groups={groups}
      showInquiries={canUserAccess(user, 'inquiries')}
      showProposals={canUserAccess(user, 'proposals')}
      showTenders={canUserAccess(user, 'tenders')}
      showDocuments={canUserAccess(user, 'documents_site')}
      onOpenMail={canUseMail ? openMailTab : undefined}
      onOpenAnalysis={canUserAccess(user, 'tenders') ? openAnalysis : undefined}
      activeModule={activeModule}
      onModuleChange={handleModuleChange}
    >
      <div className="view visible">
        {activeModule === 'dashboard' ? (
          <HomeDashboard modules={dashModules} onOpen={(key) => { if (key === 'mail') { if (canUseMail) openMailTab() } else handleModuleChange(key) }} />
        ) : renderPage(activeModule)}
      </div>
    </AppShell>
    <TenderAnalysesDock />
    </>
  )
}

/** Mail in its own browser tab (#mail) */
function MailTab() {
  const { user } = useAuth()
  useUsageClock('mail')
  useEffect(() => { document.title = 'Mail · Namotech Software' }, [])
  if (!user) return <LoadingScreen />
  if (!canUserAccess(user, 'mail')) return <div className="loading-screen"><p>You do not have access to Mail.</p></div>
  return <MailPage onBack={leaveMailTab} />
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
      <Toaster />
    </AuthProvider>
  )
}

function AppInner() {
  const { token, loading } = useAuth()

  if (loading) {
    return (
      <LoadingScreen />
    )
  }

  if (!token) {
    return <LoginPage />
  }

  return IS_MAIL_TAB ? <MailTab /> : <AuthenticatedApp />
}
