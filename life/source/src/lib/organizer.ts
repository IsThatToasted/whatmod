import type { EventItem, LifeItem, Project } from '../types'

export const isoToday = () => {
  const d = new Date()
  const y = d.getFullYear(); const m = String(d.getMonth()+1).padStart(2,'0'); const day = String(d.getDate()).padStart(2,'0')
  return `${y}-${m}-${day}`
}

export const addDays = (days: number) => {
  const d = new Date(); d.setDate(d.getDate()+days)
  const y = d.getFullYear(); const m = String(d.getMonth()+1).padStart(2,'0'); const day = String(d.getDate()).padStart(2,'0')
  return `${y}-${m}-${day}`
}

export function taskBucket(item: LifeItem) {
  const today = isoToday()
  if (item.status === 'completed') return 'completed'
  if (item.waiting_for) return 'waiting'
  if (item.is_inbox) return 'inbox'
  if (item.defer_until && item.defer_until > new Date().toISOString()) return 'someday'
  if (item.due_date && item.due_date < today) return 'overdue'
  if (item.due_date === today || item.focus_pin) return 'today'
  if (item.due_date && item.due_date <= addDays(7)) return 'upcoming'
  return 'anytime'
}

export function projectProgress(project: Project, items: LifeItem[]) {
  const related = items.filter(item => item.project_id === project.id && item.status !== 'dismissed')
  const completed = related.filter(item => item.status === 'completed').length
  const total = related.length
  return { completed, total, percent: total ? Math.round((completed / total) * 100) : 0, open: total - completed }
}

export function agendaForDate(date: string, items: LifeItem[], events: EventItem[]) {
  const dayItems = items.filter(item => item.status === 'open' && item.due_date === date)
  const dayEvents = events.filter(event => event.event_date === date)
  const rows = [
    ...dayEvents.map(event => ({ id: event.id, kind: 'event' as const, time: event.start_time || '00:00', title: event.title, event })),
    ...dayItems.map(item => ({ id: item.id, kind: 'task' as const, time: item.due_time || (item.type === 'call' ? '08:30' : '23:59'), title: item.title, item })),
  ]
  return rows.sort((a,b) => a.time.localeCompare(b.time))
}

export function formatFriendlyDate(date: string) {
  const d = new Date(`${date}T12:00:00`)
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

export function formatClock(time?: string | null) {
  if (!time) return ''
  const [hour, minute] = time.split(':').map(Number)
  const d = new Date(); d.setHours(hour, minute || 0, 0, 0)
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}
