import { CalendarDays, ChevronRight, Sparkles, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useAppData } from '../contexts/AppDataContext'
import { formatTime, minutesUntilEvent, todayISO } from '../lib/time'

export function MorningBrief() {
  const { items, events, preferences } = useAppData()
  const today = todayISO()
  const storageKey = `justglance:morning-brief:${today}`
  const [hidden, setHidden] = useState(() => sessionStorage.getItem(storageKey) === 'hidden')
  const summary = useMemo(() => {
    const open = items.filter(i => i.status === 'open')
    const todayItems = open.filter(i => i.due_date === today)
    const errands = todayItems.filter(i => i.type === 'errand' || i.type === 'shopping').length
    const shared = todayItems.filter(i => Boolean(i.space_id)).length
    const todaysEvents = events.filter(e => e.event_date === today).sort((a, b) => a.start_time.localeCompare(b.start_time))
    const first = todaysEvents[0] || null
    const free = first ? minutesUntilEvent(first) : null
    return { count: todayItems.length, errands, shared, first, free }
  }, [items, events, today])

  if (hidden || preferences?.morning_brief_enabled === false) return null

  return <section className="morning-brief-card" aria-label="Morning brief">
    <div className="brief-head">
      <div><span className="eyebrow">MORNING BRIEF</span><h2>Here’s your day.</h2></div>
      <button className="icon-button" aria-label="Hide morning brief" onClick={() => { sessionStorage.setItem(storageKey, 'hidden'); setHidden(true) }}><X size={18}/></button>
    </div>
    <div className="brief-stats">
      <div><strong>{summary.count}</strong><span>important today</span></div>
      <div><strong>{summary.errands}</strong><span>errands</span></div>
      <div><strong>{summary.shared}</strong><span>shared</span></div>
    </div>
    <div className="brief-footer">
      {summary.first ? <span><CalendarDays size={16}/>First event {formatTime(summary.first.start_time)}{summary.free != null ? ` · about ${summary.free} min free` : ''}</span> : <span><Sparkles size={16}/>No scheduled event is crowding the morning.</span>}
      <ChevronRight size={17}/>
    </div>
  </section>
}
