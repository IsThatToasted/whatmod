import type { EventItem } from '../types'
import type { ParsedCalendarEvent } from '../lib/smartIntake'

export type CalendarProviderId = 'internal' | 'ics' | 'google' | 'outlook' | 'apple' | string

export interface CalendarImportResult {
  provider: CalendarProviderId
  events: ParsedCalendarEvent[]
  sourceName?: string
}

export interface CalendarProvider {
  id: CalendarProviderId
  label: string
  getEvents(from: string, to: string): Promise<EventItem[]>
  createEvent(event: Omit<EventItem,'id'>): Promise<EventItem>
  updateEvent(id: string, patch: Partial<EventItem>): Promise<void>
  deleteEvent(id: string): Promise<void>
  /** Optional provider-specific import path. ICS is the no-OAuth fallback used today. */
  importFile?(file: File): Promise<CalendarImportResult>
  /** Reserved for OAuth/API-backed providers such as Google Calendar or Microsoft Outlook. */
  connect?(): Promise<void>
  disconnect?(): Promise<void>
}
