import type { ItemType, LifeItem, Priority } from '../types/models';

export interface ParsedIntent {
  type: ItemType;
  title: string;
  context: string | null;
  dueDate: string | null;
  dueTime: string | null;
  priority: Priority;
  estimatedMinutes: number | null;
  tags: string[];
  confidence: number;
}

const categoryRules: Array<[RegExp, ItemType]> = [
  [/\b(buy|pick up|grocery|groceries|walmart|target|milk|toothpaste|paper towels)\b/i, 'shopping'],
  [/\b(call|phone|ring)\b/i, 'call'],
  [/\b(return|drop off|pickup|pick up|errand|post office)\b/i, 'errand'],
  [/\b(trash|clean|laundry|dishes|vacuum|water plants)\b/i, 'chore'],
  [/\b(remember|remind|ask .* about)\b/i, 'reminder'],
  [/\b(idea|maybe|someday)\b/i, 'idea']
];

function nextWeekday(day: number): string {
  const d = new Date();
  const diff = (day + 7 - d.getDay()) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function detectDate(text: string): string | null {
  const lower = text.toLowerCase();
  const now = new Date();
  if (lower.includes('today')) return now.toISOString().slice(0, 10);
  if (lower.includes('tomorrow')) { now.setDate(now.getDate() + 1); return now.toISOString().slice(0, 10); }
  if (lower.includes('this week')) { const d = new Date(); d.setDate(d.getDate() + Math.max(1, 6 - d.getDay())); return d.toISOString().slice(0, 10); }
  const names = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  const idx = names.findIndex((n) => lower.includes(n));
  if (idx >= 0) return nextWeekday(idx);
  return null;
}

function detectTime(text: string): string | null {
  const match = text.match(/\b(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(am|pm)\b/i);
  if (!match) return /\btonight\b/i.test(text) ? '19:00' : /\bmorning\b/i.test(text) ? '09:00' : null;
  let h = Number(match[1]); const m = match[2] ?? '00'; const ap = match[3].toLowerCase();
  if (ap === 'pm' && h !== 12) h += 12;
  if (ap === 'am' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${m}`;
}

function titleCaseCleanup(text: string): string {
  return text.trim().replace(/^i\s+(need|have|want)\s+to\s+/i, '').replace(/^remind me to\s+/i, '').replace(/[.!]+$/, '').replace(/^./, (c) => c.toUpperCase());
}

export function parseLifeIntent(text: string): ParsedIntent {
  const type = categoryRules.find(([r]) => r.test(text))?.[1] ?? 'task';
  const lower = text.toLowerCase();
  const priority: Priority = /\b(urgent|important|asap|must)\b/i.test(text) ? 'high' : /\b(low priority|whenever)\b/i.test(text) ? 'low' : 'normal';
  const context = lower.includes('walmart') ? 'Walmart' : lower.includes('target') ? 'Target' : lower.includes('home') ? 'Home' : lower.includes('work') ? 'Work' : null;
  const minuteMatch = text.match(/\b(\d{1,3})\s*(?:min|minute)s?\b/i);
  return {
    type,
    title: titleCaseCleanup(text),
    context,
    dueDate: detectDate(text),
    dueTime: detectTime(text),
    priority,
    estimatedMinutes: minuteMatch ? Number(minuteMatch[1]) : null,
    tags: [type, context?.toLowerCase()].filter(Boolean) as string[],
    confidence: type === 'task' ? 0.68 : 0.86
  };
}

export function parsedIntentToItem(text: string, parsed = parseLifeIntent(text)): LifeItem {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(), title: parsed.title, type: parsed.type, status: 'open', priority: parsed.priority,
    due_date: parsed.dueDate, due_time: parsed.dueTime, estimated_minutes: parsed.estimatedMinutes,
    place_name: parsed.context, context_tags: parsed.tags, source_text: text, parser_result: parsed as unknown as Record<string, unknown>,
    created_at: now, updated_at: now, postpone_count: 0
  };
}
