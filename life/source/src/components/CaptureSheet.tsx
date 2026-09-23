import { Calendar, FileText, FolderKanban, Image as ImageIcon, Link2, MapPin, Paperclip, Send, Sparkles, StickyNote, Users, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useAppData } from '../contexts/AppDataContext'
import { useOrganizer } from '../contexts/OrganizerContext'
import { isoToday } from '../lib/organizer'
import { analyzeSmartText, inspectFile } from '../lib/smartIntake'
import type { ItemType, Priority } from '../types'

type CaptureKind = ItemType | 'note' | 'appointment' | 'project' | 'link'

function mappedKind(kind: ReturnType<typeof analyzeSmartText>['kind']): CaptureKind {
  if (kind === 'appointment') return 'appointment'
  if (kind === 'thought') return 'note'
  if (kind === 'link') return 'link'
  if (kind === 'shopping') return 'shopping'
  if (kind === 'reminder') return 'reminder'
  return 'task'
}

export function CaptureSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { createItem, createNote, createEvent, createCapture, importCalendarEvents, spaces, places } = useAppData()
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
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement | null>(null)
  const lastInferredDate = useRef('')
  const lastInferredTime = useRef('')
  const analysis = useMemo(() => text.trim() ? analyzeSmartText(text) : null, [text])
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
    setText(''); setKind(null); setPriority('normal'); setSpaceId(''); setProjectId(''); setDate(''); setTime(''); setPlaceId(''); setFiles([]); setError(''); lastInferredDate.current=''; lastInferredTime.current='' 
  }

  async function saveText() {
    if (!text.trim() || !analysis) return
    const chosen = kind || mappedKind(analysis.kind)
    if (chosen === 'note') {
      await createNote(text, spaceId || null)
      return
    }
    if (chosen === 'project') {
      await createProject({ name: analysis.title || text.trim(), description: text.trim() === analysis.title ? undefined : text.trim(), priority, space_id: spaceId || null })
      return
    }
    if (chosen === 'link') {
      await createCapture({ kind:'link', title: analysis.title || analysis.url || 'Saved link', raw_text:text, source_url:analysis.url, space_id:spaceId||null, parsed_kind:'link', parsed_data:{ url:analysis.url, tags:analysis.tags, confidence:analysis.confidence } })
      return
    }
    if (chosen === 'appointment') {
      const eventDate = date || analysis.dueDate || isoToday()
      const startTime = time || analysis.dueTime || '09:00'
      const selectedPlace = places.find(p=>p.id===placeId)
      const created = await createEvent({
        title: analysis.title,
        event_date: eventDate,
        start_time: startTime,
        end_time: analysis.endTime,
        location: selectedPlace?.name || analysis.location || null,
        notes: text.trim() === analysis.title ? null : text.trim(),
        attendees: [], recurrence_rule: null, project_id: projectId || null, space_id: spaceId || null,
        provider: 'internal-smart', external_id: null,
      })
      const when = new Date(`${eventDate}T${startTime}:00`)
      if (!Number.isNaN(when.getTime())) {
        when.setMinutes(when.getMinutes() - 30)
        if (when.getTime() > Date.now()) await createReminder({ title: created.title, body: created.location ? `At ${created.location}` : null, remind_at: when.toISOString(), event_id: created.id })
      }
      return
    }

    const intent = { ...analysis.intent }
    if (chosen !== 'link' && chosen !== 'appointment' && chosen !== 'note' && chosen !== 'project') intent.type = chosen as ItemType
    intent.priority = priority
    const selectedPlace = places.find(place => place.id === placeId)
    const item = await createItem(intent, text, {
      space_id: spaceId || null,
      project_id: projectId || null,
      due_date: date || analysis.dueDate || null,
      due_time: time || analysis.dueTime || null,
      place_id: placeId || null,
      place_name: selectedPlace?.name || analysis.location || null,
      is_inbox: !(date || analysis.dueDate || projectId || placeId || spaceId),
      shopping: intent.type==='shopping' ? { preferred_store: analysis.location || intent.context || null } : undefined,
    })
    if ((chosen === 'reminder' || intent.type === 'reminder') && (date || analysis.dueDate)) {
      const whenDate = date || analysis.dueDate || isoToday()
      const whenTime = time || analysis.dueTime || '09:00'
      const when = new Date(`${whenDate}T${whenTime}:00`)
      if (!Number.isNaN(when.getTime())) await createReminder({ title: item.title, body: item.description || null, remind_at: when.toISOString(), item_id: item.id })
    }
  }

  async function saveFiles() {
    for (const file of files) {
      if (file.size > 15 * 1024 * 1024) throw new Error(`${file.name} is over the 15 MB capture limit.`)
      const inspected = await inspectFile(file)
      if (inspected.kind === 'calendar' && inspected.events.length) {
        const result = await importCalendarEvents(inspected.events, file.name)
        await createCapture({ kind:'calendar_import', title:file.name, raw_text:null, parsed_kind:'calendar', parsed_data:{ imported:result.imported, skipped:result.skipped, discovered:inspected.events.length }, file, status:'processed', space_id:spaceId||null })
        continue
      }
      const fileAnalysis = inspected.text?.trim() ? analyzeSmartText(inspected.text.slice(0,12000)) : null
      await createCapture({
        kind: inspected.kind==='image'?'image':'file',
        title: file.name,
        raw_text: inspected.text?.slice(0,200000) || null,
        space_id: spaceId || null,
        parsed_kind: fileAnalysis?.kind || inspected.kind,
        parsed_data: { summary:inspected.summary, smart:fileAnalysis ? { kind:fileAnalysis.kind,title:fileAnalysis.title,date:fileAnalysis.dueDate,time:fileAnalysis.dueTime,location:fileAnalysis.location,url:fileAnalysis.url,confidence:fileAnalysis.confidence } : null },
        file,
      })
    }
  }

  async function save() {
    if (!text.trim() && !files.length) return
    setSaving(true); setError('')
    try {
      if (text.trim()) await saveText()
      if (files.length) await saveFiles()
      reset(); onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that capture.')
    } finally { setSaving(false) }
  }

  return <div className="capture-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
    <section className="capture-sheet" aria-modal="true" role="dialog" aria-label="Quick capture">
      <div className="capture-head"><div><span className="eyebrow">SMART INTAKE</span><h2>Drop anything here.</h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><X/></button></div>
      <textarea autoFocus value={text} onChange={e => setText(e.target.value)} onKeyDown={e=>{if((e.metaKey||e.ctrlKey)&&e.key==='Enter')void save()}} placeholder="Dentist Thursday at 2:30 PM at Aspen Dental, buy milk, save a link, or attach a file…" rows={4}/>

      {analysis&&<div className="parse-preview smart-preview"><Sparkles size={16}/><span><strong>{effectiveKind}</strong> · {Math.round(analysis.confidence*100)}% understood{analysis.dueDate?` · ${analysis.dueDate}`:''}{analysis.dueTime?` ${analysis.dueTime}`:''}{analysis.location?` · ${analysis.location}`:''}</span></div>}

      <div className="attachment-row">
        <button className="attachment-button" type="button" onClick={()=>fileRef.current?.click()}><Paperclip size={17}/>Add files or images</button>
        <input ref={fileRef} className="sr-only" type="file" multiple accept="image/*,.pdf,.txt,.md,.csv,.json,.ics,text/calendar,text/csv" onChange={e=>setFiles(Array.from(e.target.files||[]))}/>
        <span>ICS and common Outlook/calendar CSV exports import directly.</span>
      </div>
      {!!files.length&&<div className="attachment-list">{files.map((file,index)=><div key={`${file.name}-${index}`}>{file.type.startsWith('image/')?<ImageIcon size={15}/>:file.name.toLowerCase().endsWith('.ics')?<Calendar size={15}/>:<FileText size={15}/>}<span>{file.name}</span><button onClick={()=>setFiles(current=>current.filter((_,i)=>i!==index))} aria-label={`Remove ${file.name}`}><X size={13}/></button></div>)}</div>}

      <div className="capture-options">
        <div className="chip-row">
          {(['task', 'reminder', 'shopping', 'call', 'errand', 'chore', 'idea'] as ItemType[]).map(type => <button key={type} className={`chip ${kind === type ? 'active' : ''}`} onClick={() => setKind(kind === type ? null : type)}>{type}</button>)}
          <button className={`chip ${kind === 'appointment' ? 'active' : ''}`} onClick={() => setKind(kind === 'appointment' ? null : 'appointment')}>appointment</button>
          <button className={`chip ${kind === 'note' ? 'active' : ''}`} onClick={() => setKind(kind === 'note' ? null : 'note')}>thought</button>
          <button className={`chip ${kind === 'link' ? 'active' : ''}`} onClick={() => setKind(kind === 'link' ? null : 'link')}><Link2 size={13}/>link</button>
          <button className={`chip ${kind === 'project' ? 'active' : ''}`} onClick={() => setKind(kind === 'project' ? null : 'project')}>project</button>
        </div>

        {effectiveKind !== 'project' && <div className="capture-grid">
          <label><Calendar size={16}/>Date<input type="date" value={date} onChange={e => setDate(e.target.value)} placeholder={analysis?.dueDate||''} disabled={effectiveKind === 'note' || effectiveKind === 'link'}/></label>
          <label><Calendar size={16}/>Time<input type="time" value={time} onChange={e => setTime(e.target.value)} disabled={effectiveKind === 'note' || effectiveKind === 'link'}/></label>
          <label><Users size={16}/>Space<select value={spaceId} onChange={e => setSpaceId(e.target.value)}><option value="">Personal</option>{spaces.filter(space => !space.is_personal && space.name !== 'Personal').map(space => <option key={space.id} value={space.id}>{space.name}</option>)}</select></label>
          <label><FolderKanban size={16}/>Project<select value={projectId} onChange={e => setProjectId(e.target.value)} disabled={effectiveKind === 'note' || effectiveKind === 'link'}><option value="">None</option>{projects.filter(project=>project.status==='active').map(project=><option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
          <label><MapPin size={16}/>Place<select value={placeId} onChange={e => setPlaceId(e.target.value)} disabled={effectiveKind === 'note' || effectiveKind === 'link'}><option value="">{analysis?.location||'Any place'}</option>{places.map(place => <option key={place.id} value={place.id}>{place.name}</option>)}</select></label>
        </div>}
        {effectiveKind === 'project' && <div className="capture-grid single"><label><Users size={16}/>Space<select value={spaceId} onChange={e=>setSpaceId(e.target.value)}><option value="">Personal</option>{spaces.filter(space=>!space.is_personal&&space.name!=='Personal').map(space=><option key={space.id} value={space.id}>{space.name}</option>)}</select></label></div>}
        {effectiveKind !== 'note' && effectiveKind !== 'appointment' && effectiveKind !== 'link' && <label className="priority-select">Priority<select value={priority} onChange={e => setPriority(e.target.value as Priority)}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option></select></label>}
      </div>
      {error&&<div className="form-message capture-error">{error}</div>}
      <button className="primary-button capture-submit" disabled={(!text.trim()&&!files.length)||saving} onClick={save}>{saving ? 'Organizing…' : <>Capture <Send size={17}/></>}</button>
      <p className="capture-footnote">Text is categorized locally first. Files, images and links are preserved in your private Supabase capture inbox so richer parsing can be added without changing how you capture today.</p>
    </section>
  </div>
}
