import { useSyncExternalStore } from 'react';
import type { Project } from '../types/domain';
import { sampleProjects } from './demo';

const key = 'aurelium.projects.v2';
const events = new EventTarget();
let cache: Project[] = load();
function load(): Project[]{ try { const raw=localStorage.getItem(key); return raw ? JSON.parse(raw) : sampleProjects; } catch { return sampleProjects; } }
function commit(next:Project[]){ cache=next; localStorage.setItem(key,JSON.stringify(next)); events.dispatchEvent(new Event('change')); }
export function useProjects(){ return useSyncExternalStore((cb:()=>void)=>{events.addEventListener('change',cb); return ()=>events.removeEventListener('change',cb)},()=>cache,()=>cache); }
export function upsertProject(project:Project){ const i=cache.findIndex(p=>p.id===project.id); const next=[...cache]; if(i>=0) next[i]=project; else next.unshift(project); commit(next); }
export function deleteProject(id:string){ commit(cache.filter(p=>p.id!==id)); }
