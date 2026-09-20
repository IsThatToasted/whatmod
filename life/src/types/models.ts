export type ItemType = 'task' | 'shopping' | 'reminder' | 'chore' | 'idea' | 'call' | 'errand';
export type Priority = 'low' | 'normal' | 'high';
export type ItemStatus = 'open' | 'completed' | 'snoozed';
export type Mood = 'nothing' | 'quick' | 'productive' | 'errands' | 'home' | 'relax' | 'fun';

export interface LifeItem {
  id: string;
  user_id?: string;
  space_id?: string | null;
  title: string;
  description?: string | null;
  type: ItemType;
  status: ItemStatus;
  priority: Priority;
  due_date?: string | null;
  due_time?: string | null;
  estimated_minutes?: number | null;
  place_name?: string | null;
  assigned_to?: string | null;
  recurrence_rule?: string | null;
  context_tags: string[];
  source_text?: string | null;
  parser_result?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
  snoozed_until?: string | null;
  postpone_count?: number;
}

export interface EventRecord {
  id: string;
  title: string;
  start_at: string;
  end_at?: string | null;
  location?: string | null;
  space_id?: string | null;
}

export interface Space {
  id: string;
  name: string;
  role: 'owner' | 'admin' | 'member';
  emoji?: string;
  member_count?: number;
}

export interface Place {
  id: string;
  name: string;
  category: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  radius?: number;
}

export interface ActivityEntry {
  id: string;
  text: string;
  created_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  greeting_name: string;
  wake_time: string;
  sleep_time: string;
  theme: 'light' | 'dark' | 'system';
  onboarding_complete: boolean;
}
