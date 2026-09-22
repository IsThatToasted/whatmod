/* JustGlance recovery worker. Current web releases do not register a service worker.
   If an older installation still checks this URL, activate once, clear old JustGlance
   caches, unregister, and then get out of the way. */
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()))
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys()
      await Promise.all(keys.filter(key => key.startsWith('justglance-')).map(key => caches.delete(key)))
    } catch (_) {}
    try { await self.registration.unregister() } catch (_) {}
  })())
})
