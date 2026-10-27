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
import { WorkflowTemplatesPage } from './pages/WorkflowTemplatesPage'
import { ClientsPage } from './pages/ClientsPage'
import { AnalyticsPage } from './pages/AnalyticsPage'
import QuotationsPage from './pages/QuotationsPage'
import WorkOrdersPage from './pages/WorkOrdersPage'
import OutsourcePage from './pages/OutsourcePage'
import { JobTypesPage } from './pages/JobTypesPage'
import { TenderPage } from './pages/TenderPage'
import { AppShell } from './components/AppShell'
import { useState, useMemo } from 'react'
import type { ModuleKey } from './lib/types'
import { isModuleAllowed } from './lib/roleConfig'
import { ClipboardList, FlaskConical, Users, ReceiptText, IndianRupee, ClipboardCheck, type LucideIcon } from 'lucide-react'

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
      label: 'Lab Reports',
      icon: FlaskConical,
      items: [
        { key: 'reports', label: 'All Lab Reports' },
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
      label: 'Final Reports',
      icon: ClipboardCheck,
      items: [
        { key: 'final_reports', label: 'Final Reports' },
      ],
    },
    {
      label: 'Billing',
      icon: ReceiptText,
      items: [
        { key: 'billing', label: 'Billing' },
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
      label: 'Administration',
      icon: Users,
      items: [
        { key: 'users', label: 'Manage Users' },
        { key: 'roles', label: 'Groups & Permissions' },
      ],
    },
  ]

  // Filter nav groups based on role
  const groups = useMemo(() => {
    return allGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => isModuleAllowed(trackerRole, item.key)),
      }))
      .filter((group) => group.items.length > 0)
  }, [trackerRole])

  // When user clicks a module, check they have access
  const handleModuleChange = (key: string) => {
    if (isModuleAllowed(trackerRole, key) || key === 'dashboard') {
      setActiveModule(key as ModuleKey)
    }
  }

  return (
    <AppShell
      groups={groups}
      activeModule={activeModule}
      onModuleChange={handleModuleChange}
    >
      <div className={`view ${activeModule === 'dashboard' ? 'visible' : ''}`}>
        {activeModule === 'dashboard' ? <div aria-hidden="true" /> : null}
      </div>
      <div className={`view ${activeModule === 'tenders' ? 'visible' : ''}`}>
        {activeModule === 'tenders' && <TenderPage />}
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
      <div className={`view ${activeModule === 'work_orders' ? 'visible' : ''}`}>
        {activeModule === 'work_orders' && <WorkOrdersPage />}
      </div>
      <div className={`view ${activeModule === 'registrations' ? 'visible' : ''}`}>
        {activeModule === 'registrations' && <RegistrationsPage />}
      </div>
      <div className={`view ${activeModule === 'billing' ? 'visible' : ''}`}>
        {activeModule === 'billing' && <BillingPage />}
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
        {activeModule === 'ulr_add' && <UlrLinkPage mode="add" />}
      </div>
      <div className={`view ${activeModule === 'ulr_register' ? 'visible' : ''}`}>
        {activeModule === 'ulr_register' && <UlrLinkPage mode="register" />}
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
  )
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

  return <AuthenticatedApp />
}
