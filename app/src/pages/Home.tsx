import { ArrowRight, Clock3, DollarSign, HardHat, Plus, Sparkles, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { sampleProjects } from '../lib/demo';
import { StatusPill } from '../components/StatusPill';

export function Home() {
  return <div className="page">
    <header className="page-header"><div><p className="eyebrow">Friday · Operations</p><h1>Good afternoon.</h1><p>Three jobs need attention. One estimate is ready to capture.</p></div><Link className="button primary" to="/estimator"><Sparkles size={18}/>Start smart estimate</Link></header>
    <section className="metric-row">
      <div className="metric"><span className="metric-icon"><DollarSign/></span><div><small>Pipeline</small><strong>$184,620</strong><span>12 open opportunities</span></div></div>
      <div className="metric"><span className="metric-icon"><HardHat/></span><div><small>Active work</small><strong>6 projects</strong><span>23 people scheduled</span></div></div>
      <div className="metric"><span className="metric-icon"><Clock3/></span><div><small>Labor today</small><strong>128.5 h</strong><span>94% submitted</span></div></div>
      <div className="metric"><span className="metric-icon"><TrendingUp/></span><div><small>Paint margin</small><strong>38.4%</strong><span>+2.1% this month</span></div></div>
    </section>
    <section className="section-grid">
      <div className="panel wide"><div className="section-title"><div><p className="eyebrow">Live work</p><h2>Projects</h2></div><Link to="/projects">View all <ArrowRight size={16}/></Link></div>
        <div className="project-list">{sampleProjects.map(p => <Link className="project-row" to={`/projects`} key={p.id}><div><strong>{p.name}</strong><span>{p.address} · {p.clientName}</span></div><div className="row-meta"><StatusPill status={p.status}/><span>{p.progress}%</span></div></Link>)}</div>
      </div>
      <div className="panel"><div className="section-title"><div><p className="eyebrow">Today</p><h2>Field pulse</h2></div></div>
        <div className="timeline"><div><i/><strong>7:02 AM</strong><span>North Queen crew clocked in</span></div><div><i/><strong>10:18 AM</strong><span>32 progress photos uploaded</span></div><div><i/><strong>1:40 PM</strong><span>Change request awaiting approval</span></div></div>
        <button className="button secondary full"><Plus size={17}/>Add field update</button>
      </div>
    </section>
  </div>
}
