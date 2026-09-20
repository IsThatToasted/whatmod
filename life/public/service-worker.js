/* JustGlance v1.0.4 recovery worker.
   This intentionally disables the older cache-first worker so a previously
   installed /life/ PWA cannot keep serving stale HTML or hashed bundles. */
self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys()
      await Promise.all(keys.filter(key => key.startsWith('justglance-')).map(key => caches.delete(key)))
    } catch (_) {}
    try { await self.registration.unregister() } catch (_) {}
    try {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of clients) {
        if (client.url.includes('/life/')) client.navigate(client.url)
      }
    } catch (_) {}
  })())
})

/* No fetch handler on purpose: every request goes directly to the network. */
