import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { ActivityEntry, EventRecord, LifeItem, Mood, Place, Space, UserProfile } from '../types/models';
import { demoActivity, demoEvents, demoItems, demoPlaces, demoProfile, demoSpaces } from '../lib/demoData';
import { hasSupabase, supabase } from '../lib/supabase';
import { parsedIntentToItem } from '../lib/intentParser';

type AuthMode = 'loading' | 'demo' | 'signed-out' | 'signed-in';
interface LifeContextValue {
  authMode: AuthMode; profile: UserProfile | null; items: LifeItem[]; events: EventRecord[]; spaces: Space[]; places: Place[]; activity: ActivityEntry[];
  mood: Mood; setMood: (m: Mood) => void; online: boolean; syncState: 'synced'|'syncing'|'offline';
  enterDemo: () => void; signIn: (email:string,password:string) => Promise<string|null>; signUp:(email:string,password:string,name:string)=>Promise<string|null>; signOut:()=>Promise<void>;
  addItem: (text:string, overrides?:Partial<LifeItem>)=>Promise<void>; updateItem:(id:string,patch:Partial<LifeItem>)=>Promise<void>; completeItem:(id:string)=>Promise<void>; deleteItem:(id:string)=>Promise<void>; snoozeItem:(id:string)=>Promise<void>;
  addSpace:(name:string)=>Promise<void>; addPlace:(name:string,category:string,address:string)=>Promise<void>; saveProfile:(patch:Partial<UserProfile>)=>Promise<void>; refresh:()=>Promise<void>;
}
const LifeContext = createContext<LifeContextValue | null>(null);
const DEMO_KEY = 'justglance-demo-state-v1';

function loadDemo() {
  try { const raw = localStorage.getItem(DEMO_KEY); if (raw) return JSON.parse(raw) as {items:LifeItem[];spaces:Space[];places:Place[];profile:UserProfile}; } catch { /* noop */ }
  return { items: demoItems, spaces: demoSpaces, places: demoPlaces, profile: demoProfile };
}

