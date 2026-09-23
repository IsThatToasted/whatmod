import { todayISO } from './time.js';
const moodBoost = {
    quick: ['task', 'call'],
    productive: ['call', 'task'],
    errands: ['shopping', 'errand'],
    home: ['chore'],
    relax: ['idea'],
    fun: ['idea'],
    nothing: [],
};
function daysUntilDate(dateISO, now) {
    const today = todayISO(now);
    return Math.round((new Date(`${dateISO}T12:00:00`).getTime() - new Date(`${today}T12:00:00`).getTime()) / 86400000);
}
function minutesUntilDueTime(item, now) {
    if (!item.due_date || !item.due_time)
        return null;
    const [y, m, d] = item.due_date.split('-').map(Number);
    const [h, min] = item.due_time.split(':').map(Number);
    const target = new Date(y, m - 1, d, h, min || 0, 0, 0);
    return Math.round((target.getTime() - now.getTime()) / 60000);
}
export function shoppingNowSignal(item, context) {
    if (item.type !== 'shopping' || item.status !== 'open')
        return { show: false, daysUntil: null, label: null, reason: null };
    const nearStore = Boolean(context.currentPlaceName &&
        item.place_name &&
        item.place_name.toLowerCase() === context.currentPlaceName.toLowerCase());
    if (!item.due_date) {
        if (context.mood === 'errands')
            return { show: true, daysUntil: null, label: 'Shopping · errands mode', reason: 'errands mode' };
        if (nearStore)
            return { show: true, daysUntil: null, label: `Shopping · you’re near ${item.place_name}`, reason: 'nearby' };
        return { show: false, daysUntil: null, label: null, reason: 'shopping belongs in its list until relevant' };
    }
    const daysUntil = daysUntilDate(item.due_date, context.now);
    const important = item.priority === 'high';
    if (daysUntil > 7)
        return { show: false, daysUntil, label: null, reason: 'shopping due later' };
    if (daysUntil < 0) {
        if (!important)
            return { show: false, daysUntil, label: null, reason: 'shopping due date passed' };
        const overdueDays = Math.abs(daysUntil);
        return { show: true, daysUntil, label: `Important shopping · ${overdueDays} day${overdueDays === 1 ? '' : 's'} overdue`, reason: 'important shopping overdue' };
    }
    if (important) {
        if (daysUntil === 0)
            return { show: true, daysUntil, label: 'Important shopping · due today', reason: 'important shopping due today' };
        if (daysUntil === 1)
            return { show: true, daysUntil, label: 'Important shopping · due tomorrow', reason: 'important shopping countdown' };
        return { show: true, daysUntil, label: `Important shopping · ${daysUntil} days remaining`, reason: 'important shopping countdown' };
    }
    if (daysUntil === 7)
        return { show: true, daysUntil, label: 'Shopping reminder · due in 7 days', reason: 'shopping seven-day reminder' };
    if (daysUntil === 1)
        return { show: true, daysUntil, label: 'Shopping reminder · due tomorrow', reason: 'shopping day-before reminder' };
    if (daysUntil === 0)
        return { show: true, daysUntil, label: 'Shopping reminder · due today', reason: 'shopping due today' };
    return { show: false, daysUntil, label: null, reason: 'shopping reminder not scheduled today' };
}
export function calculateRelevanceScore(item, context) {
    let score = 0;
    const reasons = [];
    if (item.status !== 'open')
        return { item, score: -999, reasons: ['not open'] };
    if (item.snoozed_until && new Date(item.snoozed_until) > context.now)
        return { item, score: -100, reasons: ['snoozed'] };
    if (item.type === 'shopping') {
        const shoppingSignal = shoppingNowSignal(item, context);
        if (!shoppingSignal.show)
            return { item, score: -90, reasons: [shoppingSignal.reason || 'shopping not relevant now'] };
        if (shoppingSignal.daysUntil === 7)
            score += 26;
        else if (shoppingSignal.daysUntil === 1)
            score += 30;
        else if (shoppingSignal.daysUntil === 0)
            score += 38;
        else if (shoppingSignal.daysUntil != null && shoppingSignal.daysUntil < 0)
            score += 34;
        else if (shoppingSignal.daysUntil != null)
            score += 24;
        reasons.push(shoppingSignal.reason || 'shopping reminder');
    }
    if (item.due_date) {
        const diff = daysUntilDate(item.due_date, context.now);
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
    if (context.mood !== 'nothing' && context.mood && moodBoost[context.mood]?.includes(item.type)) {
        score += 40;
        reasons.push(`${context.mood} mode`);
    }
    if (context.mood === 'quick' && (item.estimated_minutes || 999) <= 15) {
        score += 35;
        reasons.push('quick-mode fit');
    }
    if (context.mood === 'productive' && (item.priority === 'high' || item.energy_level === 'high')) {
        score += 25;
        reasons.push('productive-mode fit');
    }
    if (context.mood === 'errands' && (item.type === 'errand' || item.type === 'shopping')) {
        score += 25;
        reasons.push('errand-mode fit');
    }
    if (context.mood === 'home' && (item.type === 'chore' || /home/i.test(item.place_name || ''))) {
        score += 25;
        reasons.push('home-mode fit');
    }
    if (context.mood === 'relax' && (item.energy_level === 'low' || item.type === 'idea')) {
        score += 30;
        reasons.push('low-energy fit');
    }
    if (context.mood === 'fun' && (item.type === 'idea' || item.context_tags?.some(tag => /fun|hobby|game|watch|read/i.test(tag)))) {
        score += 35;
        reasons.push('fun-mode fit');
    }
    if (context.mood === 'nothing') {
        if ((item.estimated_minutes || 999) <= 10 || item.energy_level === 'low') {
            score += 25;
            reasons.push('easy-mode fit');
        }
        else if (!item.due_date && item.priority !== 'high')
            score -= 35;
    }
    return { item, score, reasons };
}
export function rankItems(items, context) {
    return items
        .map(item => calculateRelevanceScore(item, context))
        .filter(scored => scored.score > -80)
        .sort((a, b) => b.score - a.score);
}
export function matchesMoodFocus(item, mood) {
    if (!mood)
        return true;
    if (mood === 'quick')
        return (item.estimated_minutes || 999) <= 15;
    if (mood === 'productive')
        return item.priority === 'high' || item.energy_level === 'high' || item.type === 'task' || item.type === 'call';
    if (mood === 'errands')
        return item.type === 'errand' || item.type === 'shopping';
    if (mood === 'home')
        return item.type === 'chore' || /home/i.test(item.place_name || '');
    if (mood === 'relax')
        return item.energy_level === 'low' || item.type === 'idea';
    if (mood === 'fun')
        return item.type === 'idea' || item.context_tags?.some(tag => /fun|hobby|game|watch|read/i.test(tag)) === true;
    return (item.estimated_minutes || 999) <= 10 || item.energy_level === 'low' || item.priority === 'high' || !!item.due_date;
}
