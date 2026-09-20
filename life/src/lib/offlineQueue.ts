export type QueuedMutation = { id:string; kind:'insert-item'|'update-item'; payload:Record<string,unknown>; createdAt:string };
const KEY='justglance-live-mutation-queue-v1';
export function readQueue():QueuedMutation[]{try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch{return []}}
export function enqueue(kind:QueuedMutation['kind'],payload:Record<string,unknown>){const q=readQueue();q.push({id:crypto.randomUUID(),kind,payload,createdAt:new Date().toISOString()});localStorage.setItem(KEY,JSON.stringify(q));}
export function replaceQueue(q:QueuedMutation[]){localStorage.setItem(KEY,JSON.stringify(q));}
export function queueSize(){return readQueue().length;}
