import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { CloudOff, RefreshCw } from 'lucide-react';
import { useAppData } from '../contexts/AppDataContext.js';
export function OfflineBanner() { const { syncState, refresh } = useAppData(); if (syncState === 'synced')
    return null; return _jsxs("div", { className: `sync-banner ${syncState}`, children: [_jsx(CloudOff, { size: 16 }), _jsx("span", { children: syncState === 'offline' ? "You’re offline. Changes will sync when you’re back." : syncState === 'syncing' ? 'Syncing changes…' : 'Sync needs attention. Your local changes are safe.' }), syncState === 'error' && _jsx("button", { onClick: refresh, "aria-label": "Retry sync", children: _jsx(RefreshCw, { size: 15 }) })] }); }
