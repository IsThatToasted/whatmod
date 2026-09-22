export type ItemType = 'task' | 'shopping' | 'call' | 'errand' | 'reminder' | 'idea' | 'chore'
export type ItemStatus = 'open' | 'completed' | 'dismissed'
export type Priority = 'low' | 'normal' | 'high'
export type Mood = 'nothing' | 'quick' | 'productive' | 'errands' | 'home' | 'relax' | 'fun'
export type TimePeriod = 'early-morning' | 'morning' | 'midday' | 'afternoon' | 'evening' | 'night'
export type ProjectStatus = 'active' | 'paused' | 'completed' | 'archived'
export type EnergyLevel = 'low' | 'medium' | 'high'
export type SpacePermissionKey = 'view_shopping' | 'edit_shopping' | 'view_tasks' | 'edit_tasks' | 'view_calendar' | 'edit_calendar' | 'view_notes' | 'edit_notes' | 'view_projects' | 'edit_projects' | 'invite_members'
export type CaptureKind = 'thought' | 'text' | 'link' | 'file' | 'image' | 'calendar_import'

export interface SpacePermissions {
  view_shopping: boolean
  edit_shopping: boolean
  view_tasks: boolean
  edit_tasks: boolean
  view_calendar: boolean
  edit_calendar: boolean
  view_notes: boolean
  edit_notes: boolean
  view_projects: boolean
  edit_projects: boolean
  invite_members: boolean
}

export interface Profile {
  id: string
  email: string | null
  display_name: string
  greeting_name: string
  avatar_url?: string | null
  timezone: string
  wake_time: string
  sleep_time: string
  work_start?: string | null
  work_end?: string | null
  work_days?: number[]
  theme: 'light' | 'dark' | 'system'
  week_starts_on?: number
  time_format?: '12h' | '24h'
  onboarding_complete: boolean
  help_areas?: string[]
  location_permission_state?: 'unknown' | 'granted' | 'denied' | 'unsupported'
}

export interface UserPreferences {
  user_id: string
  morning_brief_enabled: boolean
  daily_reset_enabled: boolean
  smart_suggestions_enabled: boolean
  urgent_reminders_enabled: boolean
  upcoming_tasks_enabled: boolean
  shared_activity_enabled: boolean
  location_reminders_enabled: boolean
  routine_reminders_enabled: boolean
  default_mood: Mood
  feature_overrides?: Record<string, boolean>
}

export interface Space {
  id: string
  owner_id: string
  name: string
  icon: string
  is_personal?: boolean
  role?: 'owner' | 'admin' | 'member'
  created_at: string
}

export interface SpaceMember {
  space_id: string
  user_id: string
  role: 'owner' | 'admin' | 'member'
  permissions?: Partial<SpacePermissions> | null
  display_name: string
  greeting_name?: string | null
  avatar_url?: string | null
}

export interface Place {
  id: string
  user_id: string
  name: string
  category: string
  address?: string | null
  latitude?: number | null
  longitude?: number | null
  radius_meters: number
  notes?: string | null
}

export interface ShoppingList {
  id: string
  space_id: string
  created_by: string
  name: string
  icon?: string | null
  sort_order?: number
  created_at: string
  updated_at?: string
  archived_at?: string | null
}

export interface ShoppingDetails {
  quantity?: number | null
  unit?: string | null
  preferred_store?: string | null
  estimated_price?: number | null
  aisle_category?: string | null
  list_id?: string | null
}

export interface LifeItem {
  id: string
  user_id: string
  space_id?: string | null
  project_id?: string | null
  parent_item_id?: string | null
  title: string
  description?: string | null
  type: ItemType
  status: ItemStatus
  priority: Priority
  due_date?: string | null
  due_time?: string | null
  start_date?: string | null
  scheduled_at?: string | null
  defer_until?: string | null
  estimated_minutes?: number | null
  energy_level?: EnergyLevel | null
  waiting_for?: string | null
  is_inbox?: boolean
  focus_pin?: boolean
  sort_order?: number
  place_id?: string | null
  place_name?: string | null
  assigned_to?: string | null
  recurrence_rule?: string | null
  context_tags: string[]
  source_text?: string | null
  parser_result?: ParsedIntent | null
  shopping?: ShoppingDetails | null
  created_at: string
  updated_at: string
  completed_at?: string | null
  snoozed_until?: string | null
  snooze_count: number
}

export interface EventItem {
  id: string
  user_id: string
  space_id?: string | null
  project_id?: string | null
  title: string
  event_date: string
  start_time: string
  end_time?: string | null
  location?: string | null
  notes?: string | null
  attendees?: unknown[]
  recurrence_rule?: string | null
  provider?: string
  external_id?: string | null
}

export interface Note {
  id: string
  user_id: string
  space_id?: string | null
  project_id?: string | null
  title: string
  body: string
  tags?: string[]
  pinned?: boolean
  color?: string | null
  source_text?: string | null
  created_at: string
  updated_at?: string
}

export interface Project {
  id: string
  user_id: string
  space_id?: string | null
  name: string
  description?: string | null
  status: ProjectStatus
  priority: Priority
  icon: string
  color?: string | null
  target_date?: string | null
  created_at: string
  updated_at: string
  completed_at?: string | null
  archived_at?: string | null
}

export interface ReminderRecord {
  id: string
  user_id: string
  item_id?: string | null
  event_id?: string | null
  title: string
  body?: string | null
  remind_at: string
  kind: 'notification' | 'alarm'
  delivered_at?: string | null
  dismissed_at?: string | null
  created_at: string
}


export interface CaptureRecord {
  id: string
  user_id: string
  space_id?: string | null
  kind: CaptureKind
  title: string
  raw_text?: string | null
  source_url?: string | null
  mime_type?: string | null
  file_name?: string | null
  storage_path?: string | null
  parsed_kind?: string | null
  parsed_data?: Record<string, unknown> | null
  status: 'inbox' | 'processed' | 'archived'
  created_item_id?: string | null
  created_event_id?: string | null
  created_note_id?: string | null
  created_at: string
  updated_at?: string
}

export interface InviteResult {
  token: string
  space_id: string
  expires_at: string
}

export interface ActivityEntry {
  id: string
  user_id: string
  space_id?: string | null
  action: string
  entity_type: string
  entity_title: string
  created_at: string
  actor_name?: string | null
}

export interface LifeSearchResults {
  items: LifeItem[]
  notes: Note[]
  events: EventItem[]
  spaces: Space[]
  activity: ActivityEntry[]
}

export interface ParsedIntent {
  type: ItemType
  title: string
  context?: string | null
  dueDate?: string | null
  dueTime?: string | null
  priority: Priority
  space?: string | null
  estimatedMinutes?: number | null
  tags: string[]
  confidence: number
}

export interface AppContextSnapshot {
  now: Date
  period: TimePeriod
  mood: Mood | null
  minutesUntilNextEvent: number | null
  nextEvent?: EventItem | null
  currentPlaceName?: string | null
}

export interface WeatherData {
  temperature: number
  condition: string
  high?: number
  low?: number
}
