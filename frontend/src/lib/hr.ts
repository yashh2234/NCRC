/** Attendance, time in the software, leave and the holiday calendar: types, API calls and formatting. */
import { request } from './api'

const ZONE = 'Asia/Kolkata'

export type DayStatus = 'present' | 'leave' | 'half_leave' | 'on_duty' | 'holiday' | 'weekly_off' | 'absent' | 'not_in' | 'future' | 'none'

export interface LeaveOnDay { code: string; name: string; color: string; half: string | null; counts_present: boolean }

export interface AttendanceDay {
  date: string
  status: DayStatus
  off: 'holiday' | 'weekly_off' | null
  off_name: string | null
  leave: LeaveOnDay | null
  in: string | null
  out: string | null
  seconds: number
  auto_closed: boolean
  /** The check out time was typed by the user the next day */
  out_entered?: boolean
  corrected: boolean
  no_location: boolean
  active: number
  idle: number
}

export interface PunchPlace { lat: number | null; lng: number | null; accuracy: number | null; note: string | null; ip: string | null; meters: number | null; at_office: boolean | null; /** A photo was taken with the punch (phone app) */ selfie?: boolean }

export interface Spell {
  id: number
  date: string
  check_in_at: string
  check_out_at: string | null
  in: PunchPlace
  out: PunchPlace | null
  auto_closed: boolean
  /** The check out time was typed by the user the next day */
  out_entered?: boolean
  corrected: boolean
}

export interface AttendanceStatus {
  date: string
  checked_in: boolean
  seconds: number
  spells: Spell[]
  forgot_on: string | null
  /** false for users who are not in the attendance lists */
  kept: boolean
  /** A working day and not checked in yet: the check in popup shows and cannot be closed */
  must_check_in?: boolean
  /** An earlier day without a check out: its time is typed before checking in */
  missed_out?: { id: number; date: string; check_in_at: string } | null
}

export interface Correction {
  id: number
  user_id: number
  user_name: string | null
  date: string
  check_in_at: string
  check_out_at: string | null
  reason: string
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  remark: string | null
  decided_by: string | null
  created_at: string | null
  recorded?: Spell[]
}

export interface LeaveBalance {
  leave_type_id: number
  name: string
  code: string
  color: string
  active: boolean
  granted: boolean
  counts_present: boolean
  quota: number | null
  own_quota: number | null
  taken: number
  pending: number
  left: number | null
}

export interface LeaveType {
  id: number
  name: string
  code: string
  color: string
  yearly_days: number | null
  granted: boolean
  counts_present: boolean
  active: boolean
}

export interface LeaveRequest {
  id: number
  user_id: number
  user_name?: string
  leave_type_id: number
  type: string
  code: string
  color: string
  from_date: string
  to_date: string
  half: 'first' | 'second' | null
  days: number
  reason: string
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  remark: string | null
  decided_by: string | null
  decided_at: string | null
  created_at: string | null
  left_after?: number | null
  also_away?: string[]
}

export interface LeaveInput { leave_type_id: number; from_date: string; to_date: string; half: 'first' | 'second' | null; reason: string }

export interface Holiday { id: number; date: string; name: string; type: 'holiday' | 'optional'; tentative: boolean; picked: boolean }

export interface HolidayYear {
  year: number
  today: string
  holidays: Holiday[]
  weekly_off: string[]
  away: Record<string, Array<{ name: string; half: boolean }>>
  birthdays: Array<{ date: string; name: string }>
  optional_limit: number
  optional_used: number
}

