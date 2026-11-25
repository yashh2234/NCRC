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
import { useCallback, useEffect, useState, useMemo } from 'react'
import { IS_MAIL_TAB, leaveMailTab, openMailTab } from './lib/mailTab'
import type { ModuleKey } from './lib/types'
import { canUserAccess } from './lib/roleConfig'
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
      <div className={`view ${activeModule === 'dashboard' ? 'visible' : ''}`}>
        {activeModule === 'dashboard' ? <div aria-hidden="true" /> : null}
      </div>
      <div className={`view ${activeModule === 'tenders' ? 'visible' : ''}`}>
        {activeModule === 'tenders' && <TenderPage />}
      </div>
      <div className={`view ${activeModule === 'admin' ? 'visible' : ''}`}>
        {activeModule === 'admin' && <AdministrationPage />}
      </div>
      <div className={`view ${activeModule === 'users' ? 'visible' : ''}`}>
        {activeModule === 'users' && <UsersPage />}
      </div>
      <div className={`view ${activeModule === 'roles' ? 'visible' : ''}`}>
        {activeModule === 'roles' && <RolesPage />}
      </div>
      <div className={`view ${activeModule === 'clients' ? 'visible' : ''}`}>
        {activeModule === 'clients' && <ClientsPage />}
      </div>
      <div className={`view ${activeModule === 'quotations' ? 'visible' : ''}`}>
        {activeModule === 'quotations' && <QuotationsPage />}
      </div>
      <div className={`view ${activeModule === 'proposals' ? 'visible' : ''}`}>
        {activeModule === 'proposals' && <ProposalsPage />}
      </div>
      <div className={`view ${activeModule === 'work_orders' ? 'visible' : ''}`}>
        {activeModule === 'work_orders' && <WorkOrdersPage />}
      </div>
      <div className={`view ${activeModule === 'inquiries' ? 'visible' : ''}`}>
        {activeModule === 'inquiries' && <InquiriesPage />}
      </div>
      <div className={`view ${activeModule === 'my_attendance' ? 'visible' : ''}`}>
        {activeModule === 'my_attendance' && <MyAttendancePage />}
      </div>
      <div className={`view ${activeModule === 'leave' ? 'visible' : ''}`}>
        {activeModule === 'leave' && <LeavePage />}
      </div>
      <div className={`view ${activeModule === 'holidays' ? 'visible' : ''}`}>
        {activeModule === 'holidays' && <HolidaysPage />}
      </div>
      <div className={`view ${activeModule === 'team' ? 'visible' : ''}`}>
        {activeModule === 'team' && <TeamPage />}
      </div>
      <div className={`view ${activeModule === 'registrations' ? 'visible' : ''}`}>
        {activeModule === 'registrations' && <RegistrationsPage onViewBill={canViewBilling ? openBillingForUid : undefined} onCreateBill={canViewBilling ? createBillForUid : undefined} />}
      </div>
      <div className={`view ${activeModule === 'billing' ? 'visible' : ''}`}>
        {activeModule === 'billing' && <BillingPage uidFilter={billingUid} onClearUidFilter={() => setBillingUid('')} createForUid={createBillUid} onCreateHandled={clearCreateBillUid} />}
      </div>
      <div className={`view ${activeModule === 'performa' ? 'visible' : ''}`}>
        {activeModule === 'performa' && <PerformaPage />}
      </div>
      <div className={`view ${activeModule === 'credit_notes' ? 'visible' : ''}`}>
        {activeModule === 'credit_notes' && <BillingPage mode="credit_notes" />}
      </div>
      <div className={`view ${activeModule.startsWith('report') ? 'visible' : ''}`}>
        {activeModule.startsWith('report') && <ReportsPage defaultType={activeModule.startsWith('report_') ? activeModule.replace('report_', '') : undefined} />}
      </div>
      <div className={`view ${activeModule === 'expenses' ? 'visible' : ''}`}>
        {activeModule === 'expenses' && <ExpensesPage />}
      </div>
      <div className={`view ${activeModule === 'purchase_orders' ? 'visible' : ''}`}>
        {activeModule === 'purchase_orders' && <PurchaseOrdersPage />}
      </div>
      <div className={`view ${activeModule === 'due_reports' ? 'visible' : ''}`}>
        {activeModule === 'due_reports' && <DueReportsPage />}
      </div>
      <div className={`view ${activeModule === 'final_reports' ? 'visible' : ''}`}>
        {activeModule === 'final_reports' && <FinalReportsPage />}
      </div>
      <div className={`view ${activeModule === 'outsource' ? 'visible' : ''}`}>
        {activeModule === 'outsource' && <OutsourcePage />}
      </div>
      <div className={`view ${activeModule === 'ulr_add' ? 'visible' : ''}`}>
        {activeModule === 'ulr_add' && <UlrLinkPage />}
      </div>
      <div className={`view ${activeModule === 'ulr_register' ? 'visible' : ''}`}>
        {activeModule === 'ulr_register' && <UlrRegisterPage />}
      </div>
      <div className={`view ${activeModule === 'analytics' ? 'visible' : ''}`}>
        {activeModule === 'analytics' && <AnalyticsPage />}
      </div>
      <div className={`view ${activeModule === 'workflow_templates' ? 'visible' : ''}`}>
        {activeModule === 'workflow_templates' && <WorkflowTemplatesPage />}
      </div>
      <div className={`view ${activeModule === 'job_types' ? 'visible' : ''}`}>
        {activeModule === 'job_types' && <JobTypesPage />}
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
  if (!user) return <div className="loading-screen"><p>Loading mail...</p></div>
  if (!canUserAccess(user, 'mail')) return <div className="loading-screen"><p>You do not have access to Mail.</p></div>
  return <MailPage onBack={leaveMailTab} />
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  )
}

function AppInner() {
  const { token, loading } = useAuth()

  if (loading) {
    return (
      <div className="loading-screen">
        <p>Loading workspace...</p>
      </div>
    )
  }

  if (!token) {
    return <LoginPage />
  }

  return IS_MAIL_TAB ? <MailTab /> : <AuthenticatedApp />
}
