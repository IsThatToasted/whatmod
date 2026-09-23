import type { EventItem, ParsedIntent } from '../types'
import { lifeIntentParser } from './parser'

export type SmartKind = 'appointment' | 'task' | 'reminder' | 'shopping' | 'thought' | 'link' | 'file' | 'image' | 'calendar'

export interface SmartAnalysis {
  kind: SmartKind
  title: string
  confidence: number
  dueDate: string | null
  dueTime: string | null
  endTime: string | null
  location: string | null
  url: string | null
  tags: string[]
  reason: string
  intent: ParsedIntent
}

export interface ParsedCalendarEvent {
  title: string
  event_date: string
  start_time: string
  end_time: string | null
  location: string | null
  notes: string | null
  attendees: unknown[]
  recurrence_rule: string | null
  provider: string
  external_id: string | null
}

const appointmentRx = /\b(appointment|appt|dentist|doctor(?:'s|s)?|physician|medical|clinic|dr\.?\s|meeting|meet with|interview|reservation|therapy|haircut|checkup|check-up|conference|webinar|class|lesson|consultation|visit|dinner with|lunch with|breakfast with)\b/i
const thoughtRx = /\b(idea|thought|note to self|remember this|reference|save this|research|maybe someday|inspiration)\b/i
const urlRx = /https?:\/\/[^\s<>()]+/i

function isoLocalDate(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function nextWeekday(name: string, followingWeek = false) {
  const names = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']
  const target = names.indexOf(name.toLowerCase())
  if (target < 0) return null
  const now = new Date()
  let delta = (target - now.getDay() + 7) % 7
  if (followingWeek) {
    // Treat explicit "next Thursday" as the Thursday in the following week,
    // not simply the closest upcoming Thursday. If today is already Thursday,
    // next Thursday is seven days away rather than fourteen.
    delta = delta === 0 ? 7 : delta + 7
  } else if (delta === 0) {
    delta = 7
  }
  now.setDate(now.getDate() + delta)
  return isoLocalDate(now)
}

function smartDate(text: string, fallback: string | null) {
  const lower = text.toLowerCase()
  const now = new Date()
  if (/\btoday\b/.test(lower)) return isoLocalDate(now)
  if (/\btomorrow\b/.test(lower)) { now.setDate(now.getDate() + 1); return isoLocalDate(now) }
  const nextWeekdayPhrase = lower.match(/\bnext(?:\s+week)?\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/)
  if (nextWeekdayPhrase) return nextWeekday(nextWeekdayPhrase[1], true)
  const weekday = lower.match(/\b(?:this\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/)
  if (weekday) return nextWeekday(weekday[1])

  const numeric = text.match(/\b(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?\b/)
  if (numeric) {
    const month = Number(numeric[1])
    const day = Number(numeric[2])
    let year = numeric[3] ? Number(numeric[3]) : new Date().getFullYear()
    if (year < 100) year += 2000
    const candidate = new Date(year, month - 1, day, 12)
    if (!numeric[3] && candidate < new Date(new Date().setHours(0,0,0,0))) candidate.setFullYear(candidate.getFullYear() + 1)
    if (!Number.isNaN(candidate.getTime())) return isoLocalDate(candidate)
  }

  const monthNames: Record<string, number> = {jan:0,january:0,feb:1,february:1,mar:2,march:2,apr:3,april:3,may:4,jun:5,june:5,jul:6,july:6,aug:7,august:7,sep:8,sept:8,september:8,oct:9,october:9,nov:10,november:10,dec:11,december:11}
  const written = text.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?/i)
  if (written) {
    const month = monthNames[written[1].toLowerCase()]
    let year = written[3] ? Number(written[3]) : new Date().getFullYear()
    const candidate = new Date(year, month, Number(written[2]), 12)
    if (!written[3] && candidate < new Date(new Date().setHours(0,0,0,0))) candidate.setFullYear(candidate.getFullYear() + 1)
    return isoLocalDate(candidate)
  }
  return fallback
}

function smartTime(text: string, fallback: string | null) {
  const meridian = text.match(/\b(?:at\s+)?(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(a\.?m\.?|p\.?m\.?)\b/i)
  if (meridian) {
    let hour = Number(meridian[1])
    const minute = Number(meridian[2] || '0')
    const pm = meridian[3].toLowerCase().startsWith('p')
    if (pm && hour !== 12) hour += 12
    if (!pm && hour === 12) hour = 0
    return `${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`
  }
  const twentyFour = text.match(/\b(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)\b/)
  if (twentyFour) return `${String(Number(twentyFour[1])).padStart(2,'0')}:${twentyFour[2]}`
  const bare = text.match(/\b(?:at\s+)(1[0-2]|[1-9])\b/i)
  if (bare) {
    let h = Number(bare[1])
    if (/\b(tonight|evening|dinner)\b/i.test(text) && h < 12) h += 12
    else if (/\b(appointment|appt|dentist|doctor(?:'s|s)?|physician|medical|clinic|meeting|meet with|interview|reservation|therapy|haircut|checkup|visit)\b/i.test(text) && h >= 1 && h <= 6) h += 12
    return `${String(h).padStart(2,'0')}:00`
  }
  return fallback
}

function extractLocation(text: string) {
  const rx = /\b(?:at|@)\s+(?!\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?\b)([^,;]+?)(?=\s+\b(?:on|today|tomorrow|next|this|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b|$)/ig
  const matches = [...text.matchAll(rx)]
  if (!matches.length) return null
  const candidate = matches[matches.length - 1][1].trim().replace(/[.!?]+$/, '')
  return candidate.length > 1 ? candidate : null
}

function cleanAppointmentTitle(text: string, location: string | null, url: string | null) {
  let title = text.trim()
  if (url) title = title.replace(url, '')
  title = title
    .replace(/^\s*(?:appointment|appt)\s*(?:for|with)?\s*/i, '')
    .replace(/\b(?:on\s+)?(?:next(?:\s+week)?|this)?\s*(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/ig, '')
    .replace(/\b(?:today|tomorrow)\b/ig, '')
    .replace(/\b(?:at\s+)?\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)\b/ig, '')
    .replace(/\b(?:at\s+)?(?:[01]?\d|2[0-3]):[0-5]\d\b/g, '')
    .replace(/\bat\s+(?:1[0-2]|[1-9])\b/ig, '')
    .replace(/\b\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?\b/g, '')
    .replace(/\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?/ig, '')
  if (location) title = title.replace(new RegExp(`\\b(?:at|@)\\s+${location.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}`, 'i'), '')
  title = title.replace(/\s+/g, ' ').replace(/^[,;\-\s]+|[,;\-\s]+$/g, '')
  return title || 'Appointment'
}

export function analyzeSmartText(text: string): SmartAnalysis {
  const clean = text.trim()
  const intent = lifeIntentParser.parse(clean)
  const url = clean.match(urlRx)?.[0] || null
  const date = smartDate(clean, intent.dueDate || null)
  const time = smartTime(clean, intent.dueTime || null)
  const location = extractLocation(clean) || intent.context || null
  const isAppointment = appointmentRx.test(clean) || (!!date && !!time && /\b(with|appointment|meeting|dentist|doctor(?:'s|s)?|physician|medical|clinic|interview|reservation|visit)\b/i.test(clean))
  const isLink = !!url && !isAppointment
  const isThought = !isAppointment && !isLink && thoughtRx.test(clean) && !/\b(remind|buy|call|pick up|clean|return|drop off)\b/i.test(clean)

  let kind: SmartKind
  let reason: string
  let confidence = intent.confidence
  if (isAppointment) { kind = 'appointment'; reason = 'appointment language detected'; confidence = Math.max(.86, confidence + .12) }
  else if (isLink) { kind = 'link'; reason = 'web link detected'; confidence = .92 }
  else if (isThought) { kind = 'thought'; reason = 'thought/reference language detected'; confidence = .82 }
  else if (intent.type === 'shopping') { kind = 'shopping'; reason = 'shopping language detected'; confidence = Math.max(.78, confidence) }
  else if (intent.type === 'reminder') { kind = 'reminder'; reason = 'reminder language detected'; confidence = Math.max(.78, confidence) }
  else { kind = 'task'; reason = 'actionable item detected'; confidence = Math.max(.62, confidence) }

  let title = isAppointment ? cleanAppointmentTitle(clean, location, url) : intent.title
  if (isLink && url) {
    const withoutUrl = clean.replace(url,'').replace(/^(?:save|remember|bookmark|keep)\s+(?:this\s+)?/i,'').trim()
    try { title = withoutUrl || new URL(url).hostname.replace(/^www\./,'') } catch { title = withoutUrl || 'Saved link' }
  }
  return { kind, title, confidence: Math.min(.99, confidence), dueDate: date, dueTime: time, endTime: null, location, url, tags: [...intent.tags, `smart:${kind}`], reason, intent: { ...intent, title, dueDate: date, dueTime: time } }
}

function unfoldIcs(input: string) {
  return input.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').replace(/\r\n/g, '\n')
}

function unescapeIcs(value: string) {
  return value.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\').trim()
}

function parseIcsDate(value: string) {
  const raw = value.trim()
  if (/^\d{8}$/.test(raw)) return { date: `${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)}`, time: '09:00' }
  const m = raw.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/)
  if (!m) return null
  if (m[7]) {
    const d = new Date(Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3]),Number(m[4]),Number(m[5]),Number(m[6]||0)))
    return { date: isoLocalDate(d), time: `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}` }
  }
  return { date: `${m[1]}-${m[2]}-${m[3]}`, time: `${m[4]}:${m[5]}` }
}

export function parseIcs(text: string, provider = 'ics'): ParsedCalendarEvent[] {
  const unfolded = unfoldIcs(text)
  const blocks = unfolded.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) || []
  const out: ParsedCalendarEvent[] = []
  for (const block of blocks) {
    const props = new Map<string,string[]>()
    for (const line of block.split('\n')) {
      const idx = line.indexOf(':')
      if (idx <= 0) continue
      const left = line.slice(0, idx)
      const key = left.split(';')[0].toUpperCase()
      const value = line.slice(idx + 1)
      props.set(key, [...(props.get(key) || []), value])
    }
    const start = parseIcsDate(props.get('DTSTART')?.[0] || '')
    if (!start) continue
    const end = parseIcsDate(props.get('DTEND')?.[0] || '')
    const title = unescapeIcs(props.get('SUMMARY')?.[0] || 'Calendar event')
    const location = props.get('LOCATION')?.[0] ? unescapeIcs(props.get('LOCATION')![0]) : null
    const description = props.get('DESCRIPTION')?.[0] ? unescapeIcs(props.get('DESCRIPTION')![0]) : null
    const uid = props.get('UID')?.[0]?.trim() || null
    const rrule = props.get('RRULE')?.[0]?.trim() || null
    out.push({ title, event_date: start.date, start_time: start.time, end_time: end?.time || null, location, notes: description, attendees: [], recurrence_rule: rrule, provider, external_id: uid })
  }
  return out
}


function parseCsvRows(input: string) {
  const rows: string[][] = []
  let row: string[] = [], value = '', quoted = false
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    if (ch === '"') {
      if (quoted && input[i + 1] === '"') { value += '"'; i++; continue }
      quoted = !quoted
      continue
    }
    if (ch === ',' && !quoted) { row.push(value); value = ''; continue }
    if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && input[i + 1] === '\n') i++
      row.push(value); value = ''
      if (row.some(cell => cell.trim())) rows.push(row)
      row = []
      continue
    }
    value += ch
  }
  row.push(value)
  if (row.some(cell => cell.trim())) rows.push(row)
  return rows
}

function normalizedHeader(value: string) {
  return value.trim().toLowerCase().replace(/[\s_\-\/]+/g, '')
}

function calendarCsvDate(value: string) {
  const clean = value.trim()
  if (!clean) return null
  const iso = clean.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (iso) return `${iso[1]}-${String(Number(iso[2])).padStart(2,'0')}-${String(Number(iso[3])).padStart(2,'0')}`
  const us = clean.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/)
  if (us) {
    let year = Number(us[3]); if (year < 100) year += 2000
    return `${year}-${String(Number(us[1])).padStart(2,'0')}-${String(Number(us[2])).padStart(2,'0')}`
  }
  const parsed = new Date(clean)
  return Number.isNaN(parsed.getTime()) ? null : isoLocalDate(parsed)
}

function calendarCsvTime(value: string, fallback = '09:00') {
  const clean = value.trim()
  if (!clean) return fallback
  const match = clean.match(/^(\d{1,2})(?::(\d{2}))?(?::\d{2})?\s*(AM|PM)?$/i)
  if (!match) return fallback
  let hour = Number(match[1]); const minute = Number(match[2] || 0); const meridian = match[3]?.toUpperCase()
  if (meridian === 'PM' && hour < 12) hour += 12
  if (meridian === 'AM' && hour === 12) hour = 0
  if (hour > 23 || minute > 59) return fallback
  return `${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`
}

/** Parse common Outlook/generic calendar CSV exports without an external service. */
export function parseCalendarCsv(text: string, provider = 'calendar-csv'): ParsedCalendarEvent[] {
  const rows = parseCsvRows(text)
  if (rows.length < 2) return []
  const headers = rows[0].map(normalizedHeader)
  const find = (...candidates: string[]) => {
    const normalized = candidates.map(normalizedHeader)
    return headers.findIndex(h => normalized.includes(h))
  }
  const subjectIdx = find('subject','title','event','event title','name')
  const startDateIdx = find('start date','startdate','date','event date')
  const startTimeIdx = find('start time','starttime','time')
  const endTimeIdx = find('end time','endtime')
  const locationIdx = find('location','place','where')
  const descriptionIdx = find('description','notes','body')
  const uidIdx = find('uid','id','event id','external id')
  if (subjectIdx < 0 || startDateIdx < 0) return []
  const events: ParsedCalendarEvent[] = []
  for (const row of rows.slice(1)) {
    const title = (row[subjectIdx] || '').trim()
    const eventDate = calendarCsvDate(row[startDateIdx] || '')
    if (!title || !eventDate) continue
    const external = uidIdx >= 0 ? (row[uidIdx] || '').trim() || null : null
    events.push({
      title,
      event_date: eventDate,
      start_time: startTimeIdx >= 0 ? calendarCsvTime(row[startTimeIdx] || '') : '09:00',
      end_time: endTimeIdx >= 0 && (row[endTimeIdx] || '').trim() ? calendarCsvTime(row[endTimeIdx] || '') : null,
      location: locationIdx >= 0 ? (row[locationIdx] || '').trim() || null : null,
      notes: descriptionIdx >= 0 ? (row[descriptionIdx] || '').trim() || null : null,
      attendees: [], recurrence_rule: null, provider, external_id: external,
    })
  }
  return events
}

export async function inspectFile(file: File) {
  const lower = file.name.toLowerCase()
  const isIcs = lower.endsWith('.ics') || file.type === 'text/calendar'
  const isCsv = lower.endsWith('.csv') || file.type === 'text/csv'
  const isImage = file.type.startsWith('image/')
  const isText = file.type.startsWith('text/') || /\.(md|txt|csv|json|log|ics)$/i.test(lower)
  const result: { kind: 'calendar'|'image'|'file'; text: string | null; events: ParsedCalendarEvent[]; summary: string; provider: string | null } = {
    kind: isIcs ? 'calendar' : isImage ? 'image' : 'file', text: null, events: [], summary: `${file.name} · ${Math.max(1, Math.round(file.size / 1024))} KB`, provider: null,
  }
  if (isText && file.size <= 2_000_000) {
    result.text = await file.text()
    if (isIcs) {
      result.events = parseIcs(result.text, 'ics')
      result.provider = 'ics'
    } else if (isCsv) {
      const likelyOutlook = /subject\s*,\s*start date\s*,\s*start time/i.test(result.text.slice(0,1000))
      result.events = parseCalendarCsv(result.text, likelyOutlook ? 'outlook-csv' : 'calendar-csv')
      if (result.events.length) { result.kind = 'calendar'; result.provider = likelyOutlook ? 'outlook-csv' : 'calendar-csv' }
    }
  }
  return result
}

