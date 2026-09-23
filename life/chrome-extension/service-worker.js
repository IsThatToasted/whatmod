const APP_BASE = 'https://whatmod.com/life';
const CONFIG_STORAGE_KEY = 'justglancePublicConfig';
const TOKEN_STORAGE_KEY = 'justglanceBrowserToken';
let cachedConfig = null;

function cleanConfig(value) {
  const url = String(value?.supabaseUrl || '').trim().replace(/\/$/, '');
  const key = String(value?.supabaseAnonKey || '').trim();
  if (!url || !key) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.supabase.co')) return null;
  } catch {
    return null;
  }
  return { supabaseUrl: url, supabaseAnonKey: key };
}

function readConfigValue(text, names) {
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = '["\\\']?' + escaped + '["\\\']?\\s*:\\s*["\\\']([^"\\\']+)["\\\']';
    const match = String(text || '').match(new RegExp(pattern, 'i'));
    if (match?.[1]?.trim()) return match[1].trim();
  }
  return '';
}

function parsePublicConfig(text) {
  const source = String(text || '').replace(/^\uFEFF/, '');
  const parsed = cleanConfig({
    supabaseUrl: readConfigValue(source, ['supabaseUrl', 'SUPABASE_URL', 'JUSTGLANCE_SUPABASE_URL']),
    supabaseAnonKey: readConfigValue(source, ['supabaseAnonKey', 'SUPABASE_ANON_KEY', 'JUSTGLANCE_SUPABASE_ANON_KEY']),
  });
  if (!parsed) {
    throw new Error('JustGlance public configuration could not be read. Open JustGlance Settings and use “Pair installed extension” so the app can hand the public configuration to this extension directly.');
  }
  return parsed;
}

async function storeConfig(value) {
  const clean = cleanConfig(value);
  if (!clean) throw new Error('The JustGlance app supplied an invalid public configuration.');
  cachedConfig = clean;
  await chrome.storage.local.set({ [CONFIG_STORAGE_KEY]: clean });
  return clean;
}

async function fetchConfig() {
  const response = await fetch(`${APP_BASE}/config.js?extension=${Date.now()}`, {
    cache: 'no-store',
    credentials: 'omit',
    redirect: 'follow',
  });
  if (!response.ok) throw new Error(`Could not read JustGlance configuration (${response.status}).`);
  const parsed = parsePublicConfig(await response.text());
  await storeConfig(parsed);
  return parsed;
}

async function getConfig(force = false) {
  if (cachedConfig && !force) return cachedConfig;
  const stored = await chrome.storage.local.get([CONFIG_STORAGE_KEY]);
  const fromStorage = cleanConfig(stored[CONFIG_STORAGE_KEY]);
  if (fromStorage && !force) {
    cachedConfig = fromStorage;
    return fromStorage;
  }
  try {
    return await fetchConfig();
  } catch (error) {
    if (fromStorage) {
      cachedConfig = fromStorage;
      return fromStorage;
    }
    throw error;
  }
}

async function requestRpc(name, body, cfg) {
  return fetch(`${cfg.supabaseUrl}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: cfg.supabaseAnonKey,
      Authorization: `Bearer ${cfg.supabaseAnonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

async function rpc(name, body, retry = true) {
  let cfg = await getConfig();
  let response = await requestRpc(name, body, cfg);
  if (retry && (response.status === 401 || response.status === 403)) {
    try {
      cfg = await getConfig(true);
      response = await requestRpc(name, body, cfg);
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
  const stored = await chrome.storage.local.get([TOKEN_STORAGE_KEY]);
  return stored[TOKEN_STORAGE_KEY] || '';
}

async function getLists(token) {
  if (!token) return [];
  const rows = await rpc('browser_get_shopping_lists', { p_token: token });
  return Array.isArray(rows) ? rows : [];
}

async function pairBrowser(token, config) {
  const cleanToken = String(token || '').trim();
  if (!cleanToken.startsWith('jgext_')) throw new Error('That does not look like a JustGlance pairing code.');
  if (config) await storeConfig(config);
  else await getConfig(true);
  const lists = await getLists(cleanToken);
  await chrome.storage.local.set({ [TOKEN_STORAGE_KEY]: cleanToken });
  return { ok: true, paired: true, lists, version: chrome.runtime.getManifest().version };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    if (message?.type === 'JG_BRIDGE_PING') {
      const token = await getToken();
      return { ok: true, version: chrome.runtime.getManifest().version, paired: Boolean(token) };
    }
    if (message?.type === 'JG_STATUS') {
      const token = await getToken();
      let lists = [];
      let error = null;
      if (token) {
        try { lists = await getLists(token); }
        catch (err) { error = err instanceof Error ? err.message : String(err); }
      }
      return { ok: true, paired: Boolean(token), token, lists, error, version: chrome.runtime.getManifest().version };
    }
    if (message?.type === 'JG_PAIR') {
      return pairBrowser(message.token, message.config || null);
    }
    if (message?.type === 'JG_UNPAIR') {
      await chrome.storage.local.remove([TOKEN_STORAGE_KEY]);
      return { ok: true, version: chrome.runtime.getManifest().version };
    }
    if (message?.type === 'JG_LISTS') {
      const token = await getToken();
      if (!token) throw new Error('Connect the extension to JustGlance first.');
      return { ok: true, lists: await getLists(token), version: chrome.runtime.getManifest().version };
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
      return { ok: true, result, version: chrome.runtime.getManifest().version };
    }
    if (message?.type === 'JG_CONFIG_TEST') {
      if (message.config) await storeConfig(message.config);
      else await getConfig(true);
      return { ok: true, version: chrome.runtime.getManifest().version };
    }
    return { ok: false, error: 'Unknown JustGlance extension request.', version: chrome.runtime.getManifest().version };
  })().then(sendResponse).catch(error => sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error), version: chrome.runtime.getManifest().version }));
  return true;
});

chrome.action.onClicked.addListener(async tab => {
  if (!tab.id) return;
  try { await chrome.tabs.sendMessage(tab.id, { type: 'JG_TOGGLE_PANEL' }); } catch { /* restricted pages */ }
});


chrome.runtime.onInstalled.addListener(() => {
  chrome.tabs.query({ url: ['https://whatmod.com/life/*'] }, tabs => {
    for (const tab of tabs) {
      if (!tab.id) continue;
      chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['app-bridge.js'] }).catch(() => {});
    }
  });
});
