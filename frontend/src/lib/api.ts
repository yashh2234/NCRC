import type {
  AuditLogEntry,
  BillingItem,
  BillingRecord,
  CubeReport,
  DashboardResponse,
  LoginSession,
  PurchaseOrder,
  Registration,
  RoleSummary,
  SmsLogEntry,
  User,
  UserRecord,
  Invoice,
} from './types'

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api'
export const API_ORIGIN = BASE_URL.replace(/\/api\/?$/, '')

function getToken(): string | null {
  return window.localStorage.getItem('legacy_erp_token')
}

function setToken(token: string | null): void {
  if (token) {
    window.localStorage.setItem('legacy_erp_token', token)
  } else {
    window.localStorage.removeItem('legacy_erp_token')
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    if (response.status === 401) {
      setToken(null)
    }
    throw new Error(payload.message ?? 'Request failed')
  }

  return payload as T
}

export const api = {
  forgotPassword(email: string): Promise<{ message: string; token: string }> {
    return request('/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    })
  },

  resetPassword(email: string, token: string, password: string, password_confirmation: string): Promise<{ message: string }> {
    return request('/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, token, password, password_confirmation }),
    })
  },


  login(email: string, password: string): Promise<{ token: string; user: User }> {
    return request('/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
  },

  logout(): Promise<{ message: string }> {
    return request('/logout', { method: 'POST' })
  },

  me(): Promise<{ user: User }> {
    return request('/me')
  },

  sessions(): Promise<{ data: LoginSession[]; active_count: number }> {
    return request('/sessions')
  },

  revokeSession(sessionId: number): Promise<{ message: string }> {
    return request(`/sessions/${sessionId}`, { method: 'DELETE' })
  },

  dashboardSummary(): Promise<DashboardResponse> {
    return request('/dashboard/summary')
  },

  myQueue(): Promise<{ role: string; queue: import('./types').MyQueueItem[]; total: number }> {
    return request('/dashboard/my-queue')
  },

  roles(): Promise<{ data: RoleSummary[] }> {
    return request('/roles')
  },

  users(): Promise<{ data: UserRecord[] }> {
    return request('/users')
  },

  createUser(data: Record<string, unknown>): Promise<{ message: string; user: UserRecord }> {
    return request('/users', { method: 'POST', body: JSON.stringify(data) })
  },

  updateUser(id: number, data: Record<string, unknown>): Promise<{ message: string; user: UserRecord }> {
    return request(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) })
  },

  deleteUser(id: number): Promise<{ message: string }> {
    return request(`/users/${id}`, { method: 'DELETE' })
  },

  registrations(): Promise<{ data: Registration[] }> {
    return request('/registrations')
  },

  createRegistration(data: Record<string, unknown>): Promise<{ message: string; registration: Registration }> {
    return request('/registrations', { method: 'POST', body: JSON.stringify(data) })
  },

  updateRegistration(id: number, data: Record<string, unknown>): Promise<{ message: string; registration: Registration }> {
    return request(`/registrations/${id}`, { method: 'PUT', body: JSON.stringify(data) })
  },

  billingDue(): Promise<{ data: BillingItem[] }> {
    return request('/billing/due')
  },

  billingDueAttached(): Promise<{ data: BillingItem[] }> {
    return request('/billing/due-attached')
  },

  billingNotUpdated(): Promise<{ data: BillingItem[] }> {
    return request('/billing/not-updated')
  },

  billingList(params?: Record<string, string>): Promise<{ data: BillingRecord[] }> {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return request(`/billing${qs}`)
  },

  createBilling(data: Record<string, unknown>): Promise<{ message: string; data: BillingRecord }> {
    return request('/billing', { method: 'POST', body: JSON.stringify(data) })
  },

  updateBilling(id: number, data: Record<string, unknown>): Promise<{ message: string; data: BillingRecord }> {
    return request(`/billing/${id}`, { method: 'PUT', body: JSON.stringify(data) })
  },

  deleteBilling(id: number): Promise<{ message: string }> {
    return request(`/billing/${id}`, { method: 'DELETE' })
  },

  updateRegistrationBilling(id: number, data: Record<string, unknown>): Promise<{ message: string; data: Record<string, unknown> }> {
    return request(`/billing/registration/${id}`, { method: 'PUT', body: JSON.stringify(data) })
  },

  sendSms(id: number): Promise<{ message: string }> {
    return request('/billing/send-sms', { method: 'POST', body: JSON.stringify({ id }) })
  },

  sendAllSms(): Promise<{ message: string }> {
    return request('/billing/send-all-sms', { method: 'POST' })
  },

  smsLog(): Promise<{ data: SmsLogEntry[] }> {
    return request('/billing/sms-log')
  },

  reportTypes(): Promise<{ data: Array<{ key: string; label: string; total: number; pending: number; testing: number; generated: number; assigned_to_me: number }> }> {
    return request('/reports/types')
  },

  reports(type: string): Promise<{ data: CubeReport[]; type: string }> {
    return request(`/reports/${type}`)
  },

  reportDetail(type: string, reportId: number): Promise<{ report: unknown; details: unknown[] }> {
    return request(`/reports/${type}/${reportId}`)
  },

  updateReport(type: string, reportId: number, data: any): Promise<{ message: string; report: any }> {
    return request(`/reports/${type}/${reportId}`, { method: 'PUT', body: JSON.stringify(data) })
  },

  async downloadReportPdf(type: string, reportId: number): Promise<void> {
    const token = getToken()
    const response = await fetch(`${BASE_URL}/reports/${type}/${reportId}/print?format=pdf`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    if (!response.ok) throw new Error('Print failed')
    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    window.open(url, '_blank')
  },

  createCubeReport(data: Record<string, unknown>): Promise<{ message: string }> {
    return request('/reports/cube', { method: 'POST', body: JSON.stringify(data) })
  },

  approveReport(reportId: number): Promise<{ message: string }> {
    return request(`/reports/${reportId}/approve`, { method: 'POST' })
  },

  cancelReport(reportId: number, remark?: string): Promise<{ message: string }> {
    return request(`/reports/${reportId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ cancel_remark: remark ?? '' }),
    })
  },

  assignReport(reportId: number, assignedTo: number): Promise<{ message: string; status: string }> {
    return request(`/reports/${reportId}/assign`, {
      method: 'POST',
      body: JSON.stringify({ assigned_to: assignedTo }),
    })
  },

  startTesting(reportId: number): Promise<{ message: string }> {
    return request(`/reports/${reportId}/start-testing`, { method: 'POST' })
  },

  generateReport(reportId: number): Promise<{ message: string }> {
    return request(`/reports/${reportId}/generate-report`, { method: 'POST' })
  },

  reportTimeline(reportId: number): Promise<{ data: Array<{ event: string; timestamp: string | null; icon: string; user?: string }> }> {
    return request(`/reports/${reportId}/timeline`)
  },

  myAssigned(): Promise<{ data: CubeReport[]; count: number }> {
    return request('/lab/assigned')
  },

  changePassword(data: { current_password: string; new_password: string; new_password_confirmation: string }): Promise<{ message: string }> {
    return request('/auth/change-password', { method: 'POST', body: JSON.stringify(data) })
  },

  notifications(): Promise<{ data: Array<{ id: number; type: string; title: string; message: string | null; data: Record<string, unknown> | null; read: boolean; created_at: string | null; time_ago: string | null }> }> {
    return request('/notifications')
  },

  unreadCount(): Promise<{ count: number }> {
    return request('/notifications/unread-count')
  },

  markNotificationRead(id: number): Promise<{ message: string }> {
    return request(`/notifications/${id}/read`, { method: 'POST' })
  },

  markAllNotificationsRead(): Promise<{ message: string }> {
    return request('/notifications/read-all', { method: 'POST' })
  },

  trackPing(): Promise<{ ok: boolean }> {
    return request('/track/ping', { method: 'POST' })
  },

  trackPage(page: string): Promise<{ ok: boolean }> {
    return request('/track/page', { method: 'POST', body: JSON.stringify({ page }) })
  },

  trackSummary(): Promise<{
    online_users: Array<{ id: number; name: string; last_activity_at: string }>
    online_count: number
    today_active_users: number
    today_activities: number
    user_activity_today: Array<{ id: number; name: string; today_actions: number }>
    today_reports_generated: number
    today_samples_registered: number
  }> {
    return request('/track/summary')
  },

  userActivity(userId?: number): Promise<{
    user: { id: number; name: string; username: string; is_active: boolean; is_admin: boolean; last_activity_at: string | null; online: boolean } | null
    activities: Array<{ id: number; action: string; module: string | null; details: string | null; ip_address: string | null; created_at: string | null; time_ago: string | null }>
    total_today: number
  }> {
    return request(`/track/user${userId ? `/${userId}` : ''}`)
  },

  search(q: string): Promise<{ data: Array<{ type: string; id: number; uid_no: string; title: string; subtitle: string; mobile: string | null }> }> {
    return request(`/search?q=${encodeURIComponent(q)}`)
  },

  invoices(params?: Record<string, string>): Promise<{ data: Invoice[]; total: number; current_page: number; last_page: number }> {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return request(`/invoices${qs}`)
  },

  invoice(id: number): Promise<{ data: Invoice }> {
    return request(`/invoices/${id}`)
  },

  createInvoice(data: Record<string, unknown>): Promise<{ message: string; data: Invoice }> {
    return request('/invoices', { method: 'POST', body: JSON.stringify(data) })
  },

  updateInvoice(id: number, data: Record<string, unknown>): Promise<{ message: string; data: Invoice }> {
    return request(`/invoices/${id}`, { method: 'PUT', body: JSON.stringify(data) })
  },

  deleteInvoice(id: number): Promise<{ message: string }> {
    return request(`/invoices/${id}`, { method: 'DELETE' })
  },

  printInvoice(id: number): Promise<{ html: string }> {
    return request(`/invoices/${id}/print`)
  },

  purchaseOrders(params?: Record<string, string>): Promise<{ data: PurchaseOrder[] }> {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return request(`/purchase-orders${qs}`)
  },

  purchaseOrder(id: number): Promise<{ data: PurchaseOrder }> {
    return request(`/purchase-orders/${id}`)
  },

  createPurchaseOrder(data: Record<string, unknown>): Promise<{ message: string; data: PurchaseOrder }> {
    return request('/purchase-orders', { method: 'POST', body: JSON.stringify(data) })
  },

  updatePurchaseOrder(id: number, data: Record<string, unknown>): Promise<{ message: string; data: PurchaseOrder }> {
    return request(`/purchase-orders/${id}`, { method: 'PUT', body: JSON.stringify(data) })
  },

  deletePurchaseOrder(id: number): Promise<{ message: string }> {
    return request(`/purchase-orders/${id}`, { method: 'DELETE' })
  },

  printPurchaseOrder(id: number): Promise<{ html: string }> {
    return request(`/purchase-orders/${id}/print`)
  },

  auditLogs(params?: Record<string, string>): Promise<{ data: AuditLogEntry[] }> {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return request(`/audit-logs${qs}`)
  },

  printReport(type: string, id: number): Promise<{ report: Record<string, unknown>; details: Record<string, unknown>[]; company: Record<string, unknown> | null }> {
    return request(`/reports/${type}/${id}/print`)
  },

  dueReports(params?: Record<string, string>): Promise<{ data: Array<{ iClientId: number; uid_no: string; received_date: string | null; agency_name: string; reporting_address: string; mobile_no: string; name_of_work: string; sample_details: string; total_payment: number; advance_payment: number; balance_dues: number; scan_copy: string | null; report_copy: string | null }> }> {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return request(`/due-reports${qs}`)
  },

  finalReports(params?: Record<string, string>): Promise<{ data: Array<{ iReportId: number; uid_no: string; create_date: string | null; agency_name: string; report_type: string; report_type_label: string; status: string; material_details: string | null; reference_no: string | null }> }> {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return request(`/final-reports${qs}`)
  },

  deleteFinalReport(id: number): Promise<{ message: string }> {
    return request(`/final-reports/${id}`, { method: 'DELETE' })
  },

  ulrLinks(): Promise<{ data: Array<{ id: number; uid_no: string; ulr_no: string; date: string; name_of_department: string; name_of_agency: string; name_of_project: string; sample_details: string; qty: string; parameters: string; testing_period: string; sample_received_date: string | null; report_dispatch_date: string | null; bill_details: string; signature_remark: string }> }> {
    return request('/ulr-links')
  },

  ulrLinksFiltered(params: Record<string, string>): Promise<{ data: Array<{ id: number; uid_no: string; ulr_no: string; date: string; name_of_department: string; name_of_agency: string; name_of_project: string; sample_details: string; qty: string; parameters: string; testing_period: string; sample_received_date: string | null; report_dispatch_date: string | null; bill_details: string; signature_remark: string }> }> {
    const qs = new URLSearchParams(params).toString()
    return request(`/ulr-links?${qs}`)
  },

  ulrLinksExport(params?: Record<string, string>): Promise<{ data: Array<{ id: number; uid_no: string; ulr_no: string; date: string; name_of_agency: string; name_of_project: string; sample_details: string }> }> {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return request(`/ulr-links/export${qs}`)
  },

  createUlrLink(data: Record<string, unknown>): Promise<{ message: string; ulr_no: string }> {
    return request('/ulr-links', { method: 'POST', body: JSON.stringify(data) })
  },

  updateUlrLink(id: number, data: Record<string, unknown>): Promise<{ message: string }> {
    return request(`/ulr-links/${id}`, { method: 'PUT', body: JSON.stringify(data) })
  },

  deleteUlrLink(id: number): Promise<{ message: string }> {
    return request(`/ulr-links/${id}`, { method: 'DELETE' })
  },

  ulrClientDetails(uid_no: string): Promise<{ data: { uid_no: string; agency_name: string; name_of_work: string; sample_details: string } | null }> {
    return request('/ulr-links/client-details', { method: 'POST', body: JSON.stringify({ uid_no }) })
  },

  stores(): Promise<{ data: Array<{ id: number; name: string; active: number }> }> {
    return request('/stores')
  },

  createStore(data: { name: string }): Promise<{ message: string }> {
    return request('/stores', { method: 'POST', body: JSON.stringify(data) })
  },

  updateStore(id: number, data: { name: string; active: number }): Promise<{ message: string }> {
    return request(`/stores/${id}`, { method: 'PUT', body: JSON.stringify(data) })
  },

  deleteStore(id: number): Promise<{ message: string }> {
    return request(`/stores/${id}`, { method: 'DELETE' })
  },

  searchCustomers(q: string): Promise<{ data: Array<{ iClientId: number; uid_no: string; agency_name: string; reporting_address: string; mobile_no: string; name_of_work: string }> }> {
    return request(`/registrations/search-customers?q=${encodeURIComponent(q)}`)
  },

  exportReports(type: string, startDate?: string, endDate?: string): Promise<{ data: Array<{ iReportId: number; uid_no: string; agency_name: string; material_details: string; status: string; create_date: string }> }> {
    const params = new URLSearchParams()
    if (startDate) params.set('start_date', startDate)
    if (endDate) params.set('end_date', endDate)
    const qs = params.toString() ? `?${params}` : ''
    return request(`/reports/${type}/export${qs}`)
  },

  dashboardCashSummary(): Promise<{ today_cash_total: number; today_received_total: number; month_cash_total: number }> {
    return request('/dashboard/cash-summary')
  },

  monthlyExpenses(): Promise<{ data: Array<{ category: string; total: number }> }> {
    return request('/expenses/monthly-summary')
  },

  reapproveReport(reportId: number): Promise<{ message: string; status: string }> {
    return request(`/reports/${reportId}/reapprove`, { method: 'POST' })
  },

  saveObservations(type: string, reportId: number, data: Record<string, unknown>): Promise<{ message: string }> {
    return request(`/reports/${type}/${reportId}/observations`, { method: 'POST', body: JSON.stringify(data) })
  },

  registrationHistory(id: number): Promise<{ data: Array<{ event: string; timestamp: string; icon: string; user?: string }>; uid_no: string }> {
    return request(`/registrations/${id}/history`)
  },

  uploadRegistrationScan(formData: FormData): Promise<{ message: string; path: string; url: string }> {
    const token = getToken()
    return fetch(`${BASE_URL}/registrations/upload-scan`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    }).then(r => r.json())
  },

  jobs(params?: Record<string, string>): Promise<{ data: Array<{ id: number; uid_no: string; title: string; status: string; current_stage: { name: string; slug: string; color: string } | null; assigned_to: number | null; created_at: string }> }> {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return request(`/jobs${qs}`)
  },

  jobByUid(uidNo: string): Promise<{ data: Array<{ id: number; uid_no: string; status: string; current_stage: { name: string; slug: string; color: string } | null }> }> {
    return request(`/jobs?search=${encodeURIComponent(uidNo)}&per_page=1`)
  },

  jobTimeline(jobId: number): Promise<{ data: Array<{ id: number; action: string; from_stage: { name: string } | null; to_stage: { name: string } | null; user: { name: string } | null; notes: string | null; created_at: string }> }> {
    return request(`/jobs/${jobId}/timeline`)
  },
}

export { getToken, setToken, request }
