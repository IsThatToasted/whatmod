import { ArrowRight, CheckCircle2, Send, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useAppData } from '../contexts/AppDataContext'
import { addDaysISO, todayISO } from '../lib/time'
import { lifeIntentParser } from '../lib/parser'

export function DailyReset() {
  const { items, updateItem, createItem, preferences } = useAppData()
  const today = todayISO()
  const storageKey = `justglance:daily-reset:${today}`
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(storageKey) === 'done')
  const [thought, setThought] = useState('')
  const [busy, setBusy] = useState(false)
  const completed = useMemo(() => items.filter(i => i.status === 'completed' && i.completed_at?.startsWith(today)).length, [items, today])
  const carry = useMemo(() => items.filter(i => i.status === 'open' && i.due_date && i.due_date <= today), [items, today])

  if (dismissed || preferences?.daily_reset_enabled === false) return null

  async function moveAll() {
    setBusy(true)
    try {
      await Promise.all(carry.map(item => updateItem(item.id, { due_date: addDaysISO(1), snoozed_until: null })))
    } finally { setBusy(false) }
  }

  async function captureTomorrow() {
    if (!thought.trim()) return
    setBusy(true)
    try {
      const parsed = lifeIntentParser.parse(thought)
      await createItem({ ...parsed, dueDate: parsed.dueDate || addDaysISO(1) }, thought, { due_date: parsed.dueDate || addDaysISO(1) })
      setThought('')
    } finally { setBusy(false) }
  }

  function finish() {
    localStorage.setItem(storageKey, 'done')
    setDismissed(true)
  }

  return <section className="daily-reset-card" aria-label="Daily reset">
    <div className="brief-head">
      <div><span className="eyebrow">DAILY RESET</span><h2>Nice. Today is wrapped up.</h2></div>
      <button className="icon-button" aria-label="Dismiss daily reset" onClick={finish}><X size={18}/></button>
    </div>
    <div className="reset-summary"><CheckCircle2 size={18}/><strong>{completed} completed</strong><span>{carry.length} waiting to carry forward</span></div>
    {carry.length > 0 && <div className="carry-list">
      {carry.slice(0, 4).map(item => <div key={item.id}><span>{item.title}</span><button onClick={() => updateItem(item.id, { due_date: addDaysISO(1), snoozed_until: null })}>Tomorrow <ArrowRight size={14}/></button></div>)}
      {carry.length > 1 && <button className="secondary-button" disabled={busy} onClick={moveAll}>Move all to tomorrow</button>}
    </div>}
    <label className="reset-capture">Anything on your mind?<div><input value={thought} onChange={e => setThought(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void captureTomorrow() }} placeholder="Capture it for tomorrow…"/><button className="icon-button" disabled={!thought.trim() || busy} onClick={captureTomorrow} aria-label="Capture for tomorrow"><Send size={18}/></button></div></label>
    <button className="text-button reset-done" onClick={finish}>Done for today</button>
  </section>
}
