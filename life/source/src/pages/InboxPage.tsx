import { ArrowRight, FileText, Image as ImageIcon, Inbox, Link2, Lightbulb, LoaderCircle, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useAppData } from '../contexts/AppDataContext'
import { useOrganizer } from '../contexts/OrganizerContext'
import { ItemCard } from '../components/ItemCard'
import type { CaptureRecord } from '../types'

function CaptureCard({capture,onTask,onArchive,getUrl}:{capture:CaptureRecord;onTask:(capture:CaptureRecord)=>void;onArchive:(id:string)=>void;getUrl:(path:string)=>Promise<string|null>}){
 const [preview,setPreview]=useState<string|null>(null)
 useEffect(()=>{let active=true;if(capture.storage_path&&capture.kind==='image')void getUrl(capture.storage_path).then(url=>{if(active)setPreview(url)});return()=>{active=false}},[capture.storage_path,capture.kind,getUrl])
 const working=capture.ai_status==='queued'||capture.ai_status==='processing'
 return <article className="capture-inbox-card rich-capture-card">
   <div className="capture-kind-icon">{capture.kind==='image'?<ImageIcon/>:capture.kind==='link'?<Link2/>:<FileText/>}</div>
   {preview&&<a className="capture-preview" href={preview} target="_blank" rel="noreferrer"><img src={preview} alt="Saved capture"/></a>}
   <div className="capture-card-copy"><span className="eyebrow">{capture.parsed_kind||capture.kind}{working?' · ANALYZING':''}</span><strong>{capture.title}</strong>{working&&<p className="ai-working"><LoaderCircle size={14}/>Smart Intake is looking at this capture…</p>}<p>{capture.ai_summary||capture.raw_text?.slice(0,260)||capture.source_url||capture.file_name||'Saved for later organization.'}</p>{capture.ai_status==='error'&&<small className="capture-ai-error">The original capture is safe. Smart analysis can be retried later.</small>}<div className="triage-actions"><button onClick={()=>onTask(capture)}>Turn into task <ArrowRight size={14}/></button>{capture.source_url&&<a href={capture.source_url} target="_blank" rel="noreferrer">Open link</a>}{preview&&<a href={preview} target="_blank" rel="noreferrer">Open photo</a>}<button onClick={()=>onArchive(capture.id)}>Archive</button></div></div>
 </article>
}

export default function InboxPage(){
 const {items,notes,captures,updateItem,updateCapture,createItem,getCaptureSignedUrl}=useAppData(); const {projects}=useOrganizer()
 const captureInbox=useMemo(()=>captures.filter(c=>c.status==='inbox'),[captures])
 const inbox=useMemo(()=>items.filter(i=>i.status==='open'&&(i.is_inbox||(!i.due_date&&!i.project_id&&!i.place_id&&!i.space_id))),[items])
 const thoughts=notes.slice(0,8)
 async function captureToTask(capture:CaptureRecord){await createItem({type:'task',title:capture.title,priority:'normal',tags:['from-capture',capture.kind],confidence:.9},capture.raw_text||capture.ai_summary||capture.title,{description:capture.ai_summary||capture.raw_text||capture.source_url||null,is_inbox:true,space_id:capture.space_id||null,contact_id:capture.contact_id||null});await updateCapture(capture.id,{status:'processed'})}
 return <div className="page organizer-page"><header className="page-header"><div><span className="eyebrow">MEMORY INBOX</span><h1>Put anything here. JustGlance keeps the original.</h1><p>Loose tasks, thoughts, links, photos and files remain searchable even before they become structured actions.</p></div></header>
 <div className="split-layout"><section className="panel-card"><div className="section-heading"><div><span className="eyebrow">UNPROCESSED</span><h2><Inbox size={20}/> Inbox</h2></div><span className="count-pill">{inbox.length+captureInbox.length}</span></div><div className="item-stack">{inbox.map(item=><div key={item.id} className="triage-wrap"><ItemCard item={item} compact/><div className="triage-actions"><button onClick={()=>updateItem(item.id,{is_inbox:false,focus_pin:true})}><Sparkles size={14}/>Do soon</button><button onClick={()=>updateItem(item.id,{is_inbox:false,defer_until:new Date(Date.now()+7*86400000).toISOString()})}>Someday</button>{projects[0]&&<button onClick={()=>updateItem(item.id,{is_inbox:false,project_id:projects[0].id})}>To {projects[0].name}</button>}</div></div>)}</div>
 {captureInbox.length>0&&<div className="capture-inbox"><div className="section-heading inline"><h2>Saved memories & captures</h2><span>{captureInbox.length}</span></div>{captureInbox.map(capture=><CaptureCard key={capture.id} capture={capture} onTask={c=>void captureToTask(c)} onArchive={id=>void updateCapture(id,{status:'archived'})} getUrl={getCaptureSignedUrl}/>)}</div>}
 {!inbox.length&&!captureInbox.length&&<div className="empty-state"><Inbox/><strong>Inbox zero.</strong><span>Your brain can stop holding onto everything.</span></div>}</section>
 <section className="panel-card"><div className="section-heading"><div><span className="eyebrow">RECENT THOUGHTS</span><h2><Lightbulb size={20}/> Notes & ideas</h2></div></div><div className="thought-stack">{thoughts.map(note=><article key={note.id} className="thought-card"><strong>{note.title}</strong><p>{note.body}</p><button onClick={()=>createItem({type:'task',title:note.title,priority:'normal',tags:['from-note'],confidence:1},note.body,{description:note.body,is_inbox:true})}>Turn into task <ArrowRight size={14}/></button></article>)}</div>{!thoughts.length&&<div className="empty-state"><Lightbulb/><strong>No loose thoughts yet.</strong><span>Use Capture and choose Thought.</span></div>}</section></div></div>
}
