import { useEffect } from 'react'
import { useAuth } from './auth'
import { api, getToken } from './api'

/** Notes that a page was opened. */
export function useTracking(page?: string) {
  const { user } = useAuth()
  useEffect(() => {
    if (user && page) api.trackPage(page).catch(() => {})
  }, [user?.id, page]) // eslint-disable-line react-hooks/exhaustive-deps
}

const PING_MS = 30_000
/** Without mouse, keyboard or touch for this long the user is idle … */
const IDLE_MS = 10 * 60_000
/** … and after this long the software is only left open, which is not counted at all */
const AWAY_MS = 60 * 60_000
const LAST_INPUT = 'ut_last_input'
const LAST_PING = 'ut_last_ping'
const MODULE = 'ut_module'

const read = (key: string) => Number(localStorage.getItem(key)) || 0

/**
 * Counts the time in the software. All tabs share one clock (localStorage): whichever tab is due sends the ping,
 * so two open tabs are not counted twice.
 */
export function useUsageClock(module: string) {
  const { user } = useAuth()
  const userId = user?.id

  useEffect(() => {
    if (!userId) return
    let noted = 0
    const input = () => {
      const now = Date.now()
      if (now - noted < 5000) return
      noted = now
      localStorage.setItem(LAST_INPUT, String(now))
      localStorage.setItem(MODULE, module)
    }
    input()

    const ping = () => {
      const now = Date.now()
      const since = now - read(LAST_PING)
      const quiet = now - read(LAST_INPUT)
      if (since < PING_MS - 5000 || quiet > AWAY_MS) return
      localStorage.setItem(LAST_PING, String(now))
      // After a pause (computer asleep, software closed) only the last moments are known to be used
      const seconds = Math.round(Math.min(since, PING_MS * 3) / 1000)
      api.trackPing({ state: quiet < IDLE_MS ? 'active' : 'idle', seconds: since > PING_MS * 3 ? 0 : seconds, module: localStorage.getItem(MODULE) || module })
        .catch(() => {
          // Signed out by the admin (or the login has ended): show the login page
          if (!getToken()) window.location.reload()
        })
    }
    ping()

    const timer = window.setInterval(ping, PING_MS)
    const events = ['mousemove', 'mousedown', 'keydown', 'wheel', 'touchstart'] as const
    events.forEach((e) => window.addEventListener(e, input, { passive: true }))
    return () => {
      window.clearInterval(timer)
      events.forEach((e) => window.removeEventListener(e, input))
    }
  }, [userId, module])
}
