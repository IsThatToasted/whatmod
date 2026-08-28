import { Filter, Plus, Search } from 'lucide-react';
import { sampleProjects } from '../lib/demo';
import { StatusPill } from '../components/StatusPill';

export function Projects() {
  return <div className="page"><header className="page-header"><div><p className="eyebrow">Operations</p><h1>Projects</h1><p>One source of truth from lead through closeout.</p></div><button className="button primary"><Plus size={18}/>New project</button></header>
    <div className="toolbar"><label className="search"><Search size={18}/><input placeholder="Search projects, clients, addresses…"/></label><button className="button secondary"><Filter size={17}/>Filter</button></div>
    <div className="table-wrap"><table><thead><tr><th>Project</th><th>Status</th><th>Trade</th><th>Progress</th><th>Crew</th><th>Updated</th></tr></thead><tbody>{sampleProjects.map(p=><tr key={p.id}><td><strong>{p.name}</strong><span>{p.clientName}<br/>{p.address}</span></td><td><StatusPill status={p.status}/></td><td className="capitalize">{p.trade}</td><td><div className="progress"><i style={{width:`${p.progress}%`}}/></div><span>{p.progress}%</span></td><td>{p.crewCount}</td><td>{p.updatedAt}</td></tr>)}</tbody></table></div>
  </div>
}
