import { addDaysISO, todayISO } from './time.js';
const categories = [
    ['shopping', /\b(buy|pick up|pickup|grocery|groceries|toothpaste|milk|walmart|target|costco|aldi|store)\b/i],
    ['call', /\b(call|phone|ring)\b/i],
    ['errand', /\b(return|drop off|post office|bank|errand|fuel|gas)\b/i],
    ['chore', /\b(clean|trash|laundry|vacuum|filter|dishes|water plants)\b/i],
    ['reminder', /\b(remind|remember|ask\b|tell\b)\b/i],
    ['idea', /\b(idea|maybe|someday|consider)\b/i],
];
function inferDate(text) {
    const lower = text.toLowerCase();
    if (/\btoday\b/.test(lower))
        return todayISO();
    if (/\btomorrow\b/.test(lower))
        return addDaysISO(1);
    if (/\b(this week|sometime this week|by friday)\b/.test(lower)) {
        const d = new Date();
        const day = d.getDay();
        const untilFriday = (5 - day + 7) % 7 || 7;
        return addDaysISO(untilFriday);
    }
    const weekday = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    for (let i = 0; i < weekday.length; i++)
        if (new RegExp(`\\b${weekday[i]}\\b`, 'i').test(text)) {
            const d = new Date();
            const delta = (i - d.getDay() + 7) % 7 || 7;
            return addDaysISO(delta);
        }
    return null;
}
function inferTime(text) {
    const match = text.match(/\b(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(am|pm)\b/i);
    if (match) {
        let h = Number(match[1]);
        const m = Number(match[2] || 0);
        const mer = match[3].toLowerCase();
        if (mer === 'pm' && h < 12)
            h += 12;
        if (mer === 'am' && h === 12)
            h = 0;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
    if (/\btonight\b/i.test(text))
        return '19:00';
    if (/\bmorning\b/i.test(text))
        return '09:00';
    if (/\blunch\b/i.test(text))
        return '12:00';
    return null;
}
function cleanTitle(text) {
    return text.trim().replace(/^i\s+(need|have)\s+to\s+/i, '').replace(/^remind me to\s+/i, '').replace(/\s+/g, ' ');
}
export class LifeIntentParser {
    parse(text) {
        let type = 'task';
        for (const [candidate, rx] of categories)
            if (rx.test(text)) {
                type = candidate;
                break;
            }
        let priority = 'normal';
        if (/\b(urgent|important|asap|must)\b/i.test(text))
            priority = 'high';
        if (/\b(no rush|whenever|low priority)\b/i.test(text))
            priority = 'low';
        const dueDate = inferDate(text);
        const dueTime = inferTime(text);
        const store = text.match(/\b(?:at|from)\s+(Walmart|Target|Costco|CVS|Walgreens|Aldi|Lidl|Giant|Weis|Amazon|eBay|Etsy)\b/i)?.[1] || null;
        const tags = [type, ...(store ? ['shopping-place'] : []), ...(dueTime ? ['timed'] : [])];
        const quick = text.match(/\b(2|5|10|15|30|60)\s*(?:min|mins|minutes)\b/i);
        const confidence = Math.min(.96, .55 + (type !== 'task' ? .16 : 0) + (dueDate ? .1 : 0) + (dueTime ? .08 : 0) + (store ? .08 : 0));
        return { type, title: cleanTitle(text), context: store, dueDate, dueTime, priority, space: null, estimatedMinutes: quick ? Number(quick[1]) : null, tags, confidence };
    }
}
export const lifeIntentParser = new LifeIntentParser();
