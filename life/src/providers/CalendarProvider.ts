import type { EventItem } from '../types'
export interface CalendarProvider {
  getEvents(from: string, to: string): Promise<EventItem[]>
  createEvent(event: Omit<EventItem,'id'>): Promise<EventItem>
  updateEvent(id: string, patch: Partial<EventItem>): Promise<void>
  deleteEvent(id: string): Promise<void>
}
