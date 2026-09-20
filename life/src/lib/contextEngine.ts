import type { LifeItem, Mood } from '../types/models';

export type DayPeriod = 'early-morning' | 'morning' | 'midday' | 'afternoon' | 'evening' | 'night';
export function getDayPeriod(date = new Date()): DayPeriod {
  const h = date.getHours();
  if (h < 6) return 'early-morning'; if (h < 11) return 'morning'; if (h < 14) return 'midday'; if (h < 18) return 'afternoon'; if (h < 22) return 'evening'; return 'night';
}
export function greeting(period = getDayPeriod()): string {
  if (period === 'early-morning' || period === 'morning') return 'Good morning';
  if (period === 'midday') return 'Good afternoon';
  if (period === 'afternoon') return 'Good afternoon';
  return 'Good evening';
}

function dueDeltaHours(item: LifeItem, now: Date): number | null {
  if (!item.due_date) return null;
  const t = item.due_time ?? '23:59';
  const due = new Date(`${item.due_date}T${t}:00`);
  return (due.getTime() - now.getTime()) / 36e5;
}

export function calculateRelevanceScore(item: LifeItem, mood: Mood = 'productive', now = new Date()): number {
  if (item.status === 'completed') return -999;
  let score = 10;
  const dh = dueDeltaHours(item, now);
  if (dh !== null && dh <= 0) score += 30;
  else if (dh !== null && dh <= 24) score += 35;
  else if (dh !== null && dh <= 72) score += 18;
  if (item.priority === 'high') score += 15;
  if ((item.postpone_count ?? 0) >= 2) score += 15;
  if ((item.estimated_minutes ?? 999) <= 10) score += 10;
  if (Date.now() - new Date(item.created_at).getTime() < 86400000) score += 5;
  const h = now.getHours();
  if (item.type === 'call' && (h < 8 || h > 18)) score -= 30;
  if (mood === 'quick' && (item.estimated_minutes ?? 999) <= 10) score += 30;
  if (mood === 'errands' && ['shopping','errand'].includes(item.type)) score += 35;
  if (mood === 'home' && item.type === 'chore') score += 30;
  if (mood === 'productive' && ['task','call'].includes(item.type)) score += 15;
  if (mood === 'nothing') score -= item.priority === 'high' ? 0 : 35;
  return score;
}
