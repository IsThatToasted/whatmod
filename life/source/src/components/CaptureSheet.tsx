import { Calendar, FolderKanban, MapPin, Send, Sparkles, StickyNote, Users, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { lifeIntentParser } from '../lib/parser'
import { useAppData } from '../contexts/AppDataContext'
import { useOrganizer } from '../contexts/OrganizerContext'
import { isoToday } from '../lib/organizer'
import type { ItemType, Priority } from '../types'

type CaptureKind = ItemType | 'note' | 'appointment' | 'project'

export function CaptureSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { createItem, createNote, createEvent, spaces, places } = useAppData()
  const { projects, createProject, createReminder } = useOrganizer()
  const [text, setText] = useState('')
  const [kind, setKind] = useState<CaptureKind | null>(null)
  const [priority, setPriority] = useState<Priority>('normal')
  const [spaceId, setSpaceId] = useState('')
  const [projectId, setProjectId] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [placeId, setPlaceId] = useState('')
  const [saving, setSaving] = useState(false)
  const parsed = useMemo(() => text.trim() ? lifeIntentParser.parse(text) : null, [text])

  if (!open) return null

  function reset() {
    setText(''); setKind(null); setPriority('normal'); setSpaceId(''); setProjectId(''); setDate(''); setTime(''); setPlaceId('')
  }

  async function save() {
    if (!text.trim()) return
    setSaving(true)
    try {
      if (kind === 'note') {
        await createNote(text, spaceId || null)
      } else if (kind === 'project') {
        await createProject({ name: text.trim(), priority, space_id: spaceId || null })
      } else if (kind === 'appointment') {
        const intent = lifeIntentParser.parse(text)
        await createEvent({ title: intent.title, event_date: date || intent.dueDate || isoToday(), start_time: time || intent.dueTime || '09:00', end_time: null, location: places.find(p=>p.id===placeId)?.name || intent.context || null, notes: null, attendees: [], recurrence_rule: null, project_id: projectId || null, space_id: spaceId || null })
      } else {
        const intent = lifeIntentParser.parse(text)
        if (kind) intent.type = kind
        intent.priority = priority
        const selectedPlace = places.find(place => place.id === placeId)
        const item = await createItem(intent, text, {
          space_id: spaceId || null,
          project_id: projectId || null,
          due_date: date || intent.dueDate || null,
          due_time: time || intent.dueTime || null,
          place_id: placeId || null,
          place_name: selectedPlace?.name || intent.context || null,
          is_inbox: !(date || intent.dueDate || projectId || placeId || spaceId),
        })
        if ((kind === 'reminder' || intent.type === 'reminder') && (date || intent.dueDate)) {
          const whenDate = date || intent.dueDate || isoToday()
          const whenTime = time || intent.dueTime || '09:00'
          const when = new Date(`${whenDate}T${whenTime}:00`)
          if (!Number.isNaN(when.getTime())) await createReminder({ title: item.title, body: item.description || null, remind_at: when.toISOString(), item_id: item.id })
        }
      }
      reset(); onClose()
    } finally { setSaving(false) }
  }

  return <div className="capture-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
    <section className="capture-sheet" aria-modal="true" role="dialog" aria-label="Quick capture">
      <div className="capture-head"><div><span className="eyebrow">UNIVERSAL CAPTURE</span><h2>What’s on your mind?</h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><X/></button></div>
      <textarea autoFocus value={text} onChange={e => setText(e.target.value)} onKeyDown={e=>{if((e.metaKey||e.ctrlKey)&&e.key==='Enter')void save()}} placeholder="Anything: call dentist Friday, project idea, appointment, buy milk…" rows={4}/>
      {parsed && kind !== 'note' && kind !== 'project' && <div className="parse-preview"><Sparkles size={16}/><span>{kind || parsed.type} · {Math.round(parsed.confidence * 100)}% understood{parsed.dueDate ? ' · date detected' : ''}{parsed.context ? ` · ${parsed.context}` : ''}</span></div>}
      {kind === 'note' && <div className="parse-preview"><StickyNote size={16}/><span>Save as a thought. No deadline required.</span></div>}
      {kind === 'project' && <div className="parse-preview"><FolderKanban size={16}/><span>Create an outcome you can connect tasks, notes and appointments to.</span></div>}

      <div className="capture-options">
        <div className="chip-row">
          {(['task', 'reminder', 'shopping', 'call', 'errand', 'chore', 'idea'] as ItemType[]).map(type => <button key={type} className={`chip ${kind === type ? 'active' : ''}`} onClick={() => setKind(kind === type ? null : type)}>{type}</button>)}
          <button className={`chip ${kind === 'appointment' ? 'active' : ''}`} onClick={() => setKind(kind === 'appointment' ? null : 'appointment')}>appointment</button>
          <button className={`chip ${kind === 'note' ? 'active' : ''}`} onClick={() => setKind(kind === 'note' ? null : 'note')}>thought</button>
          <button className={`chip ${kind === 'project' ? 'active' : ''}`} onClick={() => setKind(kind === 'project' ? null : 'project')}>project</button>
        </div>

        {kind !== 'project' && <div className="capture-grid">
          <label><Calendar size={16}/>Date<input type="date" value={date} onChange={e => setDate(e.target.value)} disabled={kind === 'note'}/></label>
          <label><Calendar size={16}/>Time<input type="time" value={time} onChange={e => setTime(e.target.value)} disabled={kind === 'note'}/></label>
          <label><Users size={16}/>Space<select value={spaceId} onChange={e => setSpaceId(e.target.value)}><option value="">Personal</option>{spaces.filter(space => !space.is_personal && space.name !== 'Personal').map(space => <option key={space.id} value={space.id}>{space.name}</option>)}</select></label>
          <label><FolderKanban size={16}/>Project<select value={projectId} onChange={e => setProjectId(e.target.value)} disabled={kind === 'note'}><option value="">None</option>{projects.filter(project=>project.status==='active').map(project=><option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
          <label><MapPin size={16}/>Place<select value={placeId} onChange={e => setPlaceId(e.target.value)} disabled={kind === 'note'}><option value="">Any place</option>{places.map(place => <option key={place.id} value={place.id}>{place.name}</option>)}</select></label>
        </div>}
        {kind === 'project' && <div className="capture-grid single"><label><Users size={16}/>Space<select value={spaceId} onChange={e=>setSpaceId(e.target.value)}><option value="">Personal</option>{spaces.filter(space=>!space.is_personal&&space.name!=='Personal').map(space=><option key={space.id} value={space.id}>{space.name}</option>)}</select></label></div>}
        {kind !== 'note' && kind !== 'appointment' && <label className="priority-select">Priority<select value={priority} onChange={e => setPriority(e.target.value as Priority)}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option></select></label>}
      </div>
      <button className="primary-button capture-submit" disabled={!text.trim() || saving} onClick={save}>{saving ? 'Saving…' : <>Capture <Send size={17}/></>}</button>
    </section>
  </div>
}
