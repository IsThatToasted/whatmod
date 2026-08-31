import { NavLink, Outlet, Link } from 'react-router-dom';
import { BriefcaseBusiness, ClipboardCheck, House, MessageSquare, Sparkles, UsersRound, Settings, Camera, Clock3, ShieldCheck, LogOut } from 'lucide-react';
import { useAuth } from '../auth/AuthGate';

const links = [
  ['/', 'Home', House],
  ['/projects', 'Projects', BriefcaseBusiness],
  ['/estimator', 'Smart Estimate', Sparkles],
  ['/field', 'Field', Camera],
  ['/team', 'My Time', Clock3],
  ['/inbox', 'Inbox', MessageSquare],
  ['/settings', 'Settings', Settings]
] as const;

export function Shell() {
  const {isAdmin,membership,signOut}=useAuth();
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">A</div><div><strong>Aurelium</strong><span>Field</span></div></div>
        <nav>{links.map(([to, label, Icon]) => <NavLink key={to} to={to} end={to === '/'} className={({isActive}) => isActive ? 'nav-link active' : 'nav-link'}><Icon size={19}/><span>{label}</span></NavLink>)}</nav>
        <div className="sidebar-footer employee-sidebar-footer">
          {isAdmin&&<Link className="admin-switch" to="/admin"><ShieldCheck size={18}/><div><strong>Admin View</strong><span>Manage {membership?.organization?.name??'organization'}</span></div></Link>}
          <div className="field-ready"><ClipboardCheck size={18}/><div><strong>Employee View</strong><span>Field-ready workspace</span></div></div>
          <button className="signout-button" onClick={()=>void signOut()}><LogOut size={17}/><span>Sign Out</span></button>
        </div>
      </aside>
      <main className="main"><Outlet /></main>
      <nav className="mobile-tabs">
        {links.slice(0,5).map(([to, label, Icon]) => <NavLink key={to} to={to} end={to === '/'} className={({isActive}) => isActive ? 'mobile-tab active' : 'mobile-tab'}><Icon size={20}/><span>{label === 'Smart Estimate' ? 'Estimate' : label}</span></NavLink>)}
      </nav>
    </div>
  );
}
