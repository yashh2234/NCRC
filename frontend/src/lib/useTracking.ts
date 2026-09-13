import { useEffect, useRef } from 'react'
import { useAuth } from './auth'
import { api } from './api'

export function useTracking(page?: string) {
  const { user } = useAuth()
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!user) return

    if (page) {
      api.trackPage(page).catch(() => {})
    }

    intervalRef.current = setInterval(() => {
      api.trackPing().catch(() => {})
    }, 30000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [user?.id, page])
}
