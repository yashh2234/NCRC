export type TrackerRole = 'admin' | 'registration' | 'lab' | 'report_staff' | 'technical' | 'manager' | 'staff'

export interface User {
  id: number
  username: string
  email: string
  firstname: string
  lastname: string
  phone: string
  gender: number
  is_admin: boolean
  name: string
  tracker_role: TrackerRole
  groups: Array<{ id: number; group_name: string }>
  permissions: string[]
}

export interface LoginSession {
  id: number
  user_id: number
  ip_address: string | null
  user_agent: string | null
  logged_in_at: string | null
  logged_out_at: string | null
  last_seen_at: string | null
  active: boolean
}

export interface FinancialSnapshot {
  total_billed: number
  total_received: number
  outstanding: number
  avg_job_value: number
  active_job_value: number
}

export interface AttentionNeeded {
  overdue_jobs: number
  stuck_jobs: number
  reports_awaiting: number
  payment_followup: number
}

export interface MyQueueItem {
  id: number
  uid_no: string
  title: string | null
  description: string | null
  priority: string
  status: string
  current_stage: string
  current_stage_slug: string
  client_name: string
  assigned_to: string
  days_at_stage: number
  is_overdue: boolean
  due_at: string | null
  created_at: string | null
}

export interface DashboardResponse {
  page_title: string
  is_admin: boolean
  user_role: TrackerRole
  metrics: Record<string, number>
  role_queue_counts: Record<string, number>
  all_stage_counts?: Record<string, number>
  financial_snapshot: FinancialSnapshot | null
  attention_needed: AttentionNeeded | null
  modules: string[]
}

export interface RoleSummary {
  id: number
  name: string
  users_count: number
  permissions: string[]
  permissions_count: number
}

export interface UserRecord {
  id: number
  username: string
  email: string
  firstname: string
  lastname: string
  phone: string
  gender: number
  is_admin: boolean
  is_active?: boolean
  name: string
  group: { id: number; group_name: string; permissions: string[] } | null
  groups: Array<{ id: number; group_name: string }>
  permissions: string[]
  last_login_at: string | null
}

export interface UserFormData {
  username: string
  email: string
  password: string
  password_confirmation: string
  firstname: string
  lastname: string
  phone: string
  gender: string
  group_id: string
  is_active?: string
}

export interface StageLog {
  id: number
  registration_id?: number
  uid_no?: string
  stage_set: string
  from_person?: string
  to_person?: string
  note?: string
  created_at: string
}

export interface Registration {
  id: number
  uid_no: string
  received_date: string | null
  agency_name: string
  reporting_address: string
  mobile_no: string
  name_of_work: string
  work_order_no?: string
  reference?: string
  work?: string
  report_status?: string
  sample_details: string
  sample_details_1?: string
  sample_details_2?: string
  sample_details_3?: string
  sample_details_4?: string
  new_back?: string
  new_back_1?: string
  new_back_2?: string
  new_back_3?: string
  new_back_4?: string
  total_payment: number
  advance_payment: number
  balance_dues: number
  payment_followup: string | null
  financial_remark: string | null
  mode_of_payment: string | null
  gst_no?: string
  sample_nos?: string
  remark: string | null
  qty: string | null
  qty_1?: string
  qty_2?: string
  qty_3?: string
  qty_4?: string
  witness?: string
  sample_test?: string
  sample_remark?: string
  report_no?: string
  field_person_name?: string
  prepared_date?: string
  dispatch_date?: string
  assign_to: string | null
  report_copy: string | null
  scan_copy?: string
  scan_copy_1?: string
  scan_copy_2?: string
  scan_copy_3?: string
  scan_copy_4?: string
  status: string
  color?: string
  current_stage?: string
  currently_with?: string
  priority?: string
  target_date?: string
  payment_status?: string
  days_at_stage?: number
  stage_logs?: StageLog[]
}

