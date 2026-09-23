import { Archive, FileText, Image as ImageIcon, Link2, Search, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useAppData } from '../contexts/AppDataContext'
import type { CaptureRecord } from '../types'

type Filter='all'|'photos'|'files'|'links'|'text'

function MemoryCard({capture,getUrl,analyze}:{capture:CaptureRecord;getUrl:(path:string)=>Promise<string|null>;analyze:(id:string)=>Promise<unknown>}){
  const [url,setUrl]=useState<string|null>(null)
  const [busy,setBusy]=useState(false)
  useEffect(()=>{let active=true;if(capture.storage_path&&(capture.kind==='image'||capture.kind==='file'||capture.kind==='contact_import'||capture.kind==='calendar_import'))void getUrl(capture.storage_path).then(v=>{if(active)setUrl(v)});return()=>{active=false}},[capture.storage_path,capture.kind,getUrl])
  async function runAnalysis(){setBusy(true);try{await analyze(capture.id)}finally{setBusy(false)}}
  return <article className="memory-card">
    {capture.kind==='image'&&url?<a className="memory-thumb" href={url} target="_blank" rel="noreferrer"><img src={url} alt="Saved memory"/></a>:<div className="memory-type-icon">{capture.kind==='link'?<Link2/>:capture.kind==='image'?<ImageIcon/>:<FileText/>}</div>}
    <div className="memory-card-body">
      <div className="memory-meta"><span>{capture.parsed_kind||capture.kind}</span><span>{new Date(capture.created_at).toLocaleString()}</span><span>{capture.status}</span></div>
      <strong>{capture.title}</strong>
      <p>{capture.ai_summary||capture.raw_text?.slice(0,360)||capture.source_url||capture.file_name||'Saved memory'}</p>
      <div className="row-actions memory-actions">
        {capture.source_url&&<a className="secondary-button compact-action" href={capture.source_url} target="_blank" rel="noreferrer"><Link2 size={14}/>Open link</a>}
        {url&&<a className="secondary-button compact-action" href={url} target="_blank" rel="noreferrer">Open {capture.kind==='image'?'photo':'file'}</a>}
        {(capture.kind==='image'||capture.raw_text)&&capture.ai_status!=='processing'&&<button className="secondary-button compact-action" disabled={busy} onClick={()=>void runAnalysis()}><Sparkles size={14}/>{busy?'Analyzing…':capture.ai_status==='analyzed'?'Analyze again':'Smart analyze'}</button>}
      </div>
    </div>
  </article>
}

export default function MemoryPage(){
  const {captures,getCaptureSignedUrl,analyzeCapture}=useAppData()
  const [query,setQuery]=useState('')
  const [filter,setFilter]=useState<Filter>('all')
  const shown=useMemo(()=>{const q=query.trim().toLowerCase();return captures.filter(c=>{
    const filterOk=filter==='all'||(filter==='photos'&&c.kind==='image')||(filter==='links'&&c.kind==='link')||(filter==='text'&&['text','thought'].includes(c.kind))||(filter==='files'&&['file','calendar_import','contact_import'].includes(c.kind))
    if(!filterOk)return false
    if(!q)return true
    return `${c.title} ${c.raw_text||''} ${c.source_url||''} ${c.file_name||''} ${c.parsed_kind||''} ${c.ai_summary||''} ${JSON.stringify(c.ai_entities||{})}`.toLowerCase().includes(q)
  })},[captures,query,filter])
  const counts={all:captures.length,photos:captures.filter(c=>c.kind==='image').length,files:captures.filter(c=>['file','calendar_import','contact_import'].includes(c.kind)).length,links:captures.filter(c=>c.kind==='link').length,text:captures.filter(c=>['text','thought'].includes(c.kind)).length}
  return <div className="page organizer-page memory-page">
    <header className="page-header"><div><span className="eyebrow">MEMORY</span><h1>Everything you asked JustGlance to remember.</h1><p>The original capture stays here even after JustGlance turns it into a task, appointment, contact, shopping item or other structured record.</p></div></header>
    <div className="memory-toolbar"><label className="search-field"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search photos, files, links, people, text…"/></label><div className="chip-row memory-filters">{(['all','photos','files','links','text'] as Filter[]).map(v=><button key={v} className={`chip ${filter===v?'active':''}`} onClick={()=>setFilter(v)}>{v} <small>{counts[v]}</small></button>)}</div></div>
    <section className="memory-grid">{shown.map(c=><MemoryCard key={c.id} capture={c} getUrl={getCaptureSignedUrl} analyze={analyzeCapture}/>)}</section>
    {!shown.length&&<div className="empty-state"><Archive/><strong>No matching memories.</strong><span>Use Capture to type, paste, photograph or upload almost anything.</span></div>}
  </div>
}
