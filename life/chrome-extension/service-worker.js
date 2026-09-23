const APP_BASE = 'https://whatmod.com/life';
let cachedConfig = null;

function readConfigValue(text, names) {
  for (const name of names) {
    // Supports both JS object syntax:
    //   supabaseUrl: '...'
    // and JSON-style syntax produced by deployment scripts:
    //   "supabaseUrl": "..."
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = '["\\\']?' + escaped + '["\\\']?\\s*:\\s*["\\\']([^"\\\']+)["\\\']';
    const match = text.match(new RegExp(pattern, 'i'));
    if (match?.[1]?.trim()) return match[1].trim();
  }
  return '';
}

function parsePublicConfig(text) {
  const source = String(text || '').replace(/^\uFEFF/, '');
  const url = readConfigValue(source, ['supabaseUrl', 'SUPABASE_URL', 'JUSTGLANCE_SUPABASE_URL']);
  const key = readConfigValue(source, ['supabaseAnonKey', 'SUPABASE_ANON_KEY', 'JUSTGLANCE_SUPABASE_ANON_KEY']);

  if (!url || !key) {
    const foundUrl = Boolean(url);
    const foundKey = Boolean(key);
    throw new Error(
      `JustGlance public configuration was loaded, but ${!foundUrl && !foundKey ? 'the Supabase URL and public key were' : !foundUrl ? 'the Supabase URL was' : 'the Supabase public key was'} missing. ` +
      'Redeploy the normal web-pages.yml workflow and make sure JUSTGLANCE_SUPABASE_URL and JUSTGLANCE_SUPABASE_ANON_KEY are available to that workflow.'
    );
  }

  return {
    supabaseUrl: url.replace(/\/$/, ''),
    supabaseAnonKey: key,
  };
}

async function fetchConfig() {
  const response = await fetch(`${APP_BASE}/config.js?extension=${Date.now()}`, {
    cache: 'no-store',
    credentials: 'omit',
    redirect: 'follow',
  });
  if (!response.ok) throw new Error(`Could not read JustGlance configuration (${response.status}).`);
  return parsePublicConfig(await response.text());
}

async function getConfig(force = false) {
  if (cachedConfig && !force) return cachedConfig;
  cachedConfig = await fetchConfig();
  return cachedConfig;
}

async function rpc(name, body, retry = true) {
  let cfg = await getConfig();
  let response = await fetch(`${cfg.supabaseUrl}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: cfg.supabaseAnonKey,
      Authorization: `Bearer ${cfg.supabaseAnonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (retry && (response.status === 401 || response.status === 403)) {
    try {
      cfg = await getConfig(true);
      response = await fetch(`${cfg.supabaseUrl}/rest/v1/rpc/${name}`, {
        method: 'POST',
        headers: {
          apikey: cfg.supabaseAnonKey,
          Authorization: `Bearer ${cfg.supabaseAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    } catch {
      // Preserve response handling below.
    }
  }

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
      await getConfig(true);
      const lists = await getLists(token);
      await chrome.storage.local.set({ justglanceBrowserToken: token });
      return { ok: true, paired: true, lists };
    }
    if (message?.type === 'JG_UNPAIR') {
      await chrome.storage.local.remove(['justglanceBrowserToken']);
      cachedConfig = null;
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
    if (message?.type === 'JG_CONFIG_TEST') {
      await getConfig(true);
      return { ok: true };
    }
    return { ok: false, error: 'Unknown JustGlance extension request.' };
  })().then(sendResponse).catch(error => sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }));
  return true;
});

chrome.action.onClicked.addListener(async tab => {
  if (!tab.id) return;
  try { await chrome.tabs.sendMessage(tab.id, { type: 'JG_TOGGLE_PANEL' }); } catch { /* restricted pages */ }
});
