import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Archive, CalendarDays, CircleUserRound, ContactRound, FolderKanban, Inbox, LayoutGrid, Lightbulb, ListChecks, Menu, Plus, Search, ShoppingBasket, Sparkles, UsersRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { CaptureSheet } from './CaptureSheet'
import { OfflineBanner } from './OfflineBanner'

const desktopGroups=[
  {label:'Today',links:[['/now','Now',Sparkles],['/planner','Planner',CalendarDays]]},
  {label:'Do',links:[['/tasks','Tasks',ListChecks],['/shopping','Shopping',ShoppingBasket],['/projects','Projects',FolderKanban]]},
  {label:'Remember',links:[['/inbox','Inbox',Inbox],['/memory','Memory',Archive],['/thoughts','Thoughts',Lightbulb]]},
  {label:'People & sharing',links:[['/contacts','Contacts',ContactRound],['/spaces','Spaces',UsersRound]]},
] as const
const mobileLinks=[['/now','Now',Sparkles],['/tasks','Tasks',ListChecks],['/planner','Plan',CalendarDays],['/organize','More',LayoutGrid]] as const

export function Shell(){
 const [capture,setCapture]=useState(false);const nav=useNavigate();const loc=useLocation()
 useEffect(()=>{const key=(e:KeyboardEvent)=>{const el=e.target as HTMLElement|null;if(el&&['INPUT','TEXTAREA','SELECT'].includes(el.tagName))return;if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();nav('/search')}else if(e.key.toLowerCase()==='c'){e.preventDefault();setCapture(true)}};addEventListener('keydown',key);return()=>removeEventListener('keydown',key)},[nav])
 return <div className="app-shell"><OfflineBanner/><aside className="desktop-sidebar"><div className="brand"><div className="brand-orb">J</div><div><strong>JustGlance</strong><small>Your life, at a glance.</small></div></div><button className="sidebar-capture" onClick={()=>setCapture(true)}><Plus/>Capture <kbd>C</kbd></button><nav className="sidebar-nav-groups">{desktopGroups.map(group=><section className="sidebar-group" key={group.label}><span className="sidebar-group-label">{group.label}</span>{group.links.map(([to,label,Icon])=><NavLink key={to} to={to} className={({isActive})=>isActive?'active':''}><Icon size={19}/>{label}</NavLink>)}</section>)}</nav><div className="sidebar-footer"><button className="sidebar-search" onClick={()=>nav('/search')}><Search size={18}/>Search <kbd>⌘K</kbd></button><NavLink to="/you" className={({isActive})=>`sidebar-profile ${isActive?'active':''}`}><CircleUserRound size={19}/><span>You & settings</span></NavLink></div></aside><div className="app-main"><header className="mobile-top"><div className="mini-brand"><div className="brand-orb small">J</div><strong>JustGlance</strong></div><div className="mobile-top-actions"><button className="icon-button" onClick={()=>nav('/search')} aria-label="Search"><Search/></button><button className="icon-button" onClick={()=>nav('/organize')} aria-label="More"><Menu/></button></div></header><main key={loc.pathname}><Outlet/></main></div><nav className="bottom-nav organizer-bottom">{mobileLinks.slice(0,2).map(([to,label,Icon])=><NavLink key={to} to={to}><Icon size={21}/><span>{label}</span></NavLink>)}<button className="capture-fab" onClick={()=>setCapture(true)} aria-label="Capture"><Plus size={27}/></button>{mobileLinks.slice(2).map(([to,label,Icon])=><NavLink key={to} to={to}><Icon size={21}/><span>{label}</span></NavLink>)}</nav><CaptureSheet open={capture} onClose={()=>setCapture(false)}/></div>
}
