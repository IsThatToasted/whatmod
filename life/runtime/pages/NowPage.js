import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { BellRing, Cake, CheckCircle2, Clock3, FolderKanban, Home, Inbox, ShoppingBasket, Sparkles, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAppData } from '../contexts/AppDataContext.js';
import { formatDate, formatTime, getTimePeriod, greeting, minutesUntilEvent, todayISO } from '../lib/time.js';
import { matchesMoodFocus, rankItems, shoppingNowSignal } from '../lib/relevance.js';
import { ItemCard } from '../components/ItemCard.js';
import { MoodSelector } from '../components/MoodSelector.js';
import { featureFlags } from '../lib/config.js';
import { MorningBrief } from '../components/MorningBrief.js';
import { DailyReset } from '../components/DailyReset.js';
import { useNearbyPlace } from '../hooks/useNearbyPlace.js';
import { useOrganizer } from '../contexts/OrganizerContext.js';
import { taskBucket } from '../lib/organizer.js';
export default function NowPage() {
    const { profile, preferences, items, events, activity, places, contacts } = useAppData();
    const { projects, reminders } = useOrganizer();
    const [mood, setMood] = useState(null);
    const now = new Date();
    const period = getTimePeriod(now);
    const today = todayISO(now);
    const todaysEvents = events.filter(e => e.event_date === today).sort((a, b) => a.start_time.localeCompare(b.start_time));
    const next = todaysEvents.find(e => {
        const [h, m] = e.start_time.split(':').map(Number);
        const d = new Date();
        d.setHours(h, m, 0, 0);
        return d > now;
    }) || null;
    const minutes = next ? minutesUntilEvent(next, now) : null;
    const locationEnabled = featureFlags.LOCATION && preferences?.location_reminders_enabled === true && profile?.location_permission_state === 'granted';
    const currentPlaceName = useNearbyPlace(places, locationEnabled);
    const context = { now, period, mood, minutesUntilNextEvent: minutes, nextEvent: next, currentPlaceName };
    const ranked = useMemo(() => rankItems(items, context), [items, mood, period, minutes, currentPlaceName]);
    const useful = useMemo(() => {
        if (!mood)
            return ranked.slice(0, 5);
        const preferred = ranked.filter(scored => matchesMoodFocus(scored.item, mood));
        if (!preferred.length)
            return ranked.slice(0, 5);
        const urgent = ranked.filter(scored => scored.reasons.some(reason => reason === 'overdue' || reason === 'due today' || reason === 'time window closing'));
        const seen = new Set();
        return [...urgent, ...preferred, ...ranked].filter(scored => !seen.has(scored.item.id) && seen.add(scored.item.id)).slice(0, 5);
    }, [ranked, mood]);
    const moodHeading = { nothing: 'Keep it light', quick: 'Quick wins', productive: 'Productive picks', errands: 'Errands first', home: 'Home mode', relax: 'Low-energy options', fun: 'Something fun' };
    const completed = items.filter(i => i.status === 'completed' && i.completed_at?.startsWith(today)).length;
    const openToday = items.filter(i => i.status === 'open' && i.due_date === today).length;
    const evening = period === 'evening' || period === 'night';
    const inboxCount = items.filter(i => taskBucket(i) === 'inbox').length;
    const activeProjects = projects.filter(p => p.status === 'active').length;
    const nextReminder = reminders.find(r => new Date(r.remind_at) > now) || null;
    const morning = period === 'early-morning' || period === 'morning';
    const upcomingBirthday = useMemo(() => {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return contacts.map(contact => {
            if (!contact.birthday)
                return null;
            const [, month, day] = contact.birthday.split('-').map(Number);
            let date = new Date(start.getFullYear(), month - 1, day);
            if (date < start)
                date = new Date(start.getFullYear() + 1, month - 1, day);
            const days = Math.round((date.getTime() - start.getTime()) / 86400000);
            return { contact, date, days };
        }).filter(Boolean).sort((a, b) => a.days - b.days)[0];
    }, [contacts, today]);
    const hero = minutes != null && minutes > 0
        ? `You have about ${minutes} minute${minutes === 1 ? '' : 's'} before ${next?.title}.`
        : openToday
            ? `${openToday} thing${openToday === 1 ? '' : 's'} worth a glance today.`
            : 'Nothing urgent is asking for you.';
    return _jsxs("div", { className: "page now-page", children: [_jsxs("section", { className: "now-hero", children: [_jsxs("div", { className: "eyebrow-row", children: [_jsx("span", { children: formatDate(now) }), currentPlaceName && _jsxs("span", { className: "location-pill", children: ["Near ", currentPlaceName] })] }), _jsxs("h1", { children: [greeting(period), ", ", profile?.greeting_name || profile?.display_name || 'there', "."] }), _jsx("p", { className: "hero-line", children: hero })] }), featureFlags.MORNING_BRIEF && morning && _jsx(MorningBrief, {}), _jsx(MoodSelector, { value: mood, onChange: setMood }), _jsxs("section", { className: "now-grid", children: [_jsxs("div", { className: "feed", children: [_jsxs("div", { className: "section-heading", children: [_jsxs("div", { children: [_jsx("span", { className: "eyebrow", children: "WORTH DOING NOW" }), _jsx("h2", { children: useful.length ? (mood ? moodHeading[mood] : 'Useful right now') : 'You’re clear' })] }), _jsx(Sparkles, { size: 20 })] }), useful.length ? useful.map(scored => {
        const shoppingSignal = scored.item.type === 'shopping' ? shoppingNowSignal(scored.item, context) : null;
        return _jsxs("div", { className: "recommendation", children: [shoppingSignal?.show && shoppingSignal.label && _jsxs("div", { className: `shopping-now-reminder ${scored.item.priority === 'high' ? 'important' : ''}`, children: [_jsx(ShoppingBasket, { size: 14 }), _jsx("span", { children: shoppingSignal.label })] }), _jsx(ItemCard, { item: scored.item }), Boolean(import.meta.env?.DEV) && _jsxs("small", { className: "score-debug", children: ["score ", scored.score, " · ", scored.reasons.slice(0, 2).join(', ')] })] }, scored.item.id);
    }) : _jsxs("div", { className: "empty-card", children: [_jsx(CheckCircle2, {}), _jsx("strong", { children: "Nothing urgent." }), _jsx("span", { children: "Enjoy the open space, or capture something if it\u2019s on your mind." })] }), evening && featureFlags.DAILY_RESET && _jsx(DailyReset, {})] }), _jsxs("aside", { className: "context-panel", children: [_jsxs("div", { className: "context-card", children: [_jsxs("div", { className: "context-title", children: [_jsx(Clock3, { size: 18 }), _jsx("strong", { children: "Up next" })] }), next ? _jsxs(_Fragment, { children: [_jsx("h3", { children: next.title }), _jsxs("p", { children: [formatTime(next.start_time), next.location ? ` · ${next.location}` : ''] })] }) : _jsxs(_Fragment, { children: [_jsx("h3", { children: "Open runway" }), _jsx("p", { children: "No more scheduled events today." })] })] }), _jsxs("div", { className: "context-card", children: [_jsxs("div", { className: "context-title", children: [_jsx(Inbox, { size: 18 }), _jsx("strong", { children: "Inbox" })] }), _jsx("p", { children: inboxCount ? `${inboxCount} captured thing${inboxCount === 1 ? '' : 's'} to organize when you have a minute.` : 'Nothing waiting to be sorted.' })] }), _jsxs("div", { className: "context-card", children: [_jsxs("div", { className: "context-title", children: [_jsx(FolderKanban, { size: 18 }), _jsx("strong", { children: "Projects" })] }), _jsx("p", { children: activeProjects ? `${activeProjects} active project${activeProjects === 1 ? '' : 's'} with connected next actions.` : 'No active projects right now.' })] }), nextReminder && _jsxs("div", { className: "context-card", children: [_jsxs("div", { className: "context-title", children: [_jsx(BellRing, { size: 18 }), _jsx("strong", { children: "Reminder" })] }), _jsx("h3", { children: nextReminder.title }), _jsx("p", { children: new Date(nextReminder.remind_at).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' }) })] }), upcomingBirthday && upcomingBirthday.days <= 30 && _jsxs("div", { className: "context-card", children: [_jsxs("div", { className: "context-title", children: [_jsx(Cake, { size: 18 }), _jsx("strong", { children: "Birthday" })] }), _jsx("h3", { children: upcomingBirthday.contact.display_name }), _jsx("p", { children: upcomingBirthday.days === 0 ? 'Today' : upcomingBirthday.days === 1 ? 'Tomorrow' : `${upcomingBirthday.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · ${upcomingBirthday.days} days` })] }), _jsxs("div", { className: "context-card", children: [_jsxs("div", { className: "context-title", children: [_jsx(Home, { size: 18 }), _jsx("strong", { children: "Shared" })] }), _jsxs("p", { children: [items.filter(i => i.space_id && i.status === 'open').length, " shared item(s) waiting."] })] }), preferences?.shared_activity_enabled !== false && activity[0] && _jsxs("div", { className: "context-card", children: [_jsxs("div", { className: "context-title", children: [_jsx(Users, { size: 18 }), _jsx("strong", { children: "Recent" })] }), _jsxs("p", { children: [activity[0].actor_name || 'Someone', " ", activity[0].action, " ", activity[0].entity_title, "."] })] }), _jsxs("div", { className: "context-card", children: [_jsxs("div", { className: "context-title", children: [_jsx(CheckCircle2, { size: 18 }), _jsx("strong", { children: "Today" })] }), _jsxs("p", { children: [completed, " completed so far."] })] })] })] })] });
}
