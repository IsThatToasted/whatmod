import { Calendar, Camera, ContactRound, FileText, FolderKanban, Image as ImageIcon, Link2, MapPin, Paperclip, Send, Sparkles, Users, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useAppData } from '../contexts/AppDataContext'
import { useOrganizer } from '../contexts/OrganizerContext'
import { isoToday } from '../lib/organizer'
import { analyzeSmartText, inspectFile } from '../lib/smartIntake'
import { parseVCardContacts, resolveContactFromText } from '../lib/contacts'
import type { Contact, ItemType, Priority, UniversalIntakeAnalysis } from '../types'

type CaptureKind = ItemType | 'note' | 'appointment' | 'project' | 'link' | 'contact'

function mappedKind(kind: ReturnType<typeof analyzeSmartText>['kind']): CaptureKind {
  if (kind === 'appointment') return 'appointment'
  if (kind === 'thought') return 'note'
  if (kind === 'link') return 'link'
  if (['shopping','reminder','call','errand','chore','idea','task'].includes(kind)) return kind as ItemType
  return 'task'
}

function contactDraftFromText(text:string) {
  const email=text.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i)?.[0]||null
  const phone=text.match(/(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/)?.[0]||null
  let name=text.replace(email||'','').replace(phone||'','').replace(/^\s*(?:add|save|new)?\s*contact\s+(?:for\s+)?/i,'').replace(/\b(?:phone|mobile|cell|email|is)\b.*$/i,'').trim()
  if (!name || name.length>100) name='New contact'
  const parts=name.split(/\s+/)
  return { display_name:name, first_name:parts[0]||null, last_name:parts.length>1?parts.slice(1).join(' '):null, phone_mobile:phone, email_personal:email }
}

async function prepareImageForUpload(file:File) {
  if (!file.type.startsWith('image/') || file.size < 1_200_000) return file
  try {
    const bitmap=await createImageBitmap(file)
    const max=1800
    const scale=Math.min(1,max/Math.max(bitmap.width,bitmap.height))
    const width=Math.max(1,Math.round(bitmap.width*scale)),height=Math.max(1,Math.round(bitmap.height*scale))
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height
    const ctx=canvas.getContext('2d');if(!ctx){bitmap.close();return file}
    ctx.drawImage(bitmap,0,0,width,height);bitmap.close()
    const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/jpeg',.84))
    if (!blob || blob.size>=file.size) return file
    const base=file.name.replace(/\.[^.]+$/,'')||'photo'
    return new File([blob],`${base}.jpg`,{type:'image/jpeg',lastModified:file.lastModified})
  } catch { return file }
}

