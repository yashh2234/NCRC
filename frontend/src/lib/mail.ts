import { BASE_URL, getToken, request } from './api'

export interface MailAddress { name: string; email: string }

export interface MailAccessUser {
  id: number
  name: string
  username: string
  email: string
  is_admin: boolean
  is_active: boolean
  tracker_role: string
  allowed_modules: string[] | null
}

export interface MailFolder {
  path: string
  name: string
  depth: number
  role: 'inbox' | 'sent' | 'drafts' | 'archive' | 'junk' | 'trash' | 'other'
  unread: number | null
  total: number | null
}

export interface MailSummary {
  uid: number
  subject: string
  from: MailAddress | null
  to_first: MailAddress | null
  date: string | null
  seen: boolean
  flagged: boolean
  answered: boolean
  has_attachment: boolean
}

export type MailFilter = '' | 'unread' | 'starred'

/** `part` is the attachment's place in the mail, e.g. "2" or "1.3" */
export interface MailAttachment { part: string; name: string; size: number; type: string | null }

export interface MailMessage extends MailSummary {
  to: MailAddress[]
  cc: MailAddress[]
  bcc: MailAddress[]
  reply_to: MailAddress[]
  html: string | null
  text: string
  attachments: MailAttachment[]
}

export interface MailSettings {
  email: string
  from_name: string
  username: string
  password?: string
  imap_host: string
  imap_port: number
  imap_encryption: 'ssl' | 'tls' | 'none'
  smtp_host: string
  smtp_port: number
  smtp_encryption: 'ssl' | 'tls' | 'none'
  sent_folder: string
  has_password?: boolean
}

/** The office mailbox's cPanel details (mail.namotech.in, SSL), used to pre-fill the setup form. */
export const DEFAULT_MAIL_SETTINGS: MailSettings = {
  email: 'info@namotech.in',
  from_name: 'Namotech',
  username: 'info@namotech.in',
  password: '',
  imap_host: 'mail.namotech.in',
  imap_port: 993,
  imap_encryption: 'ssl',
  smtp_host: 'mail.namotech.in',
  smtp_port: 465,
  smtp_encryption: 'ssl',
  sent_folder: '',
}

const q = (folder: string) => `folder=${encodeURIComponent(folder)}`

/** Multipart post (attachments), so it can't use the JSON request helper. */
async function postForm<T>(path: string, form: FormData, fallback: string): Promise<T> {
  const token = getToken()
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    body: form,
    headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(response.status === 413 ? 'The attachments are too large to upload together. Remove some and try again.' : payload.message ?? fallback)
  }
  return payload as T
}

export const mailApi = {
  status: () => request<{ configured: boolean; email: string | null; can_configure: boolean }>('/mail/status'),
  unread: (fresh = false) => request<{ configured: boolean; unread: number | null }>(`/mail/unread${fresh ? '?fresh=1' : ''}`),
  access: () => request<{ data: MailAccessUser[] }>('/mail/access'),
  setAccess: (userId: number, enabled: boolean, defaults: string[]) =>
    request<{ data: { id: number; allowed_modules: string[] } }>(`/mail/access/${userId}`, { method: 'PUT', body: JSON.stringify({ enabled, defaults }) }),
  settings: () => request<{ data: MailSettings | null }>('/mail/settings'),
  saveSettings: (data: MailSettings) => request<{ data: MailSettings }>('/mail/settings', { method: 'PUT', body: JSON.stringify(data) }),
  folders: () => request<{ data: MailFolder[] }>('/mail/folders'),
  messages: (folder: string, page: number, search: string, filter: MailFilter) =>
    request<{ data: MailSummary[]; total: number; page: number; per_page: number }>(
      `/mail/messages?${q(folder)}&page=${page}${search ? `&search=${encodeURIComponent(search)}` : ''}${filter ? `&filter=${filter}` : ''}`,
    ),
  message: (folder: string, uid: number) => request<{ data: MailMessage }>(`/mail/messages/${uid}?${q(folder)}`),
  remove: (folder: string, uid: number) => request(`/mail/messages/${uid}?${q(folder)}`, { method: 'DELETE' }),
  setFlags: (folder: string, uid: number, flags: { seen?: boolean; flagged?: boolean }) =>
    request(`/mail/messages/${uid}/flags?${q(folder)}`, { method: 'POST', body: JSON.stringify(flags) }),
  move: (folder: string, uid: number, to: string) =>
    request<{ folder: string }>(`/mail/messages/${uid}/move?${q(folder)}`, { method: 'POST', body: JSON.stringify({ to }) }),

  send: (form: FormData) => postForm<{ saved?: boolean }>('/mail/send', form, 'Could not send the mail'),
  saveDraft: (form: FormData) =>
    postForm<{ data: { uid: number | null; folder: string; attachments: MailAttachment[] } }>('/mail/drafts', form, 'Could not save the draft').then((r) => r.data),

  async downloadAttachment(folder: string, uid: number, part: string, name: string): Promise<void> {
    const token = getToken()
    const response = await fetch(`${BASE_URL}/mail/messages/${uid}/attachments/${part}?${q(folder)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!response.ok) throw new Error('Could not download the attachment')
    const url = URL.createObjectURL(await response.blob())
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  },
}

export function formatAddress(a: MailAddress | null | undefined) {
  if (!a) return ''
  if (!a.name) return a.email
  // A name with a comma must be quoted, or it reads as two addresses
  const name = /[,;<>"]/.test(a.name) ? `"${a.name.replace(/["<>]/g, '')}"` : a.name
  return `${name} <${a.email}>`
}

export function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/** Today: time; this year: "12 Nov"; older: "12 Nov 2024". */
export function formatMailDate(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('en-IN', d.getFullYear() === now.getFullYear() ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Thunderbird-style list date: time today, weekday this week, else dd/mm/yyyy hh:mm. */
export function formatListDate(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  if (d.toDateString() === now.toDateString()) return time
  const days = (now.getTime() - d.getTime()) / 86400000
  if (days < 7 && days > 0) return `${d.toLocaleDateString('en-IN', { weekday: 'short' })} ${time}`
  return `${d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })} ${time}`
}
