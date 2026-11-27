import { useCallback, useSyncExternalStore } from 'react'

/** Phones get the app layout; the computer layout stays for tablets and up */
const QUERY = '(max-width: 768px)'
const FORCE_KEY = 'force_desktop_layout'
const listeners = new Set<() => void>()

function subscribe(fn: () => void) {
  const mq = window.matchMedia(QUERY)
  listeners.add(fn)
  mq.addEventListener('change', fn)
  return () => { listeners.delete(fn); mq.removeEventListener('change', fn) }
}

const snapshot = () => window.matchMedia(QUERY).matches && localStorage.getItem(FORCE_KEY) !== '1'

/** [is the phone layout shown, switch to the computer layout (true) or back] */
export function useMobileLayout(): [boolean, (desktop: boolean) => void] {
  const mobile = useSyncExternalStore(subscribe, snapshot)
  const setDesktop = useCallback((desktop: boolean) => {
    if (desktop) localStorage.setItem(FORCE_KEY, '1')
    else localStorage.removeItem(FORCE_KEY)
    listeners.forEach((fn) => fn())
  }, [])
  return [mobile, setDesktop]
}

/** The computer layout was chosen on a phone: offer the way back */
export const desktopForcedOnPhone = () => window.matchMedia(QUERY).matches && localStorage.getItem(FORCE_KEY) === '1'
