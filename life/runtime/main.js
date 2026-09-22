import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { Component } from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext.js';
import { AppDataProvider } from './contexts/AppDataContext.js';
import { OrganizerProvider } from './contexts/OrganizerContext.js';
import App from './App.js';

class AppErrorBoundary extends Component {
    state = { error: null };
    static getDerivedStateFromError(error) { return { error }; }
    componentDidCatch(error, info) { console.error('[JustGlance render]', error, info); }
    render() { if (!this.state.error)
        return this.props.children; return _jsx("div", { className: "fatal-error", children: _jsxs("div", { className: "fatal-error-card", children: [_jsx("div", { className: "brand-orb", children: "J" }), _jsx("h1", { children: "JustGlance hit a startup problem." }), _jsx("p", { children: "The application loaded, but a component failed while rendering." }), _jsx("pre", { children: this.state.error.message }), _jsx("button", { className: "primary-button", onClick: () => location.reload(), children: "Reload JustGlance" })] }) }); }
}
function cleanupLegacyPwaState() {
    if ('serviceWorker' in navigator) {
        void navigator.serviceWorker.getRegistrations().then(registrations => Promise.all(registrations.filter(r => r.scope.includes('/life/')).map(r => r.unregister()))).catch(error => console.warn('[JustGlance] Legacy worker cleanup skipped', error));
    }
    if ('caches' in window) {
        void caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('justglance-')).map(key => caches.delete(key)))).catch(error => console.warn('[JustGlance] Legacy cache cleanup skipped', error));
    }
}
const root = document.getElementById('root');
if (!root)
    throw new Error('JG-BOOT-001: #root was not found in index.html');
window.__JUSTGLANCE_MOUNTED__ = true;
cleanupLegacyPwaState();
ReactDOM.createRoot(root).render(_jsx(React.StrictMode, { children: _jsx(AppErrorBoundary, { children: _jsx(HashRouter, { children: _jsx(AuthProvider, { children: _jsx(AppDataProvider, { children: _jsx(OrganizerProvider, { children: _jsx(App, {}) }) }) }) }) }) }));
