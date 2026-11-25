import { BASE_URL, getToken, request as plainRequest } from './api'

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
  default_bcc: string
  shared?: boolean
  id?: number
  has_password?: boolean
}

export interface MailAccount {
  id: number
  email: string
  from_name: string
  /** Office mailbox for everyone with Mail access; otherwise the user's own */
  shared: boolean
  can_manage: boolean
  default_bcc: string
  unread: number | null
}

/** A mail on its way out */
export interface OutboxMail {
  id: number
  subject: string
  status: 'queued' | 'sending' | 'sent' | 'failed'
  error: string | null
  in_sent: boolean
  in_drafts: boolean
}

/** Server names that go with an email address (cPanel: mail.<domain>) */
export function mailServers(email: string): Pick<MailSettings, 'imap_host' | 'imap_port' | 'imap_encryption' | 'smtp_host' | 'smtp_port' | 'smtp_encryption'> {
  const domain = (email.split('@')[1] ?? '').trim().toLowerCase()
  const known: Record<string, [string, string]> = {
    'gmail.com': ['imap.gmail.com', 'smtp.gmail.com'],
    'googlemail.com': ['imap.gmail.com', 'smtp.gmail.com'],
    'yahoo.com': ['imap.mail.yahoo.com', 'smtp.mail.yahoo.com'],
    'yahoo.in': ['imap.mail.yahoo.com', 'smtp.mail.yahoo.com'],
    'yahoo.co.in': ['imap.mail.yahoo.com', 'smtp.mail.yahoo.com'],
    'zoho.com': ['imap.zoho.com', 'smtp.zoho.com'],
    'zoho.in': ['imap.zoho.in', 'smtp.zoho.in'],
    'icloud.com': ['imap.mail.me.com', 'smtp.mail.me.com'],
  }
  const [imap, smtp] = known[domain] ?? (domain.includes('.') ? [`mail.${domain}`, `mail.${domain}`] : ['', ''])
  const icloud = domain === 'icloud.com'
  return { imap_host: imap, imap_port: 993, imap_encryption: 'ssl', smtp_host: smtp, smtp_port: icloud ? 587 : 465, smtp_encryption: icloud ? 'tls' : 'ssl' }
}

/** The account the Mail page shows; goes with every request */
let openAccount: number | null = null
export const setOpenMailAccount = (id: number | null) => { openAccount = id }

const accountHeader = (): Record<string, string> => (openAccount ? { 'X-Mail-Account': String(openAccount) } : {})

const request = <T>(path: string, options: RequestInit = {}) => plainRequest<T>(path, { ...options, headers: { ...accountHeader(), ...options.headers } })

const q = (folder: string) => `folder=${encodeURIComponent(folder)}`

/** Multipart post (attachments) that tells how far the upload is, so it can't use the JSON request helper. */
function postForm<T>(path: string, form: FormData, fallback: string, onProgress?: (percent: number) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${BASE_URL}${path}`)
    const token = getToken()
    const headers: Record<string, string> = { Accept: 'application/json', ...accountHeader(), ...(token ? { Authorization: `Bearer ${token}` } : {}) }
    Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v))
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100)) }
    xhr.onerror = () => reject(new Error('The connection was lost while uploading. Nothing was sent; check the internet and try again.'))
    xhr.onload = () => {
      let payload: { message?: string } = {}
      try { payload = JSON.parse(xhr.responseText) } catch { /* not JSON: an error page of the server */ }
      if (xhr.status >= 200 && xhr.status < 300) { resolve(payload as T); return }
      reject(new Error(xhr.status === 413
        ? 'The attachments are too large to upload together. Remove some, or save the draft and add the rest.'
        : payload.message || `${fallback} (server error ${xhr.status}).`))
    }
    xhr.send(form)
  })
}

export const mailApi = {
  accounts: () => request<{ data: MailAccount[]; can_share: boolean; default_bcc: string }>('/mail/accounts'),
  account: (id: number) => request<{ data: MailSettings }>(`/mail/accounts/${id}`),
  addAccount: (data: MailSettings & { shared: boolean }) => request<{ data: MailSettings }>('/mail/accounts', { method: 'POST', body: JSON.stringify(data) }),
  saveAccount: (id: number, data: MailSettings) => request<{ data: MailSettings }>(`/mail/accounts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  removeAccount: (id: number) => request(`/mail/accounts/${id}`, { method: 'DELETE' }),
  unread: (fresh = false) => request<{ configured: boolean; unread: number | null }>(`/mail/unread${fresh ? '?fresh=1' : ''}`),
  access: () => request<{ data: MailAccessUser[] }>('/mail/access'),
  setAccess: (userId: number, enabled: boolean, defaults: string[], module: 'mail' | 'documents_site' | 'quotation_approve' | 'report_approve' | 'bill_approve' | 'leave_approve' = 'mail') =>
    request<{ data: { id: number; allowed_modules: string[] } }>(`/mail/access/${userId}`, { method: 'PUT', body: JSON.stringify({ enabled, defaults, module }) }),
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

  /** Takes the mail into the outbox; runOutbox() then sends it */
  send: (form: FormData, onProgress?: (percent: number) => void) =>
    postForm<{ data: OutboxMail }>('/mail/send', form, 'The mail could not be uploaded. Nothing was sent', onProgress).then((r) => r.data),
  runOutbox: (id: number) => request<{ data: OutboxMail }>(`/mail/outbox/${id}/run`, { method: 'POST' }).then((r) => r.data),
  outbox: (id: number) => request<{ data: OutboxMail }>(`/mail/outbox/${id}`).then((r) => r.data),
  saveDraft: (form: FormData, onProgress?: (percent: number) => void) =>
    postForm<{ data: { uid: number | null; folder: string; attachments: MailAttachment[] } }>('/mail/drafts', form, 'Could not save the draft', onProgress).then((r) => r.data),

  async downloadAttachment(folder: string, uid: number, part: string, name: string): Promise<void> {
    const token = getToken()
    const response = await fetch(`${BASE_URL}/mail/messages/${uid}/attachments/${part}?${q(folder)}`, {
      headers: { ...accountHeader(), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
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

const addressOf = (part: string) => (part.match(/<([^>]+)>/)?.[1] ?? part).trim().toLowerCase()
const addressList = (list: string) => list.split(/[,;]+(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((p) => p.trim()).filter(Boolean)

/** The account's Bcc without those who get the mail anyway, and without the account itself */
export function defaultBcc(account: Pick<MailAccount, 'email' | 'default_bcc'>, ...others: string[]): string {
  const taken = new Set([account.email.toLowerCase(), ...others.flatMap(addressList).map(addressOf)])
  return addressList(account.default_bcc).filter((p) => !taken.has(addressOf(p))).join(', ')
}
