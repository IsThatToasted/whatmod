import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useAppData } from '../contexts/AppDataContext.js';
import { useAuth } from '../contexts/AuthContext.js';
import { APP_VERSION, HAS_SUPABASE, featureFlags } from '../lib/config.js';
import { getTimePeriod } from '../lib/time.js';
import { queueSize } from '../lib/offlineQueue.js';
export default function DebugPage() { const { userId, demo } = useAuth(); const { items, spaces, syncState } = useAppData(); if (!Boolean(import.meta.env?.DEV) && location.search !== '?debug=1')
    return _jsx("div", { className: "page", children: _jsx("h1", { children: "Not found" }) }); return _jsxs("div", { className: "page", children: [_jsx("header", { className: "page-header compact", children: _jsxs("div", { children: [_jsx("span", { className: "eyebrow", children: "DEVELOPMENT" }), _jsx("h1", { children: "Debug panel" })] }) }), _jsx("pre", { className: "debug-pre", children: JSON.stringify({ version: APP_VERSION, userId, demo, supabaseConfigured: HAS_SUPABASE, syncState, loadedItems: items.length, spaces: spaces.length, contextPeriod: getTimePeriod(), online: navigator.onLine, offlineQueue: queueSize(userId), serviceWorker: 'serviceWorker' in navigator, featureFlags }, null, 2) })] }); }
