import { ArrowRight, Edit3, Lightbulb, Plus, Search, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Modal } from '../components/Modal'
import { useAppData } from '../contexts/AppDataContext'
import { useAuth } from '../contexts/AuthContext'
import { useOrganizer } from '../contexts/OrganizerContext'
import { spaceCategoryAccess } from '../lib/spacePermissions'
import type { Note } from '../types'

export default function ThoughtsPage(){
 const {userId}=useAuth(); const {notes,spaces,members,createNote,updateNote,deleteNote,createItem}=useAppData(); const {projects}=useOrganizer(); const [params]=useSearchParams(); const spaceId=params.get('space')||''; const space=spaces.find(candidate=>candidate.id===spaceId)
 const member=space?members.find(m=>m.space_id===space.id&&m.user_id===userId):undefined; const access=spaceCategoryAccess(space,member,'notes'); const canEdit=!spaceId||access.canEdit
 function noteEditable(note:Note){if(!note.space_id)return true;const noteSpace=spaces.find(candidate=>candidate.id===note.space_id);const noteMember=noteSpace?members.find(candidate=>candidate.space_id===noteSpace.id&&candidate.user_id===userId):undefined;return spaceCategoryAccess(noteSpace,noteMember,'notes').canEdit}
 const [text,setText]=useState(''),[query,setQuery]=useState(''),[editing,setEditing]=useState<Note|null>(null),[editTitle,setEditTitle]=useState(''),[editBody,setEditBody]=useState(''),[editTags,setEditTags]=useState('')
 const visible=useMemo(()=>notes.filter(note=>(!spaceId||note.space_id===spaceId)&&(!query||`${note.title} ${note.body} ${(note.tags||[]).join(' ')}`.toLowerCase().includes(query.toLowerCase()))),[notes,query,spaceId])
 async function add(){if(!text.trim()||!canEdit)return;await createNote(text,spaceId||null);setText('')}
 function startEdit(note:Note){if(!noteEditable(note))return;setEditing(note);setEditTitle(note.title);setEditBody(note.body);setEditTags((note.tags||[]).join(', '))}
 async function saveEdit(){if(!editing||!editBody.trim()||!noteEditable(editing))return;await updateNote(editing.id,{title:editTitle.trim()||'Note',body:editBody.trim(),tags:editTags.split(',').map(tag=>tag.trim()).filter(Boolean)});setEditing(null)}
 async function remove(){if(!editing||!noteEditable(editing))return;await deleteNote(editing.id);setEditing(null)}
 return <div className="page organizer-page"><header className="page-header"><div><span className="eyebrow">THOUGHTS{space?` · ${space.name.toUpperCase()}`:''}</span><h1>A place for things that are not tasks yet.</h1><p>{space?`Shared notes and references inside ${space.name}.`:'Ideas, references, decisions, snippets and thoughts stay searchable without pretending everything needs a deadline.'}</p></div></header>
 {spaceId&&!canEdit&&<div className="permission-note prominent">You have view-only access to Thoughts & files in this Space.</div>}
 {canEdit&&<section className="thought-capture panel-card"><textarea value={text} onChange={e=>setText(e.target.value)} placeholder="Capture a thought before it disappears…" rows={3}/><button className="primary-button" onClick={add} disabled={!text.trim()}><Plus size={17}/>Remember this</button></section>}
 <label className="inline-search thoughts-search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search your thoughts…"/></label>
 <div className="notes-grid">{visible.map(note=><article className="note-card" key={note.id}><div className="note-card-head"><span className="note-date">{new Date(note.created_at).toLocaleDateString()}</span>{noteEditable(note)&&<button className="icon-button subtle" onClick={()=>startEdit(note)} aria-label={`Edit ${note.title}`}><Edit3 size={15}/></button>}</div><strong>{note.title}</strong><p>{note.body}</p>{note.tags?.length?<div className="note-tags">{note.tags.map(tag=><span key={tag}>{tag}</span>)}</div>:null}<div className="note-actions">{noteEditable(note)&&<button onClick={()=>createItem({type:'task',title:note.title,priority:'normal',tags:['from-note'],confidence:1},note.body,{description:note.body,is_inbox:true,space_id:note.space_id||null})}>Task <ArrowRight size={13}/></button>}{projects.find(project=>project.space_id===note.space_id||(!project.space_id&&!note.space_id))&&<span>Can connect to a project from the item editor.</span>}</div></article>)}</div>{!visible.length&&<div className="empty-state large"><Lightbulb/><strong>Nothing here yet.</strong><span>Capture the unfinished thought, not just the polished one.</span></div>}
 <Modal open={!!editing&&!!editing&&noteEditable(editing)} onClose={()=>setEditing(null)} title="Edit thought"><div className="form-stack"><label>Title<input value={editTitle} onChange={e=>setEditTitle(e.target.value)}/></label><label>Thought<textarea rows={7} value={editBody} onChange={e=>setEditBody(e.target.value)}/></label><label>Tags<input value={editTags} onChange={e=>setEditTags(e.target.value)} placeholder="idea, home, reference"/></label><div className="row-actions"><button className="text-button danger-text" onClick={remove}><Trash2 size={15}/>Delete</button><button className="primary-button" onClick={saveEdit} disabled={!editBody.trim()}>Save changes</button></div></div></Modal></div>
}
