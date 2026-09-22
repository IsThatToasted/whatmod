import { useMemo, useState } from 'react'
import { ArrowRight, Lightbulb, Plus, Search } from 'lucide-react'
import { useAppData } from '../contexts/AppDataContext'
import { useOrganizer } from '../contexts/OrganizerContext'

export default function ThoughtsPage(){
 const {notes,createNote,createItem}=useAppData(); const {projects}=useOrganizer(); const [text,setText]=useState(''),[query,setQuery]=useState('')
 const visible=useMemo(()=>notes.filter(n=>!query||`${n.title} ${n.body} ${(n.tags||[]).join(' ')}`.toLowerCase().includes(query.toLowerCase())),[notes,query])
 async function add(){if(!text.trim())return;await createNote(text);setText('')}
 return <div className="page organizer-page"><header className="page-header"><div><span className="eyebrow">THOUGHTS</span><h1>A place for things that are not tasks yet.</h1><p>Ideas, references, decisions, snippets and thoughts stay searchable without pretending everything needs a deadline.</p></div></header>
 <section className="thought-capture panel-card"><textarea value={text} onChange={e=>setText(e.target.value)} placeholder="Capture a thought before it disappears…" rows={3}/><button className="primary-button" onClick={add} disabled={!text.trim()}><Plus size={17}/>Remember this</button></section>
 <label className="inline-search thoughts-search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search your thoughts…"/></label>
 <div className="notes-grid">{visible.map(note=><article className="note-card" key={note.id}><span className="note-date">{new Date(note.created_at).toLocaleDateString()}</span><strong>{note.title}</strong><p>{note.body}</p><div className="note-actions"><button onClick={()=>createItem({type:'task',title:note.title,priority:'normal',tags:['from-note'],confidence:1},note.body,{description:note.body,is_inbox:true})}>Task <ArrowRight size={13}/></button>{projects[0]&&<span>Can connect to {projects[0].name} from the project screen.</span>}</div></article>)}</div>{!visible.length&&<div className="empty-state large"><Lightbulb/><strong>Nothing here yet.</strong><span>Capture the unfinished thought, not just the polished one.</span></div>}</div>
}
