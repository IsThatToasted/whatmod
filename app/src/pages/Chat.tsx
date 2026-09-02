import { useEffect, useMemo, useState } from 'react';
import { Hash, MessageCircle, Plus, Search, Send, SmilePlus, Users } from 'lucide-react';
import { useAuth } from '../auth/AuthGate';
import { supabase } from '../lib/supabase';

type Conversation={id:string;organization_id:string;project_id:string|null;kind:'direct'|'group'|'channel';title:string|null;updated_at:string};
type Message={id:string;conversation_id:string;sender_id:string;reply_to_id:string|null;body:string;edited_at:string|null;deleted_at:string|null;created_at:string};
type Member={user_id:string;display_name:string|null;email:string|null};

export function Chat(){
 const {membership,user}=useAuth();
 const [conversations,setConversations]=useState<Conversation[]>([]),[messages,setMessages]=useState<Message[]>([]),[people,setPeople]=useState<Member[]>([]);
 const [active,setActive]=useState<string|null>(null),[draft,setDraft]=useState(''),[search,setSearch]=useState(''),[error,setError]=useState('');
 const names=useMemo(()=>new Map(people.map(p=>[p.user_id,p.display_name||p.email||'Teammate'])),[people]);
 const selected=conversations.find(c=>c.id===active)??null;
 const filtered=conversations.filter(c=>(c.title||'Direct message').toLowerCase().includes(search.toLowerCase()));
 const loadConversations=async()=>{if(!supabase||!membership)return;const [{data:c,error:ce},{data:p,error:pe}]=await Promise.all([
   supabase.from('chat_conversations').select('id,organization_id,project_id,kind,title,updated_at').eq('organization_id',membership.organization_id).order('updated_at',{ascending:false}),
   supabase.rpc('admin_list_members')
 ]); if(ce||pe){setError((ce||pe)?.message||'AF-CHAT-LOAD');return} setConversations((c||[]) as Conversation[]);setPeople((p||[]) as Member[]);if(!active&&c?.[0])setActive(c[0].id)};
 const loadMessages=async(id:string)=>{if(!supabase)return;const {data,error}=await supabase.from('chat_messages').select('id,conversation_id,sender_id,reply_to_id,body,edited_at,deleted_at,created_at').eq('conversation_id',id).order('created_at',{ascending:true}).limit(300);if(error){setError('AF-CHAT-HISTORY');return}setMessages((data||[]) as Message[])};
 useEffect(()=>{void loadConversations()},[membership?.organization_id]);
 useEffect(()=>{
  const client=supabase;
  if(!active||!client)return;
  void loadMessages(active);
  const channel=client.channel(`chat:${active}`).on('postgres_changes',{event:'*',schema:'public',table:'chat_messages',filter:`conversation_id=eq.${active}`},()=>void loadMessages(active)).subscribe();
  return()=>{void client.removeChannel(channel)};
 },[active]);
 const send=async()=>{if(!supabase||!membership||!user||!active||!draft.trim())return;const body=draft.trim();setDraft('');const {error}=await supabase.from('chat_messages').insert({conversation_id:active,organization_id:membership.organization_id,sender_id:user?.id,body});if(error){setDraft(body);setError('AF-CHAT-SEND');return}await supabase.from('chat_conversations').update({updated_at:new Date().toISOString()}).eq('id',active);void loadMessages(active)};
 const createChannel=async()=>{if(!supabase||!membership||!user)return;const title=prompt('Channel name');if(!title?.trim())return;const {data,error}=await supabase.from('chat_conversations').insert({organization_id:membership.organization_id,kind:'channel',title:title.trim(),created_by:user?.id}).select('id').single();if(error||!data){setError('AF-CHAT-CREATE');return}await supabase.from('chat_members').insert({conversation_id:data.id,organization_id:membership.organization_id,user_id:user?.id});await loadConversations();setActive(data.id)};
 return <div className="page chat-page"><header className="page-header"><div><p className="eyebrow">Team communication</p><h1>Chat</h1><p>Direct messages, project conversations, channels, replies and field coordination in one organization-scoped workspace.</p></div><button className="button primary" onClick={createChannel}><Plus size={17}/>New channel</button></header>{error&&<div className="error-banner">Something went wrong. Reference {error}.</div>}<div className="chat-shell"><aside className="chat-list panel"><div className="chat-search"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search conversations"/></div>{filtered.length===0?<div className="compact-empty"><MessageCircle/><strong>No conversations yet</strong><span>Create a channel to start coordinating.</span></div>:filtered.map(c=><button key={c.id} className={active===c.id?'chat-conversation active':'chat-conversation'} onClick={()=>setActive(c.id)}>{c.kind==='channel'?<Hash size={18}/>:<Users size={18}/>}<div><strong>{c.title||'Direct message'}</strong><span>{c.kind}</span></div></button>)}</aside><section className="chat-thread panel">{selected?<><div className="chat-thread-head"><div><strong>{selected.title||'Direct message'}</strong><span>{selected.kind==='channel'?'Organization channel':'Team conversation'}</span></div></div><div className="chat-messages">{messages.map(m=><div className="chat-message" key={m.id}><div className="chat-avatar">{(names.get(m.sender_id)||'?')[0]}</div><div><div className="chat-meta"><strong>{names.get(m.sender_id)||'Teammate'}</strong><span>{new Date(m.created_at).toLocaleString()}</span></div><p>{m.deleted_at?'Message deleted':m.body}</p><button className="chat-react" aria-label="React"><SmilePlus size={14}/>React</button></div></div>)}</div><div className="chat-compose"><textarea value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();void send()}}} placeholder={`Message ${selected.title||'conversation'}`}/><button className="icon-button chat-send" disabled={!draft.trim()} onClick={()=>void send()} aria-label="Send"><Send size={19}/></button></div></>:<div className="compact-empty"><MessageCircle/><strong>Select a conversation</strong><span>Your messages will appear here.</span></div>}</section></div></div>
}
