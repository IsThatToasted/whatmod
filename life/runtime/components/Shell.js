import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { CalendarDays, CircleUserRound, FolderKanban, Inbox, LayoutGrid, Lightbulb, ListChecks, Menu, Plus, Search, Sparkles, UsersRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CaptureSheet } from './CaptureSheet.js';
import { OfflineBanner } from './OfflineBanner.js';
const desktopLinks = [
    ['/now', 'Now', Sparkles], ['/tasks', 'Tasks', ListChecks], ['/planner', 'Planner', CalendarDays], ['/projects', 'Projects', FolderKanban], ['/inbox', 'Inbox', Inbox], ['/thoughts', 'Thoughts', Lightbulb], ['/spaces', 'Spaces', UsersRound], ['/you', 'You', CircleUserRound]
];
const mobileLinks = [['/now', 'Now', Sparkles], ['/tasks', 'Tasks', ListChecks], ['/planner', 'Plan', CalendarDays], ['/organize', 'More', LayoutGrid]];
export function Shell() {
    const [capture, setCapture] = useState(false);
    const nav = useNavigate();
    const loc = useLocation();
    useEffect(() => { const key = (e) => { const el = e.target; if (el && ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))
        return; if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        nav('/search');
    }
    else if (e.key.toLowerCase() === 'c') {
        e.preventDefault();
        setCapture(true);
    } }; addEventListener('keydown', key); return () => removeEventListener('keydown', key); }, [nav]);
    return _jsxs("div", { className: "app-shell", children: [_jsx(OfflineBanner, {}), _jsxs("aside", { className: "desktop-sidebar", children: [_jsxs("div", { className: "brand", children: [_jsx("div", { className: "brand-orb", children: "J" }), _jsxs("div", { children: [_jsx("strong", { children: "JustGlance" }), _jsx("small", { children: "Your life, at a glance." })] })] }), _jsx("nav", { children: desktopLinks.map(([to, label, Icon]) => _jsxs(NavLink, { to: to, className: ({ isActive }) => isActive ? 'active' : '', children: [_jsx(Icon, { size: 20 }), label] }, to)) }), _jsxs("button", { className: "sidebar-capture", onClick: () => setCapture(true), children: [_jsx(Plus, {}), "Capture ", _jsx("kbd", { children: "C" })] }), _jsxs("button", { className: "sidebar-search", onClick: () => nav('/search'), children: [_jsx(Search, { size: 18 }), "Search ", _jsx("kbd", { children: "\u2318K" })] })] }), _jsxs("div", { className: "app-main", children: [_jsxs("header", { className: "mobile-top", children: [_jsxs("div", { className: "mini-brand", children: [_jsx("div", { className: "brand-orb small", children: "J" }), _jsx("strong", { children: "JustGlance" })] }), _jsxs("div", { className: "mobile-top-actions", children: [_jsx("button", { className: "icon-button", onClick: () => nav('/search'), "aria-label": "Search", children: _jsx(Search, {}) }), _jsx("button", { className: "icon-button", onClick: () => nav('/organize'), "aria-label": "More", children: _jsx(Menu, {}) })] })] }), _jsx("main", { children: _jsx(Outlet, {}) }, loc.pathname)] }), _jsxs("nav", { className: "bottom-nav organizer-bottom", children: [mobileLinks.slice(0, 2).map(([to, label, Icon]) => _jsxs(NavLink, { to: to, children: [_jsx(Icon, { size: 21 }), _jsx("span", { children: label })] }, to)), _jsx("button", { className: "capture-fab", onClick: () => setCapture(true), "aria-label": "Capture", children: _jsx(Plus, { size: 27 }) }), mobileLinks.slice(2).map(([to, label, Icon]) => _jsxs(NavLink, { to: to, children: [_jsx(Icon, { size: 21 }), _jsx("span", { children: label })] }, to))] }), _jsx(CaptureSheet, { open: capture, onClose: () => setCapture(false) })] });
}
