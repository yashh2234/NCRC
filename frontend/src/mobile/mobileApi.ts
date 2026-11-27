import { useCallback, useEffect, useState } from 'react'
import { request } from '../lib/api'

export interface ApprovalItem {
  key: string
  kind: 'leave' | 'attendance' | 'quotation' | 'bill' | 'credit_note' | 'performa' | 'report'
  id: number
  module: string
  title: string
  detail: string
  since: string | null
  since_human: string | null
  quick: boolean
}

export const approvalsApi = {
  list: () => request<{ data: ApprovalItem[]; counts: Record<string, number>; unread_notifications: number }>('/mobile/approvals'),
}

/** Tabs between Home and More */
export const MAX_TABS = 3

export const appPrefsApi = {
  get: () => request<{ data: { tabs: string[] | null } }>('/mobile/prefs'),
  save: (tabs: string[]) => request<{ data: { tabs: string[] } }>('/mobile/prefs', { method: 'PUT', body: JSON.stringify({ tabs }) }),
}

/** The user's bottom bar tabs: kept on the server (same on every phone), cached here so the bar shows at once. null = not chosen yet */
export function useBarTabs(userId: number): [string[] | null, (tabs: string[]) => Promise<void>] {
  const cacheKey = `m_tabs_${userId}`
  const [tabs, setTabs] = useState<string[] | null>(() => {
    try { return JSON.parse(localStorage.getItem(cacheKey) ?? 'null') } catch { return null }
  })
  useEffect(() => {
    if (!userId) return
    appPrefsApi.get().then((r) => {
      setTabs(r.data.tabs)
      if (r.data.tabs) localStorage.setItem(cacheKey, JSON.stringify(r.data.tabs))
      else localStorage.removeItem(cacheKey)
    }).catch(() => undefined)
  }, [userId, cacheKey])
  const save = useCallback(async (next: string[]) => {
    const r = await appPrefsApi.save(next.slice(0, MAX_TABS))
    setTabs(r.data.tabs)
    localStorage.setItem(cacheKey, JSON.stringify(r.data.tabs))
  }, [cacheKey])
  return [tabs, save]
}
