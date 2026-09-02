import { useEffect, useMemo, useState } from 'react';
import { Hash, LockKeyhole, MessageCircle, Plus, Search, Send, ShieldCheck, UserRound, Users, X } from 'lucide-react';
import { useAuth } from '../auth/AuthGate';
import { supabase } from '../lib/supabase';

type Conversation = {
  id: string;
  organization_id: string;
  project_id: string | null;
  kind: 'direct' | 'group' | 'channel';
  title: string | null;
  audience: 'organization' | 'members' | 'admins' | null;
  updated_at: string;
};

type Message = { id:string; conversation_id:string; sender_id:string; reply_to_id:string|null; body:string; edited_at:string|null; deleted_at:string|null; created_at:string };
type Member = { user_id:string; display_name:string|null; email:string|null };
type CreateMode='channel'|'group'|'direct';
type Audience='organization'|'members'|'admins';

export function Chat() {
  const { membership, user, isAdmin } = useAuth();
  const [conversations,setConversations]=useState<Conversation[]>([]);
  const [messages,setMessages]=useState<Message[]>([]);
  const [people,setPeople]=useState<Member[]>([]);
  const [active,setActive]=useState<string|null>(null);
  const [draft,setDraft]=useState('');
  const [search,setSearch]=useState('');
  const [error,setError]=useState('');
  const [showCreate,setShowCreate]=useState(false);
  const [replyTo,setReplyTo]=useState<Message|null>(null);

  const names=useMemo(()=>new Map(people.map(p=>[p.user_id,p.display_name||p.email||'Teammate'])),[people]);
  const selected=conversations.find(c=>c.id===active)??null;
  const filtered=conversations.filter(c=>(c.title||'Direct message').toLowerCase().includes(search.toLowerCase()));

  const loadDirectory=async()=>{const client=supabase;if(!client||!membership)return;const {data,error:e}=await client.rpc('chat_list_members',{p_organization_id:membership.organization_id});if(!e)setPeople((data||[]) as Member[])};
  const loadConversations=async()=>{const client=supabase;if(!client||!membership)return;const {data,error:e}=await client.from('chat_conversations').select('id,organization_id,project_id,kind,title,audience,updated_at').eq('organization_id',membership.organization_id).order('updated_at',{ascending:false});if(e){setError('AF-CHAT-101');return}const rows=(data||[]) as Conversation[];setConversations(rows);setError('');setActive(current=>current&&rows.some(c=>c.id===current)?current:(rows[0]?.id??null));void loadDirectory()};
  const loadMessages=async(id:string)=>{const client=supabase;if(!client)return;const {data,error:e}=await client.from('chat_messages').select('id,conversation_id,sender_id,reply_to_id,body,edited_at,deleted_at,created_at').eq('conversation_id',id).order('created_at',{ascending:true}).limit(400);if(e){setError('AF-CHAT-103');return}setMessages((data||[]) as Message[]);setError('')};

  useEffect(()=>{void loadConversations()},[membership?.organization_id]);
  useEffect(()=>{const client=supabase;if(!active||!client){setMessages([]);return}void loadMessages(active);const channel=client.channel(`chat:${active}`).on('postgres_changes',{event:'*',schema:'public',table:'chat_messages',filter:`conversation_id=eq.${active}`},()=>void loadMessages(active)).subscribe();return()=>{void client.removeChannel(channel)}},[active]);

  const send=async()=>{const client=supabase;if(!client||!membership||!user||!active||!draft.trim())return;const body=draft.trim();const replyID=replyTo?.id??null;setDraft('');setReplyTo(null);const {error:e}=await client.from('chat_messages').insert({conversation_id:active,organization_id:membership.organization_id,sender_id:user.id,reply_to_id:replyID,body});if(e){setDraft(body);setError('AF-CHAT-104');return}setError('');void loadMessages(active);void loadConversations()};

  const createConversation=async(input:{title:string;kind:CreateMode;audience:Audience;memberIDs:string[]})=>{const client=supabase;if(!client||!membership)return false;const {data,error:e}=await client.rpc('chat_create_conversation',{p_organization_id:membership.organization_id,p_title:input.title,p_kind:input.kind,p_project_id:null,p_audience:input.audience,p_member_ids:input.memberIDs});if(e||typeof data!=='string'){setError('AF-CHAT-CREATE');return false}await loadConversations();setActive(data);setError('');return true};

  const groups=[['Channels',filtered.filter(c=>c.kind==='channel')],['Groups',filtered.filter(c=>c.kind==='group')],['Direct messages',filtered.filter(c=>c.kind==='direct')]] as const;
  return <div className="page chat-page">
    <header className="page-header chat-page-header"><div><p className="eyebrow">Team communication</p><h1>Chat</h1><p>Fast field conversations, private crew groups, project channels and admin-only coordination.</p></div><button className="button primary" onClick={()=>setShowCreate(true)}><Plus size={17}/>New chat</button></header>
    {error&&<div className="error-banner">Chat could not update. Reference {error}.</div>}
    <div className="chat-shell chat-shell-polished">
      <aside className="chat-list panel">
        <div className="chat-search"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search chats"/></div>
        <div className="chat-sidebar-scroll">{groups.map(([label,rows])=>rows.length>0&&<div className="chat-group" key={label}><span className="chat-group-title">{label}</span>{rows.map(c=><button key={c.id} className={active===c.id?'chat-conversation active':'chat-conversation'} onClick={()=>setActive(c.id)}><span className="chat-icon">{c.kind==='channel'?<Hash size={18}/>:c.kind==='direct'?<UserRound size={18}/>:<Users size={18}/>}</span><div><strong>{c.title||'Direct message'}{c.audience==='admins'&&<LockKeyhole size={12}/>}</strong><span>{c.audience==='admins'?'Admins only':c.audience==='members'?'Private conversation':c.kind==='channel'?'Organization channel':c.kind}</span></div></button>)}</div>)}</div>
      </aside>
      <section className="chat-thread panel">{selected?<><div className="chat-thread-head"><div className="chat-thread-title"><span className="chat-icon large">{selected.kind==='channel'?<Hash size={20}/>:selected.kind==='direct'?<UserRound size={20}/>:<Users size={20}/>}</span><div><strong>{selected.title||'Direct message'}</strong><span>{selected.audience==='admins'?'Admins only · restricted':selected.audience==='members'?'Private members':selected.kind==='channel'?'Everyone in the organization':'Team conversation'}</span></div></div></div><div className="chat-messages">{messages.length===0&&<div className="compact-empty"><MessageCircle/><strong>Start the conversation</strong><span>Messages sent here stay attached to this chat.</span></div>}{messages.map(m=>{const mine=m.sender_id===user?.id;const replied=messages.find(x=>x.id===m.reply_to_id);return <div className={mine?'chat-message mine':'chat-message'} key={m.id}><div className="chat-avatar">{(names.get(m.sender_id)||'?')[0]}</div><div className="chat-message-body"><div className="chat-meta"><strong>{mine?'You':names.get(m.sender_id)||'Teammate'}</strong><span>{new Date(m.created_at).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</span></div><div className="chat-bubble">{replied&&<div className="chat-reply-preview">↳ {replied.body}</div>}<p>{m.deleted_at?'Message deleted':m.body}</p></div>{!m.deleted_at&&<button className="chat-reply-action" onClick={()=>setReplyTo(m)}>Reply</button>}</div></div>})}</div><div className="chat-compose-wrap">{replyTo&&<div className="chat-replying"><span><strong>Replying to {names.get(replyTo.sender_id)||'teammate'}</strong><small>{replyTo.body}</small></span><button onClick={()=>setReplyTo(null)}><X size={16}/></button></div>}<div className="chat-compose"><textarea value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();void send()}}} placeholder={`Message ${selected.title||'conversation'}`}/><button className="icon-button chat-send" disabled={!draft.trim()} onClick={()=>void send()} aria-label="Send"><Send size={19}/></button></div></div></>:<div className="compact-empty"><MessageCircle/><strong>Select a conversation</strong><span>Your messages will appear here.</span></div>}</section>
    </div>
    {showCreate&&<NewChatModal people={people} isAdmin={isAdmin} onClose={()=>setShowCreate(false)} onCreate={createConversation}/>} 
  </div>
}

