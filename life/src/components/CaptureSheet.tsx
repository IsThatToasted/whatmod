import { Calendar, MapPin, Send, Sparkles, StickyNote, Users, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { lifeIntentParser } from '../lib/parser'
import { useAppData } from '../contexts/AppDataContext'
import type { ItemType, Priority } from '../types'

type CaptureKind = ItemType | 'note'

export function CaptureSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { createItem, createNote, spaces, places } = useAppData()
  const [text, setText] = useState('')
  const [kind, setKind] = useState<CaptureKind | null>(null)
  const [priority, setPriority] = useState<Priority>('normal')
  const [spaceId, setSpaceId] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [placeId, setPlaceId] = useState('')
  const [saving, setSaving] = useState(false)
  const parsed = useMemo(() => text.trim() ? lifeIntentParser.parse(text) : null, [text])

  if (!open) return null

  function reset() {
    setText('')
    setKind(null)
    setPriority('normal')
    setSpaceId('')
    setDate('')
    setTime('')
    setPlaceId('')
  }

  async function save() {
    if (!text.trim()) return
    setSaving(true)
    try {
      if (kind === 'note') {
        await createNote(text, spaceId || null)
      } else {
        const intent = lifeIntentParser.parse(text)
        if (kind) intent.type = kind
        intent.priority = priority
        const selectedPlace = places.find(place => place.id === placeId)
        await createItem(intent, text, {
          space_id: spaceId || null,
          due_date: date || intent.dueDate || null,
          due_time: time || intent.dueTime || null,
          place_id: placeId || null,
          place_name: selectedPlace?.name || intent.context || null,
        })
      }
      reset()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return <div className="capture-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
    <section className="capture-sheet" aria-modal="true" role="dialog" aria-label="Quick capture">
      <div className="capture-head"><div><span className="eyebrow">QUICK CAPTURE</span><h2>What’s on your mind?</h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><X/></button></div>
      <textarea autoFocus value={text} onChange={e => setText(e.target.value)} placeholder="I need to call the dentist this week…" rows={4}/>
      {parsed && kind !== 'note' && <div className="parse-preview"><Sparkles size={16}/><span>{kind || parsed.type} · {Math.round(parsed.confidence * 100)}% understood{parsed.dueDate ? ' · date detected' : ''}{parsed.context ? ` · ${parsed.context}` : ''}</span></div>}
      {kind === 'note' && <div className="parse-preview"><StickyNote size={16}/><span>Save as something to remember. No deadline required.</span></div>}

      <div className="capture-options">
        <div className="chip-row">
          {(['task', 'shopping', 'call', 'errand', 'chore', 'reminder', 'idea'] as ItemType[]).map(type => <button key={type} className={`chip ${kind === type ? 'active' : ''}`} onClick={() => setKind(kind === type ? null : type)}>{type}</button>)}
          <button className={`chip ${kind === 'note' ? 'active' : ''}`} onClick={() => setKind(kind === 'note' ? null : 'note')}>remember</button>
        </div>

        <div className="capture-grid">
          <label><Calendar size={16}/>Date<input type="date" value={date} onChange={e => setDate(e.target.value)} disabled={kind === 'note'}/></label>
          <label><Calendar size={16}/>Time<input type="time" value={time} onChange={e => setTime(e.target.value)} disabled={kind === 'note'}/></label>
          <label><Users size={16}/>Space<select value={spaceId} onChange={e => setSpaceId(e.target.value)}><option value="">Personal</option>{spaces.filter(space => !space.is_personal && space.name !== 'Personal').map(space => <option key={space.id} value={space.id}>{space.name}</option>)}</select></label>
          <label><MapPin size={16}/>Place<select value={placeId} onChange={e => setPlaceId(e.target.value)} disabled={kind === 'note'}><option value="">Any place</option>{places.map(place => <option key={place.id} value={place.id}>{place.name}</option>)}</select></label>
        </div>
        {kind !== 'note' && <label className="priority-select">Priority<select value={priority} onChange={e => setPriority(e.target.value as Priority)}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option></select></label>}
      </div>
      <button className="primary-button capture-submit" disabled={!text.trim() || saving} onClick={save}>{saving ? 'Saving…' : <>Capture <Send size={17}/></>}</button>
    </section>
  </div>
}
