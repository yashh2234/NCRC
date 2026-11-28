/**
 * The installable app: service worker, phone notifications (Web Push), the "Install app" prompt,
 * and opening the right screen from a tapped notification.
 */
import { useEffect, useState, useSyncExternalStore } from 'react'
import { request } from './api'

// ─── Service worker ──────────────────────────────────────────────────

const SW_SUPPORTED = typeof navigator !== 'undefined' && 'serviceWorker' in navigator

/** Production only: in development Vite serves changing files and a cache would only get in the way */
export function registerServiceWorker(): void {
  if (!SW_SUPPORTED || !import.meta.env.PROD) return
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined)
  })
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!SW_SUPPORTED) return null
  // Development: register on demand so notifications can be tried locally too
  const existing = await navigator.serviceWorker.getRegistration()
  if (existing) return existing
  try {
    await navigator.serviceWorker.register('/sw.js')
    return await navigator.serviceWorker.ready
  } catch {
    return null
  }
}

// ─── Running as an installed app ─────────────────────────────────────

export const isStandalone = (): boolean =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true

export const isIos = (): boolean => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

// ─── Install prompt (Android / desktop Chrome, Edge) ─────────────────

interface InstallPromptEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

let deferredPrompt: InstallPromptEvent | null = null
const installListeners = new Set<() => void>()
const notifyInstall = () => installListeners.forEach((fn) => fn())

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e as InstallPromptEvent
    notifyInstall()
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    notifyInstall()
  })
}

/** 'prompt' = can show the install dialog, 'ios' = show the Share › Add to Home Screen steps, null = installed or not possible */
export function useInstallState(): 'prompt' | 'ios' | null {
  const canPrompt = useSyncExternalStore(
    (fn) => { installListeners.add(fn); return () => installListeners.delete(fn) },
    () => deferredPrompt !== null,
  )
  if (isStandalone()) return null
  if (canPrompt) return 'prompt'
  return isIos() ? 'ios' : null
}

export async function promptInstall(): Promise<boolean> {
  if (!deferredPrompt) return false
  await deferredPrompt.prompt()
  const { outcome } = await deferredPrompt.userChoice
  deferredPrompt = null
  notifyInstall()
  return outcome === 'accepted'
}

// ─── Online / offline ────────────────────────────────────────────────

export function useOnline(): boolean {
  return useSyncExternalStore(
    (fn) => {
      window.addEventListener('online', fn)
      window.addEventListener('offline', fn)
      return () => { window.removeEventListener('online', fn); window.removeEventListener('offline', fn) }
    },
    () => navigator.onLine,
  )
}

// ─── Phone notifications ─────────────────────────────────────────────

export interface PushPrefs { categories: Record<string, boolean>; /** One switch per kind: check ins, new enquiries, reminders… */ kinds: Record<string, boolean>; quiet_from: string | null; quiet_to: string | null }
export interface PushKind { key: string; label: string; /** Attendance, New work, Reminders */ group: string }
export interface PushConfig { public_key: string | null; prefs: PushPrefs; categories: Array<{ key: string; label: string }>; kinds: PushKind[]; devices: number }

export const pushApi = {
  config: () => request<PushConfig>('/push/config'),
  savePrefs: (prefs: PushPrefs) => request<{ prefs: PushPrefs }>('/push/prefs', { method: 'PUT', body: JSON.stringify(prefs) }),
  test: () => request<{ message: string }>('/push/test', { method: 'POST' }),
}

export const PUSH_SUPPORTED = SW_SUPPORTED && typeof window !== 'undefined' && 'PushManager' in window && 'Notification' in window

/** 'on' = this device gets notifications, 'off' = can be turned on, 'blocked' = denied in the browser, 'unsupported' (iPhone outside the installed app, old browsers) */
export type PushState = 'on' | 'off' | 'blocked' | 'unsupported'