export interface RegistrationFormData {
  uid_no: string
  received_date: string
  agency_name: string
  reporting_address: string
  mobile_no: string
  name_of_work: string
  work_order_no?: string
  reference?: string
  work?: string
  report_status?: string
  sample_details: string
  sample_details_1?: string
  sample_details_2?: string
  sample_details_3?: string
  sample_details_4?: string
  new_back?: string
  new_back_1?: string
  new_back_2?: string
  new_back_3?: string
  new_back_4?: string
  total_payment: string
  advance_payment: string
  balance_dues: string
  payment_followup: string
  financial_remark?: string
  mode_of_payment?: string
  gst_no?: string
  sample_nos?: string
  remark: string
  qty: string
  qty_1?: string
  qty_2?: string
  qty_3?: string
  qty_4?: string
  witness?: string
  sample_test?: string
  sample_remark?: string
  report_no?: string
  field_person_name?: string
  prepared_date?: string
  dispatch_date?: string
  assign_to: string
  current_stage?: string
  currently_with?: string
  priority?: string
  target_date?: string
  payment_status?: string
  handover_note?: string
}

export interface CubeReport {
  iReportId: number
  uid_no: string
  create_date: string | null
  customer_details: string
  agency_name: string
  reference_no: string | null
  material_details: string | null
  source_location: string | null
  work_order_no: string | null
  sample_date: string | null
  sample_tested_date: string | null
  status: string
}

export interface CubeFormData {
  uid_no: string
  ulr_no: string
  customer_details: string
  agency_name: string
  reference_no: string
  material_details: string
  source_location: string
  work_order_no: string
  sample_date: string
  sample_tested_date: string
  sampled_by: string
  environment_condition: string
}

export interface BillingItem extends Registration {}

export interface BillingRecord {
  id: number
  uid_no: string
  bill_no: string
  bill_amount: number
  advance_amount: number
  mode_of_payment: string | null
  amount_received: number
  amount_received_date: string | null
  due_amount: number
  discount: number
  payment_followup: string | null
  remark: string | null
  created_date: string | null
  agency_name: string | null
  mobile_no: string | null
}

export interface SmsLogEntry {
  id: number
  iClientId: number
  sent_date: string | null
  balance_amount: number
  advance_amount: number
  total_amount: number
  agency_name: string | null
  mobile_no: string | null
  uid_no: string | null
}

export interface Invoice {
  iInvoiceId: number
  date: string
  invoice_no: string
  work_order_no: string | null
  work_order_date: string | null
  report_no: string | null
  report_date: string | null
  agency_name: string | null
  reporting_address: string | null
  agency_gst: string | null
  agency_state: string | null
  terms_of_delivery: string | null
  total_amount: number
  total_discount: number
  transportation: number
  sgst_amount: number
  cgst_amount: number
  gst_amount: number
  net_amount: number
  advance_amount: number
  user_id: number
  created_at: string | null
  updated_at: string | null
  items: InvoiceListItem[]
  user?: { id: number; name: string }
}

export interface InvoiceListItem {
  iIlid: number
  iInvoiceId: number
  description: string | null
  unit: string | null
  rate: number
  discount: number
  amount: number
  set_count: number
}

export interface AuditLogEntry {
  id: number
  user_id: number | null
  user_name: string
  action: string
  model_type: string | null
  model_id: number | null
  description: string | null
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  ip_address: string | null
  created_at: string | null
}

export interface PurchaseOrder {
  iPurchaseorderId: number
  date: string
  purchase_order: string
  agency_name: string | null
  reporting_address: string | null
  vendor_ref_no: string | null
  vendor_ref_date: string | null
  total_amount: number
  total_discount: number
  transportation: number
  advance_amount: number
  gst_amount: number
  net_amount: number
  remark: string | null
  user_id: number
  items: PurchaseOrderListItem[]
  user?: { id: number; name: string }
}

export interface PurchaseOrderListItem {
  iPlid: number
  iPurchaseorderId: number
  description: string | null
  unit: string | null
  rate: number
  discount: number
  amount: number
  set_count: number
}

export type ModuleKey = 'dashboard' | 'lab' | 'users' | 'roles' | 'permissions' | 'clients' | 'inquiries' | 'quotations' | 'work_orders' | 'registrations' | 'billing' | 'reports' | 'expenses' | 'purchase_orders' | 'invoices' | 'due_reports' | 'final_reports' | 'dispatches' | 'outsource' | 'ulr_links' | 'stores' | 'settings' | 'audit' | 'user_tracking' | 'analytics' | 'workflow_templates' | 'jobs' | 'documents' | 'job_types' | 'help_guide'