export interface TeamUserDay { user_id: number; name: string; online: boolean; last_seen: string | null; day: AttendanceDay; spells: Spell[] }
export interface RegisterUser { user_id: number; name: string; days: AttendanceDay[] }
export interface UsageUser { user_id: number; name: string; active: number; idle: number; days: number; worked: number; last_active_at: string | null; modules: Array<{ module: string; seconds: number }> }
export interface UserDetail {
  user_id: number
  name: string
  days: Array<AttendanceDay & { first_at: string | null; last_active_at: string | null }>
  spells: Spell[]
  modules: Array<{ module: string; seconds: number }>
  actions: Array<{ id: number; action: string; module: string | null; details: string | null; created_at: string | null }>
}
export interface LoginRow { id: number; user_id: number; name: string; device: string; ip: string | null; logged_in_at: string | null; last_seen_at: string | null; logged_out_at: string | null; signed_in: boolean; this_one: boolean }
export interface FailedLoginRow { id: number; email: string; name: string | null; device: string; ip: string | null; created_at: string }
export interface HrSettings {
  weekly_off: number[]
  saturdays_off: number[]
  optional_limit: number
  hidden_users: number[]
  office_lat: number | null
  office_lng: number | null
  office_radius: number
  daily_summary: boolean
  /** HH:MM; checking in after it is "late" for the admins */
  office_start: string
}

const json = (method: string, body?: unknown): RequestInit => ({ method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
const data = <T>(promise: Promise<{ data: T }>) => promise.then((r) => r.data)

export const hrApi = {
  status: () => data(request<{ data: AttendanceStatus }>('/attendance/status')),
  punch: (body: { action: 'in' | 'out'; lat?: number; lng?: number; accuracy?: number; note?: string; /** data URL from the phone camera */ selfie?: string; /** HH:MM left on the day without a check out */ missed_out?: string }) => data(request<{ data: Spell }>('/attendance/punch', json('POST', body))),
  month: (month: string) => data(request<{ data: { days: AttendanceDay[]; spells: Spell[]; corrections: Correction[] } }>(`/attendance/month?month=${month}`)),
  requestCorrection: (body: { date: string; check_in: string; check_out: string; reason: string }) => data(request<{ data: Correction }>('/attendance/corrections', json('POST', body))),
  withdrawCorrection: (id: number) => request<{ message: string }>(`/attendance/corrections/${id}`, json('DELETE')),

  leave: (year: number) => data(request<{ data: { balances: LeaveBalance[]; requests: LeaveRequest[] } }>(`/leave?year=${year}`)),
  leaveDays: (from: string, to: string, half: string | null) => request<{ days: number }>(`/leave/preview?from_date=${from}&to_date=${to}${half ? `&half=${half}` : ''}`).then((r) => r.days),
  applyLeave: (body: LeaveInput) => data(request<{ data: LeaveRequest }>('/leave', json('POST', body))),
  cancelLeave: (id: number) => data(request<{ data: LeaveRequest }>(`/leave/${id}/cancel`, json('POST'))),
  teamLeave: (year: number) => data(request<{ data: LeaveRequest[] }>(`/leave/team?year=${year}`)),
  decideLeave: (id: number, approve: boolean, remark: string) => data(request<{ data: LeaveRequest }>(`/leave/${id}/decide`, json('POST', { approve, remark: remark || null }))),
  teamBalances: (year: number) => request<{ types: LeaveType[]; data: Array<{ user_id: number; name: string; balances: LeaveBalance[] }> }>(`/leave/team-balances?year=${year}`),
  setQuota: (body: { user_id: number; leave_type_id: number; year: number; days: number | null }) => data(request<{ data: LeaveBalance[] }>('/leave/quota', json('PUT', body))),
  saveLeaveType: (id: number | null, body: Omit<LeaveType, 'id'>) => data(request<{ data: LeaveType }>(id ? `/leave/types/${id}` : '/leave/types', json(id ? 'PUT' : 'POST', body))),

  holidays: (year: number) => data(request<{ data: HolidayYear }>(`/holidays?year=${year}`)),
  saveHoliday: (id: number | null, body: { date: string; name: string; type: string; tentative: boolean }) => data(request<{ data: Holiday }>(id ? `/holidays/${id}` : '/holidays', json(id ? 'PUT' : 'POST', body))),
  deleteHoliday: (id: number) => request<{ message: string }>(`/holidays/${id}`, json('DELETE')),
  pickHoliday: (id: number, on: boolean) => request<{ message: string }>(`/holidays/${id}/pick`, json('POST', { on })),

  today: (date: string) => data(request<{ data: { date: string; users: TeamUserDay[]; corrections: number } }>(`/team/today${date ? `?date=${date}` : ''}`)),
  register: (month: string) => data(request<{ data: { from: string; to: string; users: RegisterUser[] } }>(`/team/register?month=${month}`)),
  usage: (from: string, to: string) => data(request<{ data: UsageUser[] }>(`/team/usage?from=${from}&to=${to}`)),
  work: (from: string, to: string) => data(request<{ data: { columns: string[]; users: Array<{ user_id: number; name: string; attendance: boolean; counts: Record<string, number> }> } }>(`/team/work?from=${from}&to=${to}`)),
  user: (id: number, from: string, to: string) => data(request<{ data: UserDetail }>(`/team/users/${id}?from=${from}&to=${to}`)),
  logins: (from: string, to: string) => data(request<{ data: { sessions: LoginRow[]; failed: FailedLoginRow[] } }>(`/team/logins?from=${from}&to=${to}`)),
  signOutSession: (id: number) => request<{ message: string }>(`/team/sessions/${id}/sign-out`, json('POST')),
  signOutUser: (id: number) => request<{ message: string }>(`/team/users/${id}/sign-out`, json('POST')),
  corrections: () => data(request<{ data: Correction[] }>('/team/corrections')),
  decideCorrection: (id: number, approve: boolean, remark: string) => request<{ message: string }>(`/team/corrections/${id}`, json('POST', { approve, remark: remark || null })),
  settings: () => request<{ data: HrSettings; users: Array<{ id: number; name: string }> }>('/team/settings'),
  saveSettings: (body: HrSettings) => data(request<{ data: HrSettings }>('/team/settings', json('PUT', body))),
}

// ─── Dates and times (Indian) ────────────────────────────────────────────

/** Today in India, yyyy-mm-dd */
export const todayIso = () => new Date().toLocaleDateString('en-CA', { timeZone: ZONE })
export const thisMonth = () => todayIso().slice(0, 7)

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** 2026-11-26 → 26-11-2026 */
export const dmy = (iso: string | null | undefined) => (iso ? iso.slice(0, 10).split('-').reverse().join('-') : '-')

const part = (iso: string, options: Intl.DateTimeFormatOptions) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { ...options, timeZone: 'UTC' })
export const weekday = (iso: string) => part(iso, { weekday: 'short' })
export const monthName = (month: string) => part(`${month}-01`, { month: 'long', year: 'numeric' })

/** 09:32 am */
export function clock(iso: string | null | undefined): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleTimeString('en-IN', { timeZone: ZONE, hour: '2-digit', minute: '2-digit', hour12: true })
}

