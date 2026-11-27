/*
 * NCRC app service worker.
 * - Online only: API calls are never cached, so what you see is always current.
 * - The app itself (index.html + built files) is cached so it opens instantly and shows an
 *   "offline" message instead of the browser's error page when there is no signal.
 * - Shows push notifications and opens the right screen when one is tapped.
 */
const SHELL = 'ncrc-shell-v1'
const ASSETS = 'ncrc-assets-v1'
const PRECACHE = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/badge-96.png', '/namotech-logo.png']
const MAX_ASSETS = 120

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(PRECACHE)).catch(() => undefined))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = [SHELL, ASSETS]
    for (const key of await caches.keys()) if (!keep.includes(key)) await caches.delete(key)
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  // Data and files from Laravel: always from the server
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/storage') || url.pathname.startsWith('/backend')) return

  // Screens: the newest index.html when online, the cached one when not
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req)
        if (fresh.ok) (await caches.open(SHELL)).put('/', fresh.clone())
        return fresh
      } catch {
        return (await caches.match('/')) || Response.error()
      }
    })())
    return
  }

  // Built files have their hash in the name and never change
  // (only Vite's hashed names: other /assets/ files are uploads from Laravel and can change)
  if ((url.pathname.startsWith('/assets/') && /-[\w-]{8,}\.(js|css|woff2?|png|svg|jpe?g|webp)$/.test(url.pathname)) || url.pathname.startsWith('/icons/')) {
    event.respondWith((async () => {
      const cached = await caches.match(req)
      if (cached) return cached
      const res = await fetch(req)
      if (res.ok) {
        const cache = await caches.open(ASSETS)
        await cache.put(req, res.clone())
        const keys = await cache.keys()
        for (const old of keys.slice(0, Math.max(0, keys.length - MAX_ASSETS))) await cache.delete(old)
      }
      return res
    })())
  }
})

self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = { title: 'NCRC', body: event.data ? event.data.text() : '' } }
  const title = data.title || 'NCRC'
  event.waitUntil((async () => {
    if (typeof data.badge_count === 'number' && self.navigator.setAppBadge) {
      try { data.badge_count > 0 ? await self.navigator.setAppBadge(data.badge_count) : await self.navigator.clearAppBadge() } catch { /* not supported */ }
    }
    // Tell open windows so their bell count updates at once
    for (const client of await self.clients.matchAll({ type: 'window', includeUncontrolled: true })) client.postMessage({ type: 'push-received', payload: data })
    await self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-96.png',
      tag: data.tag || undefined,
      renotify: Boolean(data.tag),
      data: { url: data.url || '/', id: data.id, type: data.type },
    })
  })())
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of windows) {
      if (new URL(client.url).origin !== self.location.origin) continue
      // An open app (not the separate Mail tab) opens the screen itself
      if (new URL(client.url).hash === '#mail' && windows.length > 1) continue
      await client.focus()
      client.postMessage({ type: 'open-url', url: target })
      return
    }
    await self.clients.openWindow(target)
  })())
})

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting()
})
