import type { TrackerRole } from './types'

/**
 * Role configuration aligned with the Namotech Job Tracker Excel.
 *
 * Each role maps to:
 *   - allowedModules: which sidebar items they can see
 *   - dashboardWidgets: which dashboard sections to show
 *   - ownedStages: workflow stages this role is responsible for
 *   - label / color: display properties for the role badge
 */

export interface RoleConfig {
  label: string
  color: string
  bgColor: string
  allowedModules: string[]
  dashboardWidgets: DashboardWidget[]
  ownedStages: string[]
  description: string
}

export type DashboardWidget =
  | 'welcome'
  | 'my_queue'
  | 'my_tasks'
  | 'today_registrations'
  | 'job_metrics'
  | 'financial_snapshot'
  | 'role_queue_counts'
  | 'attention_needed'
  | 'analytics'
  | 'expense_breakdown'
  | 'payment_followups'

const ROLE_CONFIGS: Record<TrackerRole, RoleConfig> = {
  admin: {
    label: 'Administrator',
    color: '#7c3aed',
    bgColor: '#ede9fe',
    description: 'Full access to all modules and all dashboard data',
    allowedModules: [
      'dashboard', 'tenders', 'jobs', 'inquiries', 'registrations', 'quotations', 'proposals', 'work_orders', 'outsource',
      'reports', 'ulr_add', 'ulr_register', 'ulr_links', 'final_reports', 'billing', 'due_reports',
      'admin', 'users', 'user_tracking', 'expenses', 'purchase_orders',
      'lab', 'documents', 'roles', 'permissions', 'settings', 'analytics',
      'workflow_templates', 'clients', 'job_types', 'help_guide',
    ],
    dashboardWidgets: [
      'welcome', 'my_tasks', 'role_queue_counts', 'job_metrics',
      'financial_snapshot', 'attention_needed', 'analytics', 'expense_breakdown',
    ],
    ownedStages: [], // sees all stages
  },

  registration: {
    label: 'Registration',
    color: '#0891b2',
    bgColor: '#ecfeff',
    description: 'Stages 1 (Registered) & 6 (Report Dispatched) — Job intake, UID generation, dispatch',
    allowedModules: [
      'dashboard', 'tenders', 'jobs', 'inquiries', 'registrations', 'quotations', 'work_orders',
      'billing', 'clients', 'due_reports', 'help_guide',
    ],
    dashboardWidgets: [
      'welcome', 'my_queue', 'my_tasks', 'today_registrations', 'job_metrics',
    ],
    ownedStages: ['1. Registered', '6. Report Dispatched'],
  },

  lab: {
    label: 'Lab / Field',
    color: '#059669',
    bgColor: '#ecfdf5',
    description: 'Stages 2 (Field/Site Work) & 3 (Lab Testing) — Field work, sample collection, lab testing',
    allowedModules: [
      'dashboard', 'tenders', 'jobs', 'lab', 'outsource', 'ulr_add', 'ulr_register', 'ulr_links', 'reports', 'help_guide',
    ],
    dashboardWidgets: [
      'welcome', 'my_queue', 'my_tasks', 'job_metrics',
    ],
    ownedStages: ['2. Field/Site Work', '3. Lab Testing'],
  },

  report_staff: {
    label: 'Report Staff',
    color: '#d97706',
    bgColor: '#fffbeb',
    description: 'Stage 4 (Report Drafting) — Report drafting & finalization',
    allowedModules: [
      'dashboard', 'tenders', 'jobs', 'reports', 'final_reports', 'ulr_add', 'ulr_register', 'ulr_links', 'help_guide',
    ],
    dashboardWidgets: [
      'welcome', 'my_queue', 'my_tasks', 'job_metrics',
    ],
    ownedStages: ['4. Report Drafting'],
  },

  technical: {
    label: 'Technical',
    color: '#4f46e5',
    bgColor: '#eef2ff',
    description: 'Stage 5 (Report Review) — Technical review & approval',
    allowedModules: [
      'dashboard', 'tenders', 'jobs', 'reports', 'final_reports', 'work_orders', 'ulr_add', 'ulr_register', 'ulr_links',
      'lab', 'analytics', 'help_guide',
    ],
    dashboardWidgets: [
      'welcome', 'my_queue', 'my_tasks', 'job_metrics', 'attention_needed',
    ],
    ownedStages: ['5. Report Review'],
  },

  manager: {
    label: 'Manager',
    color: '#dc2626',
    bgColor: '#fef2f2',
    description: 'Stage 7 (Payment Pending) — Payment follow-up, financial oversight',
    allowedModules: [
      'dashboard', 'tenders', 'jobs', 'inquiries', 'registrations', 'billing', 'expenses',
      'purchase_orders', 'clients', 'analytics', 'due_reports', 'quotations', 'proposals',
      'work_orders', 'help_guide',
    ],
    dashboardWidgets: [
      'welcome', 'my_queue', 'my_tasks', 'role_queue_counts', 'job_metrics',
      'financial_snapshot', 'attention_needed', 'analytics', 'expense_breakdown',
      'payment_followups',
    ],
    ownedStages: ['7. Payment Pending'],
  },

  staff: {
    label: 'Staff',
    color: '#6b7280',
    bgColor: '#f3f4f6',
    description: 'General staff — basic access',
    allowedModules: [
      'dashboard', 'tenders', 'jobs', 'help_guide',
    ],
    dashboardWidgets: [
      'welcome', 'my_queue', 'my_tasks',
    ],
    ownedStages: [],
  },
}