/** 09:32 (24 hours, for a time box) */
export function clock24(iso: string | null | undefined): string {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('en-GB', { timeZone: ZONE, hour: '2-digit', minute: '2-digit' })
}

/** 26-11-2026 09:32 am */
export const stamp = (iso: string | null | undefined) => (iso ? `${dmy(new Date(iso).toLocaleDateString('en-CA', { timeZone: ZONE }))} ${clock(iso)}` : '-')

/** 27000 → 7h 30m */
export function duration(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  if (minutes < 1) return seconds > 0 ? '<1m' : '0m'
  const h = Math.floor(minutes / 60)
  return h ? `${h}h ${String(minutes % 60).padStart(2, '0')}m` : `${minutes}m`
}

/** 7.5 → "7.5", 3 → "3" */
export const num = (n: number) => String(Math.round(n * 10) / 10)

// ─── Labels ──────────────────────────────────────────────────────────────

export const DAY_STATUS: Record<DayStatus, { label: string; code: string; color: string; background: string }> = {
  present: { label: 'Present', code: 'P', color: '#15803d', background: '#dcfce7' },
  leave: { label: 'On leave', code: 'L', color: '#1d4ed8', background: '#dbeafe' },
  half_leave: { label: 'Half day leave', code: '½L', color: '#1d4ed8', background: '#eff6ff' },
  on_duty: { label: 'On duty', code: 'OD', color: '#0e7490', background: '#cffafe' },
  holiday: { label: 'Holiday', code: 'H', color: '#b45309', background: '#fef3c7' },
  weekly_off: { label: 'Weekly off', code: 'WO', color: '#64748b', background: '#f1f5f9' },
  absent: { label: 'Absent', code: 'A', color: '#b91c1c', background: '#fee2e2' },
  not_in: { label: 'Not checked in', code: '–', color: '#b45309', background: '#fffbeb' },
  future: { label: '', code: '', color: '#94a3b8', background: 'transparent' },
  none: { label: 'Not kept', code: '·', color: '#94a3b8', background: 'transparent' },
}

