import { ArrowRight, Camera, Clock3, HardHat, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useProjects } from '../lib/projectStore';
import { StatusPill } from '../components/StatusPill';

export function Home() {
  const projects=useProjects();
  const active=projects.filter(p=>p.status==='active').length;
  const upcoming=projects.filter(p=>['scheduled','estimating','lead'].includes(p.status)).length;
  return <div className="page">
    <header className="page-header"><div><p className="eyebrow">Employee workspace</p><h1>Good afternoon.</h1><p>Your jobs, field capture, estimates and time in one focused workspace.</p></div><Link className="button primary" to="/estimator"><Sparkles size={18}/>Start smart estimate</Link></header>
    <section className="metric-row">
      <div className="metric"><span className="metric-icon"><HardHat/></span><div><small>Projects available</small><strong>{projects.length}</strong><span>{active} currently active</span></div></div>
      <div className="metric"><span className="metric-icon"><Clock3/></span><div><small>Upcoming work</small><strong>{upcoming}</strong><span>Scheduled or estimating</span></div></div>
      <div className="metric"><span className="metric-icon"><Camera/></span><div><small>Field capture</small><strong>Ready</strong><span>Photos, walkthroughs and notes</span></div></div>
      <div className="metric"><span className="metric-icon"><Sparkles/></span><div><small>Smart Estimate</small><strong>Ready</strong><span>RoomPlan + painting scope</span></div></div>
    </section>
    <section className="section-grid">
      <div className="panel wide"><div className="section-title"><div><p className="eyebrow">Jobs</p><h2>Projects</h2></div><Link to="/projects">View all <ArrowRight size={16}/></Link></div>
        <div className="project-list">{projects.slice(0,5).map(p => <Link className="project-row" to="/projects" key={p.id}><div><strong>{p.name}</strong><span>{p.address}{p.clientName?` · ${p.clientName}`:''}</span></div><div className="row-meta"><StatusPill status={p.status}/><span>{p.progress}%</span></div></Link>)}</div>
      </div>
      <div className="panel"><div className="section-title"><div><p className="eyebrow">My work</p><h2>Field shortcuts</h2></div></div>
        <div className="timeline"><div><i/><strong>Estimate</strong><span>Scan a room and build painting quantities</span></div><div><i/><strong>Field</strong><span>Capture jobsite photos and documentation</span></div><div><i/><strong>My Time</strong><span>Clock in, review and submit your own shifts</span></div></div>
      </div>
    </section>
  </div>
}
