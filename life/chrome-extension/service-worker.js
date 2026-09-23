const APP_BASE = 'https://whatmod.com/life';
let cachedConfig = null;

function parsePublicConfig(text) {
  const url = text.match(/supabaseUrl\s*:\s*['"]([^'"]+)['"]/i)?.[1] || '';
  const key = text.match(/supabaseAnonKey\s*:\s*['"]([^'"]+)['"]/i)?.[1] || '';
  if (!url || !key) throw new Error('JustGlance production configuration is not available yet.');
  return { supabaseUrl: url.replace(/\/$/, ''), supabaseAnonKey: key };
}

async function getConfig(force = false) {
  if (cachedConfig && !force) return cachedConfig;
  const response = await fetch(`${APP_BASE}/config.js?extension=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Could not read JustGlance configuration (${response.status}).`);
  cachedConfig = parsePublicConfig(await response.text());
  return cachedConfig;
}

async function rpc(name, body) {
  const cfg = await getConfig();
  const response = await fetch(`${cfg.supabaseUrl}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: cfg.supabaseAnonKey,
      Authorization: `Bearer ${cfg.supabaseAnonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) {
    const message = data?.message || data?.error_description || data?.hint || (typeof data === 'string' ? data : '') || `JustGlance request failed (${response.status}).`;
    throw new Error(message);
  }
  return data;
}

async function getToken() {
  const stored = await chrome.storage.local.get(['justglanceBrowserToken']);
  return stored.justglanceBrowserToken || '';
}

async function getLists(token) {
  if (!token) return [];
  const rows = await rpc('browser_get_shopping_lists', { p_token: token });
  return Array.isArray(rows) ? rows : [];
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    if (message?.type === 'JG_STATUS') {
      const token = await getToken();
      let lists = [];
      let error = null;
      if (token) {
        try { lists = await getLists(token); }
        catch (err) { error = err instanceof Error ? err.message : String(err); }
      }
      return { ok: true, paired: Boolean(token), token, lists, error };
    }
    if (message?.type === 'JG_PAIR') {
      const token = String(message.token || '').trim();
      if (!token.startsWith('jgext_')) throw new Error('That does not look like a JustGlance pairing code.');
      const lists = await getLists(token); // Validate before saving.
      await chrome.storage.local.set({ justglanceBrowserToken: token });
      return { ok: true, paired: true, lists };
    }
    if (message?.type === 'JG_UNPAIR') {
      await chrome.storage.local.remove(['justglanceBrowserToken']);
      return { ok: true };
    }
    if (message?.type === 'JG_LISTS') {
      const token = await getToken();
      if (!token) throw new Error('Connect the extension to JustGlance first.');
      return { ok: true, lists: await getLists(token) };
    }
    if (message?.type === 'JG_ADD_PRODUCT') {
      const token = await getToken();
      if (!token) throw new Error('Connect the extension to JustGlance first.');
      const p = message.product || {};
      const result = await rpc('browser_add_shopping_item', {
        p_token: token,
        p_space: message.spaceId,
        p_list: message.listId || null,
        p_title: p.title || 'Saved product',
        p_url: p.url || null,
        p_image_url: p.imageUrl || null,
        p_price: p.price == null || p.price === '' ? null : Number(p.price),
        p_currency: p.currency || 'USD',
        p_store: p.store || null,
        p_category: p.category || null,
        p_product_id: p.productId || null,
        p_notes: message.notes || null,
        p_metadata: {
          brand: p.brand || null,
          description: p.description || null,
          captured_at: new Date().toISOString(),
          capture_method: 'chrome-extension-dom'
        }
      });
      return { ok: true, result };
    }
    return { ok: false, error: 'Unknown JustGlance extension request.' };
  })().then(sendResponse).catch(error => sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }));
  return true;
});

chrome.action.onClicked.addListener(async tab => {
  if (!tab.id) return;
  try { await chrome.tabs.sendMessage(tab.id, { type: 'JG_TOGGLE_PANEL' }); } catch { /* restricted pages */ }
});
