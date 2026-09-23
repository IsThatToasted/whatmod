import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext.js';
import { useAppData } from './contexts/AppDataContext.js';
import { Shell } from './components/Shell.js';
import AuthPage from './pages/AuthPage.js';
import NowPage from './pages/NowPage.js';
import LaterPage from './pages/LaterPage.js';
import TasksPage from './pages/TasksPage.js';
import InboxPage from './pages/InboxPage.js';
import ProjectsPage from './pages/ProjectsPage.js';
import ProjectPage from './pages/ProjectPage.js';
import PlannerPage from './pages/PlannerPage.js';
import ThoughtsPage from './pages/ThoughtsPage.js';
import OrganizePage from './pages/OrganizePage.js';
import SpacesPage from './pages/SpacesPage.js';
import SpacePage from './pages/SpacePage.js';
import YouPage from './pages/YouPage.js';
import SettingsPage from './pages/SettingsPage.js';
import ContactsPage from './pages/ContactsPage.js';
import MemoryPage from './pages/MemoryPage.js';
import OnboardingPage from './pages/OnboardingPage.js';
import SearchPage from './pages/SearchPage.js';
import DebugPage from './pages/DebugPage.js';
import InvitePage from './pages/InvitePage.js';
import PasswordRecoveryPage from './pages/PasswordRecoveryPage.js';
export default function App() {
    const { userId, loading: authLoading, demo, recoveryMode } = useAuth();
    const { profile, loading: dataLoading } = useAppData();
    useEffect(() => { const root = document.documentElement; const theme = profile?.theme || 'system'; if (theme === 'system')
        delete root.dataset.theme;
    else
        root.dataset.theme = theme; }, [profile?.theme]);
    if (authLoading || (userId && dataLoading))
        return _jsxs("div", { className: "splash", children: [_jsx("div", { className: "brand-orb", children: "J" }), _jsx("strong", { children: "JustGlance" }), _jsx("span", { children: "Getting your day ready\u2026" })] });
    if (!userId && !demo)
        return _jsx(AuthPage, {});
    if (userId && recoveryMode && !demo)
        return _jsx(PasswordRecoveryPage, {});
    if (userId && (!profile || !profile.onboarding_complete) && !demo)
        return _jsx(OnboardingPage, {});
    return _jsxs(Routes, { children: [_jsxs(Route, { element: _jsx(Shell, {}), children: [_jsx(Route, { index: true, element: _jsx(Navigate, { to: "/now", replace: true }) }), _jsx(Route, { path: "/now", element: _jsx(NowPage, {}) }), _jsx(Route, { path: "/tasks", element: _jsx(TasksPage, {}) }), _jsx(Route, { path: "/inbox", element: _jsx(InboxPage, {}) }), _jsx(Route, { path: "/projects", element: _jsx(ProjectsPage, {}) }), _jsx(Route, { path: "/projects/:id", element: _jsx(ProjectPage, {}) }), _jsx(Route, { path: "/planner", element: _jsx(PlannerPage, {}) }), _jsx(Route, { path: "/thoughts", element: _jsx(ThoughtsPage, {}) }), _jsx(Route, { path: "/organize", element: _jsx(OrganizePage, {}) }), _jsx(Route, { path: "/later", element: _jsx(LaterPage, {}) }), _jsx(Route, { path: "/contacts", element: _jsx(ContactsPage, {}) }), _jsx(Route, { path: "/memory", element: _jsx(MemoryPage, {}) }), _jsx(Route, { path: "/spaces", element: _jsx(SpacesPage, {}) }), _jsx(Route, { path: "/spaces/:id", element: _jsx(SpacePage, {}) }), _jsx(Route, { path: "/you", element: _jsx(YouPage, {}) }), _jsx(Route, { path: "/settings", element: _jsx(SettingsPage, {}) }), _jsx(Route, { path: "/search", element: _jsx(SearchPage, {}) }), _jsx(Route, { path: "/debug", element: _jsx(DebugPage, {}) }), _jsx(Route, { path: "/invite/:token", element: _jsx(InvitePage, {}) })] }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/now", replace: true }) })] });
}
