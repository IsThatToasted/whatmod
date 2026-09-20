import { addDaysISO, todayISO } from './time'

function parseLocalDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0, 0)
}

function toISO(date: Date) {
  return todayISO(date)
}

export function nextRecurrenceDate(rule?: string | null, fromDate?: string | null): string | null {
  if (!rule) return null
  const base = fromDate ? parseLocalDate(fromDate) : new Date()
  const normalized = rule.trim().toLowerCase()

  if (normalized === 'daily') return addDaysISO(1, base)
  if (normalized === 'weekly') return addDaysISO(7, base)
  if (normalized === 'biweekly') return addDaysISO(14, base)
  if (normalized === 'monthly') {
    const next = new Date(base)
    const originalDay = base.getDate()
    next.setDate(1)
    next.setMonth(next.getMonth() + 1)
    const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()
    next.setDate(Math.min(originalDay, lastDay))
    return toISO(next)
  }
  if (normalized === 'weekdays') {
    const next = new Date(base)
    do next.setDate(next.getDate() + 1); while (next.getDay() === 0 || next.getDay() === 6)
    return toISO(next)
  }

  const every = normalized.match(/^every:(\d{1,3})$/)
  if (every) return addDaysISO(Math.max(1, Number(every[1])), base)

  const weekdays = normalized.match(/^weekdays:([0-6](?:,[0-6])*)$/)
  if (weekdays) {
    const allowed = new Set(weekdays[1].split(',').map(Number))
    const next = new Date(base)
    for (let i = 0; i < 8; i++) {
      next.setDate(next.getDate() + 1)
      if (allowed.has(next.getDay())) return toISO(next)
    }
  }

  return null
}
