import { Clock3, Home, Search, Settings, Sparkles, UsersRound, UserRound } from 'lucide-react';
import { NavLink } from 'react-router-dom';
export function DesktopSidebar({onCapture}:{onCapture:()=>void}){
  const entries=[['/now','Now',Home],['/later','Later',Clock3],['/spaces','Spaces',UsersRound],['/search','Search',Search],['/you','You',UserRound],['/settings','Settings',Settings]] as const;
  return <aside className="sidebar"><div className="brand"><span className="brand-mark"><Sparkles size={18}/></span><div><b>JustGlance</b><small>Your life, at a glance.</small></div></div><button className="primary wide" onClick={onCapture}>+ Add something</button><nav>{entries.map(([to,label,Icon])=><NavLink key={to} to={to} className={({isActive})=>`side-link ${isActive?'active':''}`}><Icon size={19}/>{label}</NavLink>)}</nav><div className="sidebar-note">Designed to show less, at the right time.</div></aside>
}