/** What the register shows for a day: P, CL, ½CL+P, H … */
export function dayCode(d: AttendanceDay): string {
  if (d.status === 'leave') return d.leave?.code ?? 'L'
  if (d.status === 'half_leave') return `½${d.leave?.code ?? 'L'}`
  if (d.status === 'on_duty') return d.leave?.code ?? 'OD'
  if (d.status === 'present') return d.leave?.half ? `P ½${d.leave.code}` : d.off ? `P/${d.off === 'holiday' ? 'H' : 'WO'}` : 'P'
  return DAY_STATUS[d.status].code
}

export const REQUEST_STATUS = {
  pending: { label: 'Waiting', color: '#b45309', background: '#fef3c7' },
  approved: { label: 'Approved', color: '#15803d', background: '#dcfce7' },
  rejected: { label: 'Not approved', color: '#b91c1c', background: '#fee2e2' },
  cancelled: { label: 'Cancelled', color: '#64748b', background: '#f1f5f9' },
} as const

const MODULE_NAMES: Record<string, string> = {
  dashboard: 'Dashboard', inquiries: 'Enquiries', proposals: 'Proposals', tenders: 'Tenders', registrations: 'Client Registrations', quotations: 'Quotations',
  work_orders: 'Work Orders', outsource: 'Outsource', ulr_add: 'Add ULR', ulr_register: 'ULR Register', reports: 'Lab Reports', final_reports: 'Final Reports',
  billing: 'Invoice', performa: 'Performa Invoice', credit_notes: 'Credit Note', due_reports: 'UID w/o Report', expenses: 'Daily Expenses', purchase_orders: 'Purchase Order',
  admin: 'Administration', mail: 'Mail', my_attendance: 'My Attendance', leave: 'Leave', holidays: 'Holiday Calendar', team: 'Team Attendance',
}
export const moduleName = (key: string) => MODULE_NAMES[key] ?? key.replace(/_/g, ' ')

export const mapUrl = (p: PunchPlace) => (p.lat !== null && p.lng !== null ? `https://www.google.com/maps?q=${p.lat},${p.lng}` : '')

/** "At office" / "1.2 km from office" / "Location" */
export function placeText(p: PunchPlace): string {
  if (p.lat === null) return p.note ? 'No location' : '-'
  if (p.at_office) return 'At office'
  if (p.meters !== null) return p.meters < 1000 ? `${p.meters} m from office` : `${(p.meters / 1000).toFixed(1)} km from office`
  return 'Location'
}

// ─── Location of the device ──────────────────────────────────────────────

export interface DevicePlace { lat: number; lng: number; accuracy: number }

/** Asks the browser for the location; rejects with a message for the user. */
export function locate(): Promise<DevicePlace> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('This browser cannot give the location.')); return }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ lat: coords.latitude, lng: coords.longitude, accuracy: Math.round(coords.accuracy) }),
      (e) => reject(new Error(e.code === e.PERMISSION_DENIED ? 'The location is blocked for this site. Allow it in the browser (lock icon next to the address).' : 'The location could not be found.')),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    )
  })
}

// ─── Excel (CSV) ─────────────────────────────────────────────────────────

export function downloadCsv(name: string, rows: Array<Array<string | number>>): void {
  // A leading = + - @ would be run as a formula by Excel
  const cell = (v: string | number) => `"${(typeof v === 'string' && /^[=+\-@]/.test(v) ? `'${v}` : String(v)).replace(/"/g, '""')}"`
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([`${String.fromCharCode(0xfeff)}${rows.map((r) => r.map(cell).join(',')).join('\r\n')}`], { type: 'text/csv' }))
  a.download = `${name}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}
