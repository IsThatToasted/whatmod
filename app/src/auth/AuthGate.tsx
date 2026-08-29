import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, cloudConfigured } from '../lib/supabase';
import { hydrateProjectsFromCloud } from '../lib/projectStore';

type OrganizationSummary={id:string;name:string;slug:string};
type Membership={organization_id:string;role:string;display_name:string|null;organization?:OrganizationSummary|null};
type RawMembership={organization_id:string;role:string;display_name:string|null;organizations?:OrganizationSummary|null};
type AuthValue={user:User|null;membership:Membership|null;isAdmin:boolean;refreshMembership:()=>Promise<void>};
const AuthContext=createContext<AuthValue|null>(null);
export const useAuth=()=>{const v=useContext(AuthContext);if(!v)throw new Error('Auth unavailable');return v};

export function AuthGate({children}:{children:ReactNode}){
 const [session,setSession]=useState<Session|null>(null);
 const [loading,setLoading]=useState(true);
 const [startupFailed,setStartupFailed]=useState(false);
 const [membership,setMembership]=useState<Membership|null>(null);
 const refreshMembership=async()=>{if(!supabase||!session?.user){setMembership(null);return} const {data,error}=await supabase.from('organization_members').select('organization_id,role,display_name,organizations(id,name,slug)').eq('user_id',session.user.id).eq('active',true).limit(1).maybeSingle(); if(error) console.error(error); const raw=(data as RawMembership|null)??null; const next:Membership|null=raw?{organization_id:raw.organization_id,role:raw.role,display_name:raw.display_name,organization:raw.organizations??null}:null; setMembership(next); if(next?.organization_id) await hydrateProjectsFromCloud(next.organization_id)};
 useEffect(()=>{
   if(!supabase){setLoading(false);return}
   let active=true;
   const timeout=window.setTimeout(()=>{if(active){setStartupFailed(true);setLoading(false)}},8000);
   void supabase.auth.getSession().then(({data,error})=>{
     if(!active)return;
     window.clearTimeout(timeout);
     if(error){console.error(error);setStartupFailed(true)}
     setSession(data.session);
     setLoading(false);
   }).catch((error)=>{
     if(!active)return;
     window.clearTimeout(timeout);
     console.error(error);
     setStartupFailed(true);
     setLoading(false);
   });
   const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,s)=>{if(active){setSession(s);setStartupFailed(false)}});
   return()=>{active=false;window.clearTimeout(timeout);subscription.unsubscribe()};
 },[]);
 useEffect(()=>{void refreshMembership()},[session?.user?.id]);
 const value=useMemo(()=>({user:session?.user??null,membership,isAdmin:['owner','admin'].includes(membership?.role??''),refreshMembership}),[session,membership]);
 if(!cloudConfigured) return <SetupNotice/>;
 if(loading) return <div className="auth-screen"><div className="auth-card"><h1>Aurelium Field</h1><p>Opening your workspace…</p></div></div>;
 if(startupFailed) return <StartupFailure/>;
 if(!session) return <Login/>;
 if(!membership) return <AuthContext.Provider value={value}><OrganizationOnboarding/></AuthContext.Provider>;
 return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function StartupFailure(){return <div className="auth-screen"><div className="auth-card"><h1>Couldn’t open workspace</h1><p>The application started, but workspace initialization did not complete. Reference: <strong>AF-WEB-002</strong></p><button className="button primary" onClick={()=>window.location.reload()}>Reload app</button></div></div>}
function Login(){const signIn=async()=>{await supabase?.auth.signInWithOAuth({provider:'google',options:{redirectTo:window.location.href}})};return <div className="auth-screen"><div className="auth-card"><p className="eyebrow">Construction operations</p><h1>Aurelium Field</h1><p>Projects, estimating, field documentation, crews and time in one workspace.</p><button className="button primary" onClick={signIn}>Continue with Google</button></div></div>}
function SetupNotice(){return <div className="auth-screen"><div className="auth-card"><h1>Workspace unavailable</h1><p>Aurelium Field could not load its workspace configuration. Reference: <strong>AF-CFG-101</strong></p></div></div>}
function OrganizationOnboarding(){const {refreshMembership}=useAuth();const [mode,setMode]=useState<'create'|'join'>('create');const [name,setName]=useState('');const [invite,setInvite]=useState(new URLSearchParams(location.hash.split('?')[1]??'').get('invite')??'');const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 const create=async()=>{if(!supabase)return;setBusy(true);const {error}=await supabase.rpc('create_organization',{org_name:name.trim()});setBusy(false);if(error)setError(error.message);else await refreshMembership()};
 const join=async()=>{if(!supabase)return;setBusy(true);const token=invite.includes('invite=')?invite.split('invite=').pop()!:invite;const {error}=await supabase.rpc('accept_organization_invite',{invite_token:token.trim()});setBusy(false);if(error)setError(error.message);else await refreshMembership()};
 return <div className="auth-screen"><div className="auth-card"><p className="eyebrow">First setup</p><h1>Create or join organization</h1><div className="segmented"><button className={mode==='create'?'active':''} onClick={()=>setMode('create')}>Create</button><button className={mode==='join'?'active':''} onClick={()=>setMode('join')}>Join</button></div>{mode==='create'?<><label>Organization name<input value={name} onChange={e=>setName(e.target.value)} placeholder="Acme Painting"/></label><p className="muted">The first user becomes the owner/admin.</p><button className="button primary" disabled={busy||name.trim().length<2} onClick={create}>Create organization</button></>:<><label>Invite token or join link<input value={invite} onChange={e=>setInvite(e.target.value)}/></label><button className="button primary" disabled={busy||!invite.trim()} onClick={join}>Join organization</button></>}{error&&<p className="error-text">{error}</p>}</div></div>}