export function getRoleConfig(role: TrackerRole): RoleConfig {
  return ROLE_CONFIGS[role] ?? ROLE_CONFIGS.staff
}

/**
 * Check if a module is allowed for the given role.
 * Admin always has access to everything.
 */
export function isModuleAllowed(role: TrackerRole, moduleKey: string): boolean {
  if (role === 'admin') return true
  const config = getRoleConfig(role)
  return config.allowedModules.includes(moduleKey)
}

// ─── Per-user feature access ────────────────────────────────────────────

/** Features an admin can switch on per user in Manage Users (keys must match backend User::FEATURE_KEYS). */
export const FEATURES: Array<{ key: string; label: string; group: string }> = [
  { key: 'tenders', label: 'Tenders', group: 'General' },
  { key: 'mail', label: 'Mail (office mailbox)', group: 'General' },
  { key: 'documents_site', label: 'Documents (documents.namotech.in)', group: 'General' },
  { key: 'inquiries', label: 'Inquiries', group: 'Clients' },
  { key: 'proposals', label: 'Proposals', group: 'Clients' },
  { key: 'registrations', label: 'Client Registrations', group: 'Clients' },
  { key: 'quotations', label: 'Quotations', group: 'Clients' },
  { key: 'quotation_approve', label: 'Approve Quotations', group: 'Clients' },
  { key: 'work_orders', label: 'Work Orders', group: 'Clients' },
  { key: 'outsource', label: 'Outsource', group: 'Clients' },
  { key: 'reports', label: 'Lab Reports', group: 'Reports' },
  { key: 'ulr_add', label: 'Add ULR', group: 'Reports' },
  { key: 'ulr_register', label: 'ULR Register', group: 'Reports' },
  { key: 'final_reports', label: 'Final Reports', group: 'Reports' },
  { key: 'due_reports', label: 'UID w/o Report', group: 'Reports' },
  { key: 'billing', label: 'Invoice', group: 'Accounts' },
  { key: 'expenses', label: 'Daily Expenses', group: 'Accounts' },
  { key: 'purchase_orders', label: 'Purchase Order', group: 'Accounts' },
  { key: 'admin', label: 'Administration (manage users)', group: 'Admin' },
]

const FEATURE_KEYS = new Set(FEATURES.map((f) => f.key))

/** Always available to every signed-in user. */
const ALWAYS_ALLOWED = ['dashboard', 'help_guide']

/** Job roles selectable per user (admin is the separate "Full admin access" switch). */
export const JOB_ROLES: Array<{ key: Exclude<TrackerRole, 'admin'>; label: string }> = [
  { key: 'registration', label: 'Registration' },
  { key: 'lab', label: 'Lab / Field' },
  { key: 'report_staff', label: 'Report Staff' },
  { key: 'technical', label: 'Technical' },
  { key: 'manager', label: 'Manager' },
  { key: 'staff', label: 'Staff' },
]

interface AccessUser {
  is_admin?: boolean
  tracker_role?: TrackerRole
  allowed_modules?: string[] | null
}

/** The feature keys a user starts with if no per-user list has been saved yet (their job role's defaults). */
export function defaultFeaturesForRole(role: TrackerRole): string[] {
  return getRoleConfig(role).allowedModules.filter((key) => FEATURE_KEYS.has(key))
}

/**
 * Can this user open the given module?
 * Full admins see everything. If an admin has saved a feature list for the user, that list decides;
 * otherwise the user keeps the defaults of their job role (the behaviour before per-user access existed).
 */
export function canUserAccess(user: AccessUser | null | undefined, requestedKey: string): boolean {
  if (!user) return false
  // Credit notes come from cancelled invoices: same access as Invoice. So have performa invoices
  const moduleKey = requestedKey === 'credit_notes' || requestedKey === 'performa' ? 'billing' : requestedKey
  if (ALWAYS_ALLOWED.includes(moduleKey)) return true
  const role = user.tracker_role ?? 'staff'
  if (user.is_admin || role === 'admin') return true
  if (Array.isArray(user.allowed_modules)) return user.allowed_modules.includes(moduleKey)
  return isModuleAllowed(role, moduleKey)
}

/**
 * Check if a dashboard widget should be shown for the given role.
 */
export function shouldShowWidget(role: TrackerRole, widget: DashboardWidget): boolean {
  const config = getRoleConfig(role)
  return config.dashboardWidgets.includes(widget)
}

/**
 * Get human-readable stage names that a role owns.
 */
export function getRoleStageNames(role: TrackerRole): string[] {
  const config = getRoleConfig(role)
  return config.ownedStages
}

/**
 * Priority color mapping for queue items.
 */
export function getPriorityColor(priority: string): { color: string; bg: string } {
  switch (priority?.toLowerCase()) {
    case 'high': return { color: '#dc2626', bg: '#fef2f2' }
    case 'medium': return { color: '#d97706', bg: '#fffbeb' }
    case 'low': return { color: '#059669', bg: '#ecfdf5' }
    default: return { color: '#6b7280', bg: '#f3f4f6' }
  }
}

/**
 * Get the default queue filter tab for a logged-in user role.
 */
export function getUserDefaultRoleTab(role?: TrackerRole): string {
  if (!role) return 'all'
  switch (role) {
    case 'registration': return 'registration'
    case 'lab': return 'lab'
    case 'report_staff': return 'report_staff'
    case 'technical': return 'technical'
    case 'manager': return 'manager'
    case 'admin': return 'all'
    default: return 'all'
  }
}