export async function pushState(): Promise<PushState> {
  if (!PUSH_SUPPORTED) return 'unsupported'
  if (Notification.permission === 'denied') return 'blocked'
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  return sub && Notification.permission === 'granted' ? 'on' : 'off'
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const padded = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

/** Asks the browser for permission (must be called from a tap) and registers this device with the server */
export async function enablePush(publicKey: string): Promise<PushState> {
  if (!PUSH_SUPPORTED) return 'unsupported'
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission === 'denied' ? 'blocked' : 'off'
  const reg = await registration()
  if (!reg) throw new Error('This browser could not start the app service. Reload and try again.')
  let sub = await reg.pushManager.getSubscription()
  // Made with another server key: start again
  const current = sub?.options.applicationServerKey
  if (sub && current && btoa(String.fromCharCode(...new Uint8Array(current))) !== btoa(String.fromCharCode(...keyBytes(publicKey)))) {
    await sub.unsubscribe()
    sub = null
  }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) })
  await request('/push/subscribe', { method: 'POST', body: JSON.stringify(sub.toJSON()) })
  return 'on'
}

export async function disablePush(): Promise<PushState> {
  const reg = await navigator.serviceWorker?.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (sub) {
    await request('/push/unsubscribe', { method: 'POST', body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => undefined)
    await sub.unsubscribe()
  }
  return 'off'
}

/** Logging out: this phone should no longer get the user's notifications */
export async function forgetPushDevice(): Promise<void> {
  try { await disablePush() } catch { /* nothing to undo */ }
}

export function usePushState(): [PushState | null, (s: PushState) => void] {
  const [state, setState] = useState<PushState | null>(null)
  useEffect(() => { void pushState().then(setState) }, [])
  return [state, setState]
}

export function setAppBadge(count: number): void {
  const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> }
  if (!nav.setAppBadge) return
  ;(count > 0 ? nav.setAppBadge(count) : nav.clearAppBadge?.())?.catch(() => undefined)
}

// ─── Opening a screen from a notification ────────────────────────────

/** Where a notification of a type is looked at (the same as the bell list on the computer) */
export function moduleForNotification(type: string, isAdmin: boolean): string | null {
  const map: Record<string, string> = {
    quotation_approval: 'quotations', bill_approval: 'billing', credit_note_approval: 'credit_notes', performa_approval: 'performa',
    approval_needed: 'reports', leave: 'leave', attendance: isAdmin ? 'team' : 'my_attendance', company_knowledge: 'admin',
    inquiry_handover: 'inquiries', new_mail: 'mail', mail_failed: 'mail', tender_analysis: 'tenders',
    job: 'registrations', job_assigned: 'registrations', registration: 'registrations', stage_transition: 'registrations',
    auto_transition: 'registrations', due_date_overdue: 'registrations', report: 'reports',
  }
  if (type.startsWith('sla_')) return 'registrations'
  // Admins: check ins / outs of the team, and new work in the office (activity_<page>)
  if (type.startsWith('team_')) return 'team'
  if (type.startsWith('activity_')) return type.slice('activity_'.length)
  // Morning reminders
  const reminder: Record<string, string> = { remind_followup: 'inquiries', remind_tender: 'tenders', remind_invoice: 'billing', remind_report: 'reports' }
  if (reminder[type]) return reminder[type]
  if (type.startsWith('vendor_')) return 'outsource'
  return map[type] ?? null
}

export interface DeepLink { notificationId: number | null; type: string | null; tab: string | null; punch: boolean }

export function readDeepLink(href: string = window.location.href): DeepLink {
  const url = new URL(href, window.location.origin)
  const id = Number(url.searchParams.get('nid'))
  return {
    notificationId: id > 0 ? id : null,
    type: url.searchParams.get('ntype'),
    tab: url.searchParams.get('tab'),
    punch: url.searchParams.get('punch') === '1',
  }
}

/** Takes ?nid=…&tab=… off the address so a reload does not open it again */
export function clearDeepLink(): void {
  const url = new URL(window.location.href)
  let changed = false
  for (const key of ['nid', 'ntype', 'tab', 'punch', 'source']) if (url.searchParams.has(key)) { url.searchParams.delete(key); changed = true }
  if (changed) window.history.replaceState(null, '', url.pathname + url.search + url.hash)
}

/** A notification tapped while the app was already open */
export function onServiceWorkerMessage(handler: (msg: { type: string; url?: string; payload?: unknown }) => void): () => void {
  if (!SW_SUPPORTED) return () => undefined
  const fn = (e: MessageEvent) => { if (e.data && typeof e.data === 'object') handler(e.data) }
  navigator.serviceWorker.addEventListener('message', fn)
  return () => navigator.serviceWorker.removeEventListener('message', fn)
}
