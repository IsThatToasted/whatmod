import { NavLink, Outlet } from 'react-router-dom';
import { BriefcaseBusiness, ClipboardCheck, House, MessageSquare, Sparkles, UsersRound, Settings, Camera } from 'lucide-react';

const links = [
  ['/', 'Home', House],
  ['/projects', 'Projects', BriefcaseBusiness],
  ['/estimator', 'Smart Estimate', Sparkles],
  ['/field', 'Field', Camera],
  ['/team', 'Team', UsersRound],
  ['/inbox', 'Inbox', MessageSquare],
  ['/settings', 'Settings', Settings]
] as const;

export function Shell() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">A</div><div><strong>Aurelium</strong><span>Field</span></div></div>
        <nav>{links.map(([to, label, Icon]) => <NavLink key={to} to={to} end={to === '/'} className={({isActive}) => isActive ? 'nav-link active' : 'nav-link'}><Icon size={19}/><span>{label}</span></NavLink>)}</nav>
        <div className="sidebar-footer"><ClipboardCheck size={18}/><div><strong>Field-ready</strong><span>Offline drafts enabled</span></div></div>
      </aside>
      <main className="main"><Outlet /></main>
      <nav className="mobile-tabs">
        {links.slice(0,5).map(([to, label, Icon]) => <NavLink key={to} to={to} end={to === '/'} className={({isActive}) => isActive ? 'mobile-tab active' : 'mobile-tab'}><Icon size={20}/><span>{label === 'Smart Estimate' ? 'Estimate' : label}</span></NavLink>)}
      </nav>
    </div>
  );
}
