(() => {
  if (window.top !== window || window.__JUSTGLANCE_EXTENSION_BRIDGE__) return;
  window.__JUSTGLANCE_EXTENSION_BRIDGE__ = true;
  const allowedOrigin = 'https://whatmod.com';
  if (location.origin !== allowedOrigin || !location.pathname.startsWith('/life')) return;

  function reply(requestId, result) {
    window.postMessage({
      channel: 'JUSTGLANCE_EXTENSION_TO_PAGE',
      requestId,
      result,
    }, allowedOrigin);
  }

  window.addEventListener('message', event => {
    if (event.source !== window || event.origin !== allowedOrigin) return;
    const data = event.data;
    if (!data || data.channel !== 'JUSTGLANCE_PAGE_TO_EXTENSION' || !data.requestId) return;
    let payload = null;
    if (data.action === 'PING') payload = { type: 'JG_BRIDGE_PING' };
    if (data.action === 'PAIR') payload = { type: 'JG_PAIR', token: data.token, config: data.config || null };
    if (data.action === 'STATUS') payload = { type: 'JG_STATUS' };
    if (!payload) return;
    chrome.runtime.sendMessage(payload, response => {
      const err = chrome.runtime.lastError;
      if (err) reply(data.requestId, { ok: false, error: err.message });
      else reply(data.requestId, response || { ok: false, error: 'No response from Add to JustGlance.' });
    });
  });

  window.postMessage({
    channel: 'JUSTGLANCE_EXTENSION_TO_PAGE',
    type: 'READY',
    version: chrome.runtime.getManifest().version,
  }, allowedOrigin);
})();
