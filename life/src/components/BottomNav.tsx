import { Clock3, Home, Plus, UsersRound, UserRound } from 'lucide-react';
import { NavLink } from 'react-router-dom';
export function BottomNav({onCapture}:{onCapture:()=>void}){
  const link=(to:string,label:string,Icon:any)=><NavLink to={to} className={({isActive})=>`nav-link ${isActive?'active':''}`}><Icon size={21}/><span>{label}</span></NavLink>;
  return <nav className="bottom-nav" aria-label="Primary navigation">{link('/now','Now',Home)}{link('/later','Later',Clock3)}<button className="capture-fab" onClick={onCapture} aria-label="Add something"><Plus size={27}/></button>{link('/spaces','Spaces',UsersRound)}{link('/you','You',UserRound)}</nav>
}
