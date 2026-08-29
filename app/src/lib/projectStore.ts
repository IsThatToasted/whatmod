import { useSyncExternalStore } from 'react';
import type { Project } from '../types/domain';
import { sampleProjects } from './demo';
import { supabase } from './supabase';

const key = 'aurelium.projects.v3';
const events = new EventTarget();
let cache: Project[] = load();
function load(): Project[]{ try { const raw=localStorage.getItem(key); return raw ? JSON.parse(raw) : sampleProjects; } catch { return sampleProjects; } }
function commit(next:Project[]){ cache=next; localStorage.setItem(key,JSON.stringify(next)); events.dispatchEvent(new Event('change')); }
export function useProjects(){ return useSyncExternalStore((cb:()=>void)=>{events.addEventListener('change',cb); return ()=>events.removeEventListener('change',cb)},()=>cache,()=>cache); }

async function currentOrg(){
 if(!supabase)return null;
 const {data:{user}}=await supabase.auth.getUser(); if(!user)return null;
 const {data}=await supabase.from('organization_members').select('organization_id').eq('user_id',user.id).eq('active',true).limit(1).maybeSingle();
 return data?.organization_id ? {organizationID:data.organization_id,userID:user.id} : null;
}
export async function hydrateProjectsFromCloud(organizationID:string){
 if(!supabase)return;
 const {data,error}=await supabase.from('projects').select('id,name,address_line1,status,primary_trade,description,updated_at').eq('organization_id',organizationID).order('updated_at',{ascending:false});
 if(error){console.error(error);return}
 if(data){commit(data.map(row=>({id:row.id,name:row.name,address:row.address_line1??'',clientName:'',status:row.status,trade:row.primary_trade,progress:0,crewCount:0,updatedAt:new Date(row.updated_at).toLocaleDateString()})) as Project[])}
}
export function upsertProject(project:Project){
 const i=cache.findIndex(p=>p.id===project.id); const next=[...cache]; if(i>=0) next[i]=project; else next.unshift(project); commit(next);
 void (async()=>{const org=await currentOrg();if(!org||!supabase)return;const {error}=await supabase.from('projects').upsert({id:project.id,organization_id:org.organizationID,name:project.name,address_line1:project.address||null,status:project.status,primary_trade:project.trade,description:null,created_by:org.userID});if(error)console.error(error)})();
}
export function deleteProject(id:string){
 commit(cache.filter(p=>p.id!==id));
 void (async()=>{if(!supabase)return;const {error}=await supabase.from('projects').delete().eq('id',id);if(error)console.error(error)})();
}