export interface WorkflowTemplate {
  id: number
  name: string
  description: string | null
  is_active: boolean
  created_by: number | null
  created_at: string | null
  updated_at: string | null
  stages?: WorkflowStage[]
  transitions?: WorkflowTransition[]
}

export interface WorkflowStage {
  id: number
  template_id: number
  name: string
  slug: string
  sort_order: number
  assigned_role_id: number | null
  sla_hours: number | null
  is_start: boolean
  is_end: boolean
  color: string
  created_at: string | null
  updated_at: string | null
}

export interface WorkflowTransition {
  id: number
  template_id: number
  from_stage_id: number
  to_stage_id: number
  name: string
  permission_name: string | null
  requires_approval: boolean
  created_at: string | null
  updated_at: string | null
  from_stage?: WorkflowStage
  to_stage?: WorkflowStage
}

export interface Sample {
  id: number
  job_id: number
  sample_name: string | null
  sample_type: string | null
  description: string | null
  quantity: string | null
  unit: string | null
  condition: string | null
  received_date: string | null
  collected_by: number | null
  remarks: string | null
  created_at: string | null
  updated_at: string | null
}

export interface Job {
  id: number
  workflow_template_id: number | null
  current_stage_id: number | null
  uid_no: string
  title: string | null
  description: string | null
  priority: string
  status: string
  client_id: number | null
  assigned_to: number | null
  created_by: number | null
  updated_by: number | null
  started_at: string | null
  completed_at: string | null
  due_at: string | null
  created_at: string | null
  updated_at: string | null
  deleted_at: string | null
  current_stage?: WorkflowStage | null
  workflow_template?: WorkflowTemplate | null
  assigned_user?: { id: number; name: string } | null
  client?: { id: number; company_name: string } | null
  active_stage_tracking?: JobStageTracking | null
  timeline?: JobTimelineEntry[]
  stage_tracking?: JobStageTracking[]
  samples?: Sample[]
  assignments?: JobAssignment[]
}

export interface JobTimelineEntry {
  id: number
  job_id: number
  from_stage_id: number | null
  to_stage_id: number | null
  action: string
  user_id: number | null
  notes: string | null
  metadata: Record<string, unknown> | null
  created_at: string | null
  user?: { id: number; name: string } | null
  from_stage?: WorkflowStage | null
  to_stage?: WorkflowStage | null
}

export interface Inquiry {
  id: number
  inquiry_no: string
  client_name: string
  agency_name: string | null
  mobile_no: string | null
  email: string | null
  inquiry_type: string
  scope_of_work: string | null
  priority: string
  status: string
  notes: string | null
  received_date: string
  assigned_to: number | null
  created_by: number | null
  created_at: string | null
}

export interface Quotation {
  id: number
  quotation_no: string
  client_name: string
  agency_name: string | null
  contact_person: string | null
  mobile_no: string | null
  email: string | null
  valid_until: string | null
  total_amount: number | null
  status: string
  notes: string | null
  created_by: number | null
  created_at: string | null
}

export interface WorkOrder {
  id: number
  work_order_no: string
  client_name: string
  agency_name: string | null
  scope_of_work: string | null
  due_date: string | null
  total_amount: number | null
  status: string
  notes: string | null
  created_by: number | null
  created_at: string | null
}

export interface JobAssignment {
  id: number
  job_id: number
  department_id: number | null
  assigned_to: number | null
  assigned_by: number | null
  assignment_type: 'internal' | 'outsource'
  vendor_id: number | null
  priority: string
  due_date: string | null
  started_at: string | null
  completed_at: string | null
  status: string
  notes: string | null
  created_at: string | null
  department?: { id: number; name: string } | null
  assigned_user?: { id: number; name: string } | null
  vendor?: { id: number; vendor_name: string } | null
}

export interface JobStageTracking {
  id: number
  job_id: number
  stage_id: number
  entered_at: string | null
  exited_at: string | null
  sla_deadline: string | null
  is_overdue: boolean
  overdue_minutes: number
  created_at: string | null
  updated_at: string | null
  stage?: WorkflowStage | null
}
