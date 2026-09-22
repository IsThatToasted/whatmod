import { todayISO } from './time.js';
const moodBoost = {
    quick: ['task', 'call'],
    productive: ['call', 'task'],
    errands: ['shopping', 'errand'],
    home: ['chore', 'shopping'],
    relax: ['idea'],
    fun: ['idea'],
    nothing: [],
};
function minutesUntilDueTime(item, now) {
    if (!item.due_date || !item.due_time)
        return null;
    const [y, m, d] = item.due_date.split('-').map(Number);
    const [h, min] = item.due_time.split(':').map(Number);
    const target = new Date(y, m - 1, d, h, min || 0, 0, 0);
    return Math.round((target.getTime() - now.getTime()) / 60000);
}
export function calculateRelevanceScore(item, context) {
    let score = 0;
    const reasons = [];
    const today = todayISO(context.now);
    if (item.status !== 'open')
        return { item, score: -999, reasons: ['not open'] };
    if (item.snoozed_until && new Date(item.snoozed_until) > context.now)
        return { item, score: -100, reasons: ['snoozed'] };
    if (item.due_date) {
        const diff = Math.ceil((new Date(`${item.due_date}T12:00:00`).getTime() - new Date(`${today}T12:00:00`).getTime()) / 86400000);
        if (diff < 0) {
            score += 30;
            reasons.push('overdue');
        }
        else if (diff === 0) {
            score += 35;
            reasons.push('due today');
        }
        else if (diff <= 2) {
            score += 20;
            reasons.push('due soon');
        }
    }
    const dueMinutes = minutesUntilDueTime(item, context.now);
    if (dueMinutes != null && dueMinutes >= 0 && dueMinutes <= 90) {
        score += 25;
        reasons.push('time window closing');
    }
    if (item.priority === 'high') {
        score += 15;
        reasons.push('high priority');
    }
    if ((item.estimated_minutes || 999) <= 10) {
        score += 10;
        reasons.push('quick win');
    }
    if (item.snooze_count >= 2) {
        score += 15;
        reasons.push('postponed');
    }
    const ageHours = (context.now.getTime() - new Date(item.created_at).getTime()) / 3600000;
    if (ageHours <= 12) {
        score += 5;
        reasons.push('recent');
    }
    if (context.currentPlaceName && item.place_name?.toLowerCase() === context.currentPlaceName.toLowerCase()) {
        score += 30;
        reasons.push('nearby');
    }
    if (context.minutesUntilNextEvent != null && item.estimated_minutes != null && item.estimated_minutes + 5 <= context.minutesUntilNextEvent) {
        score += 8;
        reasons.push('fits before next event');
    }
    const hour = context.now.getHours();
    if (item.type === 'call' && (hour < 8 || hour >= 17)) {
        score -= 30;
        reasons.push('outside call hours');
    }
    if (item.type === 'shopping' && context.period === 'early-morning') {
        score -= 20;
        reasons.push('low relevance now');
    }
    if (context.mood !== 'nothing' && context.mood && moodBoost[context.mood]?.includes(item.type)) {
        score += 22;
        reasons.push(`${context.mood} mode`);
    }
    if (context.mood === 'quick' && (item.estimated_minutes || 999) <= 10)
        score += 20;
    if (context.mood === 'nothing' && !item.due_date && item.priority !== 'high')
        score -= 30;
    return { item, score, reasons };
}
export function rankItems(items, context) {
    return items
        .map(item => calculateRelevanceScore(item, context))
        .filter(scored => scored.score > -80)
        .sort((a, b) => b.score - a.score);
}
