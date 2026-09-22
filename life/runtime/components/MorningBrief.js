import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { CalendarDays, ChevronRight, Sparkles, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAppData } from '../contexts/AppDataContext.js';
import { formatTime, minutesUntilEvent, todayISO } from '../lib/time.js';
export function MorningBrief() {
    const { items, events, preferences } = useAppData();
    const today = todayISO();
    const storageKey = `justglance:morning-brief:${today}`;
    const [hidden, setHidden] = useState(() => sessionStorage.getItem(storageKey) === 'hidden');
    const summary = useMemo(() => {
        const open = items.filter(i => i.status === 'open');
        const todayItems = open.filter(i => i.due_date === today);
        const errands = todayItems.filter(i => i.type === 'errand' || i.type === 'shopping').length;
        const shared = todayItems.filter(i => Boolean(i.space_id)).length;
        const todaysEvents = events.filter(e => e.event_date === today).sort((a, b) => a.start_time.localeCompare(b.start_time));
        const first = todaysEvents[0] || null;
        const free = first ? minutesUntilEvent(first) : null;
        return { count: todayItems.length, errands, shared, first, free };
    }, [items, events, today]);
    if (hidden || preferences?.morning_brief_enabled === false)
        return null;
    return _jsxs("section", { className: "morning-brief-card", "aria-label": "Morning brief", children: [_jsxs("div", { className: "brief-head", children: [_jsxs("div", { children: [_jsx("span", { className: "eyebrow", children: "MORNING BRIEF" }), _jsx("h2", { children: "Here\u2019s your day." })] }), _jsx("button", { className: "icon-button", "aria-label": "Hide morning brief", onClick: () => { sessionStorage.setItem(storageKey, 'hidden'); setHidden(true); }, children: _jsx(X, { size: 18 }) })] }), _jsxs("div", { className: "brief-stats", children: [_jsxs("div", { children: [_jsx("strong", { children: summary.count }), _jsx("span", { children: "important today" })] }), _jsxs("div", { children: [_jsx("strong", { children: summary.errands }), _jsx("span", { children: "errands" })] }), _jsxs("div", { children: [_jsx("strong", { children: summary.shared }), _jsx("span", { children: "shared" })] })] }), _jsxs("div", { className: "brief-footer", children: [summary.first ? _jsxs("span", { children: [_jsx(CalendarDays, { size: 16 }), "First event ", formatTime(summary.first.start_time), summary.free != null ? ` · about ${summary.free} min free` : ''] }) : _jsxs("span", { children: [_jsx(Sparkles, { size: 16 }), "No scheduled event is crowding the morning."] }), _jsx(ChevronRight, { size: 17 })] })] });
}
