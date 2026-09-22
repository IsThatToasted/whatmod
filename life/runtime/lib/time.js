export function getTimePeriod(date = new Date()) {
    const h = date.getHours();
    if (h < 6)
        return 'early-morning';
    if (h < 11)
        return 'morning';
    if (h < 14)
        return 'midday';
    if (h < 18)
        return 'afternoon';
    if (h < 22)
        return 'evening';
    return 'night';
}
export function greeting(period) {
    if (period === 'early-morning' || period === 'morning')
        return 'Good morning';
    if (period === 'midday' || period === 'afternoon')
        return 'Good afternoon';
    return 'Good evening';
}
export function formatDate(date = new Date()) {
    return new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(date);
}
export function formatTime(time) {
    if (!time)
        return '';
    const [h, m] = time.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m || 0, 0, 0);
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(d);
}
export function minutesUntilEvent(event, now = new Date()) {
    const [y, mo, d] = event.event_date.split('-').map(Number);
    const [h, mi] = event.start_time.split(':').map(Number);
    const target = new Date(y, mo - 1, d, h, mi || 0);
    return Math.max(0, Math.round((target.getTime() - now.getTime()) / 60000));
}
export function todayISO(date = new Date()) {
    const y = date.getFullYear();
    return `${y}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function addDaysISO(days, from = new Date()) {
    const d = new Date(from);
    d.setDate(d.getDate() + days);
    return todayISO(d);
}
export function relativeDue(date, time) {
    if (!date)
        return null;
    const today = todayISO();
    const tomorrow = addDaysISO(1);
    const suffix = time ? ` · ${formatTime(time)}` : '';
    if (date === today)
        return `Today${suffix}`;
    if (date === tomorrow)
        return `Tomorrow${suffix}`;
    const parsed = new Date(`${date}T12:00:00`);
    return `${new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(parsed)}${suffix}`;
}
export function nextRecurringDate(rule, fromDate = todayISO()) {
    const base = new Date(`${fromDate}T12:00:00`);
    const add = (days) => { const d = new Date(base); d.setDate(d.getDate() + days); return todayISO(d); };
    if (rule === 'daily')
        return add(1);
    if (rule === 'weekdays') {
        let d = new Date(base);
        do {
            d.setDate(d.getDate() + 1);
        } while ([0, 6].includes(d.getDay()));
        return todayISO(d);
    }
    if (rule === 'weekly')
        return add(7);
    if (rule === 'monthly') {
        const d = new Date(base);
        d.setMonth(d.getMonth() + 1);
        return todayISO(d);
    }
    const every = rule.match(/^every:(\d+)$/);
    if (every)
        return add(Math.max(1, Number(every[1])));
    const weekdays = rule.match(/^weekdays:([0-6](?:,[0-6])*)$/);
    if (weekdays) {
        const allowed = weekdays[1].split(',').map(Number);
        let d = new Date(base);
        do {
            d.setDate(d.getDate() + 1);
        } while (!allowed.includes(d.getDay()));
        return todayISO(d);
    }
    return add(1);
}