export function CaptureSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { createItem, createNote, createEvent, createCapture, updateCapture, analyzeCapture, importCalendarEvents, createContact, contacts, spaces, places } = useAppData()
  const { projects, createProject, createReminder } = useOrganizer()
  const [text, setText] = useState('')
  const [kind, setKind] = useState<CaptureKind | null>(null)
  const [priority, setPriority] = useState<Priority>('normal')
  const [spaceId, setSpaceId] = useState('')
  const [projectId, setProjectId] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [placeId, setPlaceId] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)
  const [saveStage,setSaveStage]=useState('')
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement | null>(null)
  const cameraRef = useRef<HTMLInputElement | null>(null)
  const lastInferredDate = useRef('')
  const lastInferredTime = useRef('')
  const analysis = useMemo(() => text.trim() ? analyzeSmartText(text) : null, [text])
  const contactMatch = useMemo(() => text.trim() ? resolveContactFromText(text, contacts) : null, [text, contacts])
  const effectiveKind = kind || (analysis ? mappedKind(analysis.kind) : null)

  useEffect(() => {
    const inferredDate = analysis?.dueDate || ''
    const inferredTime = analysis?.dueTime || ''
    setDate(current => (!current || current === lastInferredDate.current) ? inferredDate : current)
    setTime(current => (!current || current === lastInferredTime.current) ? inferredTime : current)
    lastInferredDate.current = inferredDate
    lastInferredTime.current = inferredTime
  }, [analysis?.dueDate, analysis?.dueTime])

  if (!open) return null

  function reset() {
    setText(''); setKind(null); setPriority('normal'); setSpaceId(''); setProjectId(''); setDate(''); setTime(''); setPlaceId(''); setFiles([]); setError('');setSaveStage('');lastInferredDate.current=''; lastInferredTime.current=''
  }

  async function saveText() {
    if (!text.trim() || !analysis) return
    const chosen = kind || mappedKind(analysis.kind)
    // Preserve the original first. If any structuring step fails, the memory remains in Inbox.
    const memory = await createCapture({
      kind: chosen === 'note' ? 'thought' : chosen === 'link' ? 'link' : 'text',
      title: analysis.title || text.trim().slice(0,120), raw_text: text.trim(), source_url: analysis.url || null,
      space_id: spaceId || null, parsed_kind: chosen,
      parsed_data: { local: { kind:analysis.kind, title:analysis.title, date:analysis.dueDate, time:analysis.dueTime, location:analysis.location, url:analysis.url, confidence:analysis.confidence } },
      status: 'inbox', ai_status:'not_requested',
    })

    if (chosen === 'note') {
      await createNote(text, spaceId || null)
      await updateCapture(memory.id,{status:'processed',parsed_kind:'thought'})
      return
    }
    if (chosen === 'project') {
      const project=await createProject({ name: analysis.title || text.trim(), description: text.trim() === analysis.title ? undefined : text.trim(), priority, space_id: spaceId || null })
      await updateCapture(memory.id,{status:'processed',parsed_kind:'project',parsed_data:{...(memory.parsed_data||{}),project_id:project.id}})
      return
    }
    if (chosen === 'contact') {
      const contact=await createContact(contactDraftFromText(text))
      await updateCapture(memory.id,{status:'processed',parsed_kind:'contact',contact_id:contact.id})
      return
    }
    if (chosen === 'link') {
      await updateCapture(memory.id,{status:'processed',source_url:analysis.url||memory.source_url||null,parsed_kind:'link'})
      return
    }
    if (chosen === 'appointment') {
      const eventDate = date || analysis.dueDate || isoToday()
      const startTime = time || analysis.dueTime || '09:00'
      const selectedPlace = places.find(p=>p.id===placeId)
      const created = await createEvent({
        title: analysis.title, event_date: eventDate, start_time: startTime, end_time: analysis.endTime,
        location: selectedPlace?.name || analysis.location || null,
        notes: text.trim() === analysis.title ? null : text.trim(), attendees: [], recurrence_rule: null,
        project_id: projectId || null, space_id: spaceId || null, contact_id: contactMatch?.id || null,
        provider: 'internal-smart', external_id: null,
      })
      await updateCapture(memory.id,{status:'processed',created_event_id:created.id,contact_id:contactMatch?.id||null,parsed_kind:'appointment'})
      const when = new Date(`${eventDate}T${startTime}:00`)
      if (!Number.isNaN(when.getTime())) { when.setMinutes(when.getMinutes() - 30); if (when.getTime() > Date.now()) await createReminder({ title: created.title, body: created.location ? `At ${created.location}` : null, remind_at: when.toISOString(), event_id: created.id }) }
      return
    }

    const intent = { ...analysis.intent, type: chosen as ItemType, priority }
    const selectedPlace = places.find(place => place.id === placeId)
    const dueDate = date || analysis.dueDate || null
    const dueTime = time || analysis.dueTime || null
    const item = await createItem(intent, text, {
      space_id: spaceId || null, project_id: projectId || null, due_date: dueDate, due_time: dueTime,
      place_id: placeId || null, place_name: selectedPlace?.name || analysis.location || null,
      contact_id: contactMatch?.id || null,
      is_inbox: !(dueDate || projectId || placeId || spaceId),
      shopping: intent.type==='shopping' ? { preferred_store: analysis.location || intent.context || null, source_url: analysis.url || null } : undefined,
    })
    await updateCapture(memory.id,{status:'processed',created_item_id:item.id,contact_id:contactMatch?.id||null,parsed_kind:intent.type})
    if ((chosen === 'reminder' || intent.type === 'reminder') && dueDate) {
      const when = new Date(`${dueDate}T${dueTime || '09:00'}:00`)
      if (!Number.isNaN(when.getTime())) await createReminder({ title: item.title, body: item.description || null, remind_at: when.toISOString(), item_id: item.id })
    }
  }

  async function applyAI(captureId:string, smart:UniversalIntakeAnalysis) {
    const matched=smart.person?resolveContactFromText(smart.person,contacts):null
    // Auto-structure only when Smart Intake is confident. Ambiguous memories stay in Inbox for review.
    if (smart.suggested_action==='keep_memory' && smart.confidence>=0.72) {
      await updateCapture(captureId,{status:'processed',parsed_kind:smart.kind})
      return
    }
    if (smart.confidence<0.82) return
    if (smart.suggested_action==='create_contact' && smart.contact?.display_name) {
      const existing=resolveContactFromText(String(smart.contact.display_name),contacts)
      const contact=existing || await createContact({ ...smart.contact, display_name:String(smart.contact.display_name), notes: smart.contact.notes || smart.summary, tags:[...(smart.contact.tags||[]),'from-smart-intake'] })
      await updateCapture(captureId,{status:'processed',contact_id:contact.id,parsed_kind:'contact'})
      return
    }
    if (smart.suggested_action==='create_event' && smart.due_date) {
      const created=await createEvent({ title:smart.title,event_date:smart.due_date,start_time:smart.due_time||'09:00',end_time:null,location:smart.location||null,notes:smart.summary||null,attendees:[],recurrence_rule:null,space_id:spaceId||null,project_id:null,contact_id:matched?.id||null,provider:'smart-vision',external_id:null })
      await updateCapture(captureId,{status:'processed',created_event_id:created.id,contact_id:matched?.id||null})
      return
    }
    if (smart.suggested_action==='create_item') {
      const type:ItemType = smart.kind==='shopping'?'shopping':smart.kind==='call'?'call':smart.kind==='reminder'?'reminder':smart.kind==='idea'?'idea':'task'
      const created=await createItem({type,title:smart.title,priority:'normal',tags:['from-smart-intake',...(smart.tags||[])],confidence:smart.confidence,dueDate:smart.due_date||null,dueTime:smart.due_time||null},smart.summary||smart.title,{description:smart.summary||null,space_id:spaceId||null,due_date:smart.due_date||null,due_time:smart.due_time||null,contact_id:matched?.id||null,is_inbox:!smart.due_date,shopping:type==='shopping'?{preferred_store:smart.shopping?.store||null,estimated_price:smart.shopping?.price??null,currency:smart.shopping?.currency||null}:undefined})
      await updateCapture(captureId,{status:'processed',created_item_id:created.id,contact_id:matched?.id||null})
      return
    }
  }

  async function saveFiles() {
    for (const original of files) {
      if (original.size > 15 * 1024 * 1024) throw new Error(`${original.name} is over the 15 MB capture limit.`)
      if (/\.vcf$/i.test(original.name) || /vcard/i.test(original.type)) {
        setSaveStage('Importing contacts…')
        const parsed=parseVCardContacts(await original.text())
        for(const contact of parsed) await createContact(contact)
        await createCapture({kind:'contact_import',title:original.name,raw_text:null,parsed_kind:'contacts',parsed_data:{imported:parsed.length},file:original,status:'processed',space_id:null})
        continue
      }
      const file=await prepareImageForUpload(original)
      const inspected = await inspectFile(file)
      if (inspected.kind === 'calendar' && inspected.events.length) {
        setSaveStage('Importing calendar…')
        const result = await importCalendarEvents(inspected.events, file.name)
        await createCapture({ kind:'calendar_import', title:file.name, raw_text:null, parsed_kind:'calendar', parsed_data:{ imported:result.imported, skipped:result.skipped, discovered:inspected.events.length }, file, status:'processed', space_id:spaceId||null })
        continue
      }
      const fileAnalysis = inspected.text?.trim() ? analyzeSmartText(inspected.text.slice(0,12000)) : null
      setSaveStage(inspected.kind==='image'?'Saving photo…':'Saving file…')
      const capture=await createCapture({
        kind: inspected.kind==='image'?'image':'file', title: file.name, raw_text: inspected.text?.slice(0,200000) || null,
        space_id: spaceId || null, parsed_kind: fileAnalysis?.kind || inspected.kind,
        parsed_data: { summary:inspected.summary, smart:fileAnalysis ? { kind:fileAnalysis.kind,title:fileAnalysis.title,date:fileAnalysis.dueDate,time:fileAnalysis.dueTime,location:fileAnalysis.location,url:fileAnalysis.url,confidence:fileAnalysis.confidence } : null },
        file, ai_status: inspected.kind==='image'?'queued':'not_requested',
      })
      if (inspected.kind==='image') {
        setSaveStage('Looking at the photo…')
        try { const smart=await analyzeCapture(capture.id); if(smart)await applyAI(capture.id,smart) } catch { /* Never lose the raw capture because AI is unavailable. */ }
      }
    }
  }

  async function save() {
    if (!text.trim() && !files.length) return
    setSaving(true); setError('');setSaveStage('Organizing…')
    try { if (text.trim()) await saveText(); if (files.length) await saveFiles(); reset(); onClose() }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save that capture.') }
    finally { setSaving(false);setSaveStage('') }
  }

  return <div className="capture-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
    <section className="capture-sheet" aria-modal="true" role="dialog" aria-label="Quick capture">
      <div className="capture-head"><div><span className="eyebrow">UNIVERSAL INTAKE</span><h2>Give JustGlance anything.</h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><X/></button></div>
      <textarea autoFocus value={text} onChange={e => setText(e.target.value)} onKeyDown={e=>{if((e.metaKey||e.ctrlKey)&&e.key==='Enter')void save()}} placeholder="Call Ashley next Tuesday, dentist Thursday at 2:30, remember this link… or just take a photo." rows={4}/>
      {analysis&&<div className="parse-preview smart-preview"><Sparkles size={16}/><span><strong>{effectiveKind}</strong> · {Math.round(analysis.confidence*100)}% understood{analysis.dueDate?` · ${analysis.dueDate}`:''}{analysis.dueTime?` ${analysis.dueTime}`:''}{analysis.location?` · ${analysis.location}`:''}{contactMatch?` · ${contactMatch.display_name}`:''}</span></div>}
      <div className="attachment-row universal-capture-actions">
        <button className="attachment-button camera-button" type="button" onClick={()=>cameraRef.current?.click()}><Camera size={17}/>Take photo</button>
        <button className="attachment-button" type="button" onClick={()=>fileRef.current?.click()}><Paperclip size={17}/>Add files</button>
        <input ref={cameraRef} className="sr-only" type="file" accept="image/*" capture="environment" onChange={e=>{const f=e.target.files?.[0];if(f)setFiles(current=>[...current,f]);if(cameraRef.current)cameraRef.current.value=''}}/>
        <input ref={fileRef} className="sr-only" type="file" multiple accept="image/*,.pdf,.txt,.md,.csv,.json,.ics,.vcf,text/calendar,text/csv,text/vcard" onChange={e=>setFiles(current=>[...current,...Array.from(e.target.files||[])])}/>
        <span>Photos can be the entire capture. Calendar and vCard imports are understood too.</span>
      </div>
      {!!files.length&&<div className="attachment-list rich-attachments">{files.map((file,index)=><div key={`${file.name}-${index}`} className={file.type.startsWith('image/')?'image-attachment':''}>{file.type.startsWith('image/')?<ImageIcon size={15}/>:file.name.toLowerCase().endsWith('.ics')?<Calendar size={15}/>:file.name.toLowerCase().endsWith('.vcf')?<ContactRound size={15}/>:<FileText size={15}/>}<span>{file.name}</span><small>{Math.max(1,Math.round(file.size/1024))} KB</small><button onClick={()=>setFiles(current=>current.filter((_,i)=>i!==index))} aria-label={`Remove ${file.name}`}><X size={13}/></button></div>)}</div>}
      <div className="capture-options">
        <div className="chip-row">
          {(['task','reminder','shopping','call','errand','chore','idea'] as ItemType[]).map(type=><button key={type} className={`chip ${kind===type?'active':''}`} onClick={()=>setKind(kind===type?null:type)}>{type}</button>)}
          <button className={`chip ${kind==='appointment'?'active':''}`} onClick={()=>setKind(kind==='appointment'?null:'appointment')}>appointment</button>
          <button className={`chip ${kind==='contact'?'active':''}`} onClick={()=>setKind(kind==='contact'?null:'contact')}><ContactRound size={13}/>contact</button>
          <button className={`chip ${kind==='note'?'active':''}`} onClick={()=>setKind(kind==='note'?null:'note')}>thought</button>
          <button className={`chip ${kind==='link'?'active':''}`} onClick={()=>setKind(kind==='link'?null:'link')}><Link2 size={13}/>link</button>
          <button className={`chip ${kind==='project'?'active':''}`} onClick={()=>setKind(kind==='project'?null:'project')}>project</button>
        </div>
        {effectiveKind !== 'project' && effectiveKind !== 'contact' && <div className="capture-grid">
          <label><Calendar size={16}/>Date<input type="date" value={date} onChange={e=>setDate(e.target.value)} placeholder={analysis?.dueDate||''} disabled={effectiveKind==='note'||effectiveKind==='link'}/></label>
          <label><Calendar size={16}/>Time<input type="time" value={time} onChange={e=>setTime(e.target.value)} disabled={effectiveKind==='note'||effectiveKind==='link'}/></label>
          <label><Users size={16}/>Space<select value={spaceId} onChange={e=>setSpaceId(e.target.value)}><option value="">Personal</option>{spaces.filter(space=>!space.is_personal&&space.name!=='Personal').map(space=><option key={space.id} value={space.id}>{space.name}</option>)}</select></label>
          <label><FolderKanban size={16}/>Project<select value={projectId} onChange={e=>setProjectId(e.target.value)} disabled={effectiveKind==='note'||effectiveKind==='link'}><option value="">None</option>{projects.filter(project=>project.status==='active').map(project=><option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
          <label><MapPin size={16}/>Place<select value={placeId} onChange={e=>setPlaceId(e.target.value)} disabled={effectiveKind==='note'||effectiveKind==='link'}><option value="">{analysis?.location||'Any place'}</option>{places.map(place=><option key={place.id} value={place.id}>{place.name}</option>)}</select></label>
        </div>}
        {effectiveKind==='project'&&<div className="capture-grid single"><label><Users size={16}/>Space<select value={spaceId} onChange={e=>setSpaceId(e.target.value)}><option value="">Personal</option>{spaces.filter(space=>!space.is_personal&&space.name!=='Personal').map(space=><option key={space.id} value={space.id}>{space.name}</option>)}</select></label></div>}
        {effectiveKind!=='note'&&effectiveKind!=='appointment'&&effectiveKind!=='link'&&effectiveKind!=='contact'&&<label className="priority-select">Priority<select value={priority} onChange={e=>setPriority(e.target.value as Priority)}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option></select></label>}
      </div>
      {error&&<div className="form-message capture-error">{error}</div>}
      <button className="primary-button capture-submit" disabled={(!text.trim()&&!files.length)||saving} onClick={save}>{saving ? <>{saveStage||'Organizing…'}</> : <>Capture <Send size={17}/></>}</button>
      <p className="capture-footnote">Raw captures are saved first so they are never lost. Smart Intake can then turn clear photos/text into contacts, appointments, calls or tasks; uncertain material stays safely searchable in your memory inbox.</p>
    </section>
  </div>
}
