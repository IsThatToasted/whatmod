import { CheckCircle2, CircleDashed, Inbox, ListChecks, Search, TimerReset } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ItemCard } from '../components/ItemCard'
import { useAppData } from '../contexts/AppDataContext'
import { taskBucket } from '../lib/organizer'

const filters = [
  ['today','Today'],['inbox','Inbox'],['overdue','Overdue'],['upcoming','Next 7 days'],['waiting','Waiting'],['anytime','Anytime'],['completed','Completed'],['all','All']
] as const

export default function TasksPage(){
  const { items,spaces } = useAppData(); const [params]=useSearchParams(); const spaceId=params.get('space')||''; const space=spaces.find(candidate=>candidate.id===spaceId)
  const [filter,setFilter]=useState<(typeof filters)[number][0]>('today'); const [query,setQuery]=useState('')
  const taskItems=useMemo(()=>items.filter(item=>item.type!=='shopping'&&(!spaceId||item.space_id===spaceId)),[items,spaceId])
  const visible=useMemo(()=>taskItems.filter(item=>{
    if(query && !`${item.title} ${item.description||''} ${item.context_tags.join(' ')}`.toLowerCase().includes(query.toLowerCase())) return false
    if(filter==='all') return item.status!=='dismissed'
    return taskBucket(item)===filter
  }).sort((a,b)=>{
    const pa=a.priority==='high'?0:a.priority==='normal'?1:2; const pb=b.priority==='high'?0:b.priority==='normal'?1:2
    if(pa!==pb) return pa-pb
    return `${a.due_date||'9999'}${a.due_time||'99'}`.localeCompare(`${b.due_date||'9999'}${b.due_time||'99'}`)
  }),[taskItems,filter,query])
  const open=taskItems.filter(i=>i.status==='open').length; const inbox=taskItems.filter(i=>taskBucket(i)==='inbox').length; const overdue=taskItems.filter(i=>taskBucket(i)==='overdue').length
  return <div className="page organizer-page">
    <header className="page-header"><div><span className="eyebrow">TASKS{space?` · ${space.name.toUpperCase()}`:''}</span><h1>Everything you need to do.</h1><p>{space?`Tasks and chores shared inside ${space.name}.`:'One list underneath, useful views on top. Shopping now has its own dedicated home.'}</p></div></header>
    <section className="organizer-stats"><div><ListChecks/><span><strong>{open}</strong> open</span></div><div><Inbox/><span><strong>{inbox}</strong> inbox</span></div><div><TimerReset/><span><strong>{overdue}</strong> overdue</span></div><div><CheckCircle2/><span><strong>{taskItems.filter(i=>i.status==='completed').length}</strong> done</span></div></section>
    <div className="task-toolbar"><div className="smart-filter-row">{filters.map(([id,label])=><button key={id} className={filter===id?'active':''} onClick={()=>setFilter(id)}>{label}</button>)}</div><label className="inline-search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Filter tasks…"/></label></div>
    <section className="task-list-panel"><div className="section-heading"><div><span className="eyebrow">{filters.find(x=>x[0]===filter)?.[1]}</span><h2>{visible.length} {visible.length===1?'item':'items'}</h2></div></div><div className="item-stack">{visible.map(item=><ItemCard item={item} key={item.id}/>)}</div>{!visible.length&&<div className="empty-state"><CircleDashed size={34}/><strong>Clear here.</strong><span>Anything matching this view will show up automatically.</span></div>}</section>
  </div>
}
