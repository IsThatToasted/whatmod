import { useMemo } from 'react'
import { ArrowRight, Inbox, Lightbulb, Sparkles } from 'lucide-react'
import { useAppData } from '../contexts/AppDataContext'
import { useOrganizer } from '../contexts/OrganizerContext'
import { ItemCard } from '../components/ItemCard'

export default function InboxPage(){
 const {items,notes,updateItem,createItem}=useAppData(); const {projects}=useOrganizer()
 const inbox=useMemo(()=>items.filter(i=>i.status==='open'&&(i.is_inbox||(!i.due_date&&!i.project_id&&!i.place_id&&!i.space_id))),[items])
 const thoughts=notes.slice(0,8)
 return <div className="page organizer-page"><header className="page-header"><div><span className="eyebrow">BRAIN DUMP</span><h1>Put it here. Organize it later.</h1><p>JustGlance keeps loose thoughts and unprocessed tasks together until you decide what they mean.</p></div></header>
 <div className="split-layout"><section className="panel-card"><div className="section-heading"><div><span className="eyebrow">UNPROCESSED</span><h2><Inbox size={20}/> Inbox</h2></div><span className="count-pill">{inbox.length}</span></div><div className="item-stack">{inbox.map(item=><div key={item.id} className="triage-wrap"><ItemCard item={item} compact/><div className="triage-actions"><button onClick={()=>updateItem(item.id,{is_inbox:false,focus_pin:true})}><Sparkles size={14}/>Do soon</button><button onClick={()=>updateItem(item.id,{is_inbox:false,defer_until:new Date(Date.now()+7*86400000).toISOString()})}>Someday</button>{projects[0]&&<button onClick={()=>updateItem(item.id,{is_inbox:false,project_id:projects[0].id})}>To {projects[0].name}</button>}</div></div>)}</div>{!inbox.length&&<div className="empty-state"><Inbox/><strong>Inbox zero.</strong><span>Your brain can stop holding onto everything.</span></div>}</section>
 <section className="panel-card"><div className="section-heading"><div><span className="eyebrow">RECENT THOUGHTS</span><h2><Lightbulb size={20}/> Notes & ideas</h2></div></div><div className="thought-stack">{thoughts.map(note=><article key={note.id} className="thought-card"><strong>{note.title}</strong><p>{note.body}</p><button onClick={()=>createItem({type:'task',title:note.title,priority:'normal',tags:['from-note'],confidence:1},note.body,{description:note.body,is_inbox:true})}>Turn into task <ArrowRight size={14}/></button></article>)}</div>{!thoughts.length&&<div className="empty-state"><Lightbulb/><strong>No loose thoughts yet.</strong><span>Use Capture and choose Remember.</span></div>}</section></div></div>
}
