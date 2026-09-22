import { useMemo, useState } from 'react'
import { ArrowLeft, CalendarDays, CheckCircle2, Plus, Target } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAppData } from '../contexts/AppDataContext'
import { useOrganizer } from '../contexts/OrganizerContext'
import { ItemCard } from '../components/ItemCard'
import { lifeIntentParser } from '../lib/parser'
import { projectProgress } from '../lib/organizer'

export default function ProjectPage(){
 const {id}=useParams(); const nav=useNavigate(); const {items,events,notes,createItem}=useAppData(); const {projects,updateProject}=useOrganizer(); const [quick,setQuick]=useState('')
 const project=projects.find(p=>p.id===id); const related=useMemo(()=>items.filter(i=>i.project_id===id&&i.status!=='dismissed'),[items,id]); const progress=project?projectProgress(project,items):{percent:0,open:0,total:0,completed:0}
 if(!project)return <div className="page"><button className="text-button" onClick={()=>nav('/projects')}><ArrowLeft/>Projects</button><div className="empty-state large"><strong>Project not found.</strong></div></div>
 async function add(){if(!quick.trim())return;const parsed=lifeIntentParser.parse(quick);await createItem(parsed,quick,{project_id:project.id,is_inbox:false});setQuick('')}
 return <div className="page organizer-page"><button className="text-button back-link" onClick={()=>nav('/projects')}><ArrowLeft size={16}/>All projects</button><header className="project-hero"><div><span className="eyebrow">PROJECT</span><h1>{project.name}</h1><p>{project.description||'Add a clear outcome so Future You knows what finished means.'}</p></div><div className="project-health"><strong>{progress.percent}%</strong><span>{progress.completed} of {progress.total} actions complete</span></div></header>
 <div className="progress-track hero-progress"><span style={{width:`${progress.percent}%`}}/></div><div className="project-detail-grid"><section className="panel-card"><div className="section-heading"><div><span className="eyebrow">NEXT ACTIONS</span><h2>{progress.open} open</h2></div></div><div className="quick-add-line"><input value={quick} onChange={e=>setQuick(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')void add()}} placeholder="Add the next thing to do…"/><button onClick={add}><Plus/></button></div><div className="item-stack">{related.filter(i=>i.status==='open').map(item=><ItemCard key={item.id} item={item}/>)}</div>{!progress.open&&<div className="empty-state"><CheckCircle2/><strong>No open actions.</strong><span>Add a next step or mark the project complete.</span></div>}</section>
 <aside className="project-side"><section className="panel-card"><span className="eyebrow">PROJECT DETAILS</span><label className="detail-field"><Target size={16}/>Status<select value={project.status} onChange={e=>updateProject(project.id,{status:e.target.value as any})}><option value="active">Active</option><option value="paused">Paused</option><option value="completed">Completed</option></select></label><label className="detail-field"><CalendarDays size={16}/>Target<input type="date" value={project.target_date||''} onChange={e=>updateProject(project.id,{target_date:e.target.value||null})}/></label></section>
 <section className="panel-card"><span className="eyebrow">CONNECTED</span><div className="connected-counts"><div><strong>{events.filter(e=>e.project_id===id).length}</strong><span>appointments</span></div><div><strong>{notes.filter(n=>n.project_id===id).length}</strong><span>notes</span></div><div><strong>{related.filter(i=>i.status==='completed').length}</strong><span>completed</span></div></div></section></aside></div></div>
}
