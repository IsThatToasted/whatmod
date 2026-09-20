const root = document.getElementById('root')

function showBootError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || 'Unknown startup error')
  console.error('[JustGlance boot]', error)
  if (!root) return
  root.innerHTML = `
    <div style="min-height:100vh;display:grid;place-items:center;padding:24px;background:#f6f6f1;color:#1e211f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
      <div style="width:min(100%,620px);background:#fff;border:1px solid #dedfd8;border-radius:24px;padding:24px;box-shadow:0 16px 45px rgba(31,39,34,.08)">
        <div style="width:48px;height:48px;border-radius:15px;background:#1e211f;color:#fff;display:grid;place-items:center;font-weight:900;margin-bottom:18px">J</div>
        <h1 style="margin:0 0 8px;font-size:1.55rem">JustGlance couldn't start.</h1>
        <p style="color:#737873;line-height:1.5;margin:0 0 16px">The page itself loaded, but the application bundle hit a startup error. Reload once. If it remains, copy the diagnostic below.</p>
        <pre style="white-space:pre-wrap;word-break:break-word;background:#f0f1ec;border-radius:14px;padding:14px;font-size:.78rem;line-height:1.45">${message.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c] || c))}</pre>
        <button onclick="location.reload()" style="margin-top:16px;min-height:44px;border:0;border-radius:13px;padding:0 18px;background:#315c4a;color:white;font-weight:800;cursor:pointer">Reload JustGlance</button>
      </div>
    </div>`
}

window.addEventListener('error', event => {
  if (event.error) showBootError(event.error)
})
window.addEventListener('unhandledrejection', event => showBootError(event.reason))

async function clearLegacyWorker() {
  if (!('serviceWorker' in navigator)) return false
  const wasControlled = Boolean(navigator.serviceWorker.controller)
  try {
    const registrations = await navigator.serviceWorker.getRegistrations()
    await Promise.all(registrations
      .filter(registration => registration.scope.includes('/life/'))
      .map(registration => registration.unregister()))
  } catch (error) {
    console.warn('[JustGlance] Could not unregister legacy service worker', error)
  }
  try {
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.filter(key => key.startsWith('justglance-')).map(key => caches.delete(key)))
    }
  } catch (error) {
    console.warn('[JustGlance] Could not clear legacy caches', error)
  }
  return wasControlled
}

async function boot() {
  const wasControlled = await clearLegacyWorker()
  const resetKey = 'justglance:sw-recovery:v1'
  if (wasControlled && sessionStorage.getItem(resetKey) !== 'done') {
    sessionStorage.setItem(resetKey, 'done')
    location.reload()
    return
  }
  sessionStorage.removeItem(resetKey)
  const module = await import('./bootstrap')
  module.mountJustGlance()
}

boot().catch(showBootError)