export function LifeProvider({children}:{children:ReactNode}) {
  const [authMode,setAuthMode] = useState<AuthMode>('loading');
  const [profile,setProfile] = useState<UserProfile|null>(null);
  const [items,setItems] = useState<LifeItem[]>([]); const [events,setEvents] = useState<EventRecord[]>([]); const [spaces,setSpaces] = useState<Space[]>([]); const [places,setPlaces] = useState<Place[]>([]); const [activity,setActivity] = useState<ActivityEntry[]>([]);
  const [mood,setMood] = useState<Mood>('productive'); const [online,setOnline] = useState(navigator.onLine); const [syncState,setSyncState] = useState<'synced'|'syncing'|'offline'>('synced');

  const hydrateDemo = useCallback(() => { const d=loadDemo(); setProfile(d.profile); setItems(d.items); setSpaces(d.spaces); setPlaces(d.places); setEvents(demoEvents); setActivity(demoActivity); setAuthMode('demo'); },[]);

  const loadLive = useCallback(async () => {
    if (!supabase) return;
    setSyncState('syncing');
    const { data:{ user } } = await supabase.auth.getUser();
    if (!user) { setAuthMode('signed-out'); setSyncState('synced'); return; }
    const [{data:p},{data:i},{data:s},{data:pl},{data:e},{data:a}] = await Promise.all([
      supabase.from('profiles').select('*').eq('id',user.id).maybeSingle(),
      supabase.from('items').select('*').is('deleted_at',null).order('created_at',{ascending:false}),
      supabase.from('spaces_with_membership').select('*'),
      supabase.from('places').select('*').order('name'),
      supabase.from('events').select('*').order('start_at'),
      supabase.from('activity_log').select('*').order('created_at',{ascending:false}).limit(30)
    ]);
    setProfile(p ? { id:p.id,email:user.email??'',name:p.name??'',greeting_name:p.greeting_name??p.name??'',wake_time:p.wake_time??'07:00',sleep_time:p.sleep_time??'23:00',theme:p.theme??'system',onboarding_complete:p.onboarding_complete??false } : null);
    setItems((i??[]) as LifeItem[]); setSpaces((s??[]).map((x:any)=>({id:x.id,name:x.name,role:x.role,emoji:x.emoji,member_count:x.member_count})) as Space[]); setPlaces((pl??[]) as Place[]); setEvents((e??[]) as EventRecord[]); setActivity((a??[]).map((x:any)=>({id:x.id,text:x.summary??x.action,created_at:x.created_at})));
    setAuthMode('signed-in'); setSyncState('synced');
  },[]);

  useEffect(()=>{
    const onOnline=()=>{setOnline(true);setSyncState('synced')}; const onOffline=()=>{setOnline(false);setSyncState('offline')};
    addEventListener('online',onOnline); addEventListener('offline',onOffline);
    if (!hasSupabase || import.meta.env.VITE_DEMO_MODE === 'true') hydrateDemo(); else loadLive();
    const sub = supabase?.auth.onAuthStateChange(()=>loadLive()).data.subscription;
    return ()=>{removeEventListener('online',onOnline);removeEventListener('offline',onOffline);sub?.unsubscribe();};
  },[hydrateDemo,loadLive]);

  useEffect(()=>{ if(authMode==='demo'&&profile){ localStorage.setItem(DEMO_KEY,JSON.stringify({items,spaces,places,profile})); } },[authMode,items,spaces,places,profile]);
  useEffect(()=>{
    if(authMode!=='signed-in'||!supabase) return;
    const ch=supabase.channel('justglance-live').on('postgres_changes',{event:'*',schema:'public',table:'items'},()=>loadLive()).on('postgres_changes',{event:'*',schema:'public',table:'shopping_items'},()=>loadLive()).subscribe();
    return()=>{void supabase.removeChannel(ch)};
  },[authMode,loadLive]);

  const enterDemo=()=>hydrateDemo();
  const signIn=async(email:string,password:string)=>{ if(!supabase) return 'Supabase is not configured.'; const {error}=await supabase.auth.signInWithPassword({email,password}); return error?.message??null; };
  const signUp=async(email:string,password:string,name:string)=>{ if(!supabase) return 'Supabase is not configured.'; const {error}=await supabase.auth.signUp({email,password,options:{data:{name}}}); return error?.message??null; };
  const signOut=async()=>{ if(authMode==='demo'){ setAuthMode('signed-out');setProfile(null);return;} await supabase?.auth.signOut(); };

  const addItem=async(text:string,overrides:Partial<LifeItem>={})=>{
    const item={...parsedIntentToItem(text),...overrides};
    setItems(v=>[item,...v]);
    if(authMode==='signed-in'&&supabase){setSyncState('syncing'); const {id,...payload}=item; const {data,error}=await supabase.from('items').insert(payload).select().single(); if(error){setItems(v=>v.filter(x=>x.id!==id));throw error;} setItems(v=>v.map(x=>x.id===id?data as LifeItem:x));setSyncState('synced');}
  };
  const updateItem=async(id:string,patch:Partial<LifeItem>)=>{ const before=items.find(x=>x.id===id); setItems(v=>v.map(x=>x.id===id?{...x,...patch,updated_at:new Date().toISOString()}:x)); if(authMode==='signed-in'&&supabase){const {error}=await supabase.from('items').update(patch).eq('id',id);if(error&&before)setItems(v=>v.map(x=>x.id===id?before:x));} };
  const completeItem=(id:string)=>updateItem(id,{status:'completed',completed_at:new Date().toISOString()});
  const deleteItem=async(id:string)=>{ if(authMode==='demo'){setItems(v=>v.filter(x=>x.id!==id));return;} await updateItem(id,{deleted_at:new Date().toISOString()} as Partial<LifeItem>);setItems(v=>v.filter(x=>x.id!==id)); };
  const snoozeItem=async(id:string)=>{ const item=items.find(x=>x.id===id); const d=new Date();d.setDate(d.getDate()+1); await updateItem(id,{status:'snoozed',snoozed_until:d.toISOString(),postpone_count:(item?.postpone_count??0)+1}); };
  const addSpace=async(name:string)=>{ const s:Space={id:crypto.randomUUID(),name,role:'owner',emoji:'◌',member_count:1};setSpaces(v=>[...v,s]); if(authMode==='signed-in'&&supabase) await supabase.rpc('create_space',{space_name:name}); };
  const addPlace=async(name:string,category:string,address:string)=>{ const p:Place={id:crypto.randomUUID(),name,category,address};setPlaces(v=>[...v,p]);if(authMode==='signed-in'&&supabase){const {data}=await supabase.from('places').insert({name,category,address}).select().single();if(data)setPlaces(v=>v.map(x=>x.id===p.id?data as Place:x));} };
  const saveProfile=async(patch:Partial<UserProfile>)=>{setProfile(v=>v?{...v,...patch}:v);if(authMode==='signed-in'&&supabase&&profile) await supabase.from('profiles').update(patch).eq('id',profile.id);};
  const refresh=async()=>{ if(authMode==='signed-in') await loadLive(); };

  const value=useMemo(()=>({authMode,profile,items,events,spaces,places,activity,mood,setMood,online,syncState,enterDemo,signIn,signUp,signOut,addItem,updateItem,completeItem,deleteItem,snoozeItem,addSpace,addPlace,saveProfile,refresh}),[authMode,profile,items,events,spaces,places,activity,mood,online,syncState,loadLive]);
  return <LifeContext.Provider value={value}>{children}</LifeContext.Provider>;
}
export function useLife(){const c=useContext(LifeContext);if(!c)throw new Error('useLife must be used within LifeProvider');return c;}