function NewChatModal({people,isAdmin,onClose,onCreate}:{people:Member[];isAdmin:boolean;onClose:()=>void;onCreate:(v:{title:string;kind:CreateMode;audience:Audience;memberIDs:string[]})=>Promise<boolean>}){
 const [mode,setMode]=useState<CreateMode>('channel');const [title,setTitle]=useState('');const [audience,setAudience]=useState<Audience>('organization');const [members,setMembers]=useState<string[]>([]);const [busy,setBusy]=useState(false);
 const toggle=(id:string)=>setMembers(v=>v.includes(id)?v.filter(x=>x!==id):[...v,id]);
 const switchMode=(m:CreateMode)=>{setMode(m);setMembers([]);if(m==='channel')setAudience('organization');else setAudience('members')};
 const valid=mode==='direct'?members.length===1:!!title.trim()&&((mode==='group'||audience==='members')?members.length>0:true);
 const create=async()=>{if(!valid)return;setBusy(true);const direct=mode==='direct'?people.find(p=>p.user_id===members[0]):null;const ok=await onCreate({title:mode==='direct'?(direct?.display_name||direct?.email||'Direct message'):title.trim(),kind:mode,audience:mode==='channel'?audience:'members',memberIDs:members});setBusy(false);if(ok)onClose()};
 return <div className="modal-backdrop"><div className="modal-card chat-create-modal"><div className="modal-head"><div><p className="eyebrow">New conversation</p><h2>Create chat</h2></div><button className="icon-button" onClick={onClose}><X/></button></div><div className="chat-mode-tabs"><button className={mode==='channel'?'active':''} onClick={()=>switchMode('channel')}><Hash/>Channel</button><button className={mode==='group'?'active':''} onClick={()=>switchMode('group')}><Users/>Group</button><button className={mode==='direct'?'active':''} onClick={()=>switchMode('direct')}><UserRound/>Direct</button></div>{mode!=='direct'&&<label>Conversation name<input value={title} onChange={e=>setTitle(e.target.value)} placeholder={mode==='channel'?'Safety / General / Project coordination':'Crew group name'}/></label>}{mode==='channel'&&<div><span className="field-label">Who can access</span><div className="audience-grid"><button className={audience==='organization'?'active':''} onClick={()=>setAudience('organization')}><Users/><strong>Everyone</strong><span>All organization members</span></button><button className={audience==='members'?'active':''} onClick={()=>setAudience('members')}><UserRound/><strong>Selected</strong><span>Invite specific people</span></button>{isAdmin&&<button className={audience==='admins'?'active':''} onClick={()=>setAudience('admins')}><ShieldCheck/><strong>Admins only</strong><span>Hidden from employees</span></button>}</div></div>}{(mode!=='channel'||audience==='members')&&<div className="chat-member-picker"><span className="field-label">{mode==='direct'?'Choose teammate':'Invite members'}</span>{people.map(p=><button key={p.user_id} className={members.includes(p.user_id)?'selected':''} onClick={()=>mode==='direct'?setMembers([p.user_id]):toggle(p.user_id)}><span className="chat-avatar small">{(p.display_name||p.email||'?')[0]}</span><span><strong>{p.display_name||p.email||'Teammate'}</strong>{p.display_name&&p.email&&<small>{p.email}</small>}</span><b>{members.includes(p.user_id)?'✓':''}</b></button>)}</div>}<div className="modal-actions"><button className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={!valid||busy} onClick={()=>void create()}>{busy?'Creating…':'Create chat'}</button></div></div></div>
}
