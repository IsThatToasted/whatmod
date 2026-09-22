import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ArrowRight, CheckCircle2, Send, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAppData } from '../contexts/AppDataContext.js';
import { addDaysISO, todayISO } from '../lib/time.js';
import { lifeIntentParser } from '../lib/parser.js';
export function DailyReset() {
    const { items, updateItem, createItem, preferences } = useAppData();
    const today = todayISO();
    const storageKey = `justglance:daily-reset:${today}`;
    const [dismissed, setDismissed] = useState(() => localStorage.getItem(storageKey) === 'done');
    const [thought, setThought] = useState('');
    const [busy, setBusy] = useState(false);
    const completed = useMemo(() => items.filter(i => i.status === 'completed' && i.completed_at?.startsWith(today)).length, [items, today]);
    const carry = useMemo(() => items.filter(i => i.status === 'open' && i.due_date && i.due_date <= today), [items, today]);
    if (dismissed || preferences?.daily_reset_enabled === false)
        return null;
    async function moveAll() {
        setBusy(true);
        try {
            await Promise.all(carry.map(item => updateItem(item.id, { due_date: addDaysISO(1), snoozed_until: null })));
        }
        finally {
            setBusy(false);
        }
    }
    async function captureTomorrow() {
        if (!thought.trim())
            return;
        setBusy(true);
        try {
            const parsed = lifeIntentParser.parse(thought);
            await createItem({ ...parsed, dueDate: parsed.dueDate || addDaysISO(1) }, thought, { due_date: parsed.dueDate || addDaysISO(1) });
            setThought('');
        }
        finally {
            setBusy(false);
        }
    }
    function finish() {
        localStorage.setItem(storageKey, 'done');
        setDismissed(true);
    }
    return _jsxs("section", { className: "daily-reset-card", "aria-label": "Daily reset", children: [_jsxs("div", { className: "brief-head", children: [_jsxs("div", { children: [_jsx("span", { className: "eyebrow", children: "DAILY RESET" }), _jsx("h2", { children: "Nice. Today is wrapped up." })] }), _jsx("button", { className: "icon-button", "aria-label": "Dismiss daily reset", onClick: finish, children: _jsx(X, { size: 18 }) })] }), _jsxs("div", { className: "reset-summary", children: [_jsx(CheckCircle2, { size: 18 }), _jsxs("strong", { children: [completed, " completed"] }), _jsxs("span", { children: [carry.length, " waiting to carry forward"] })] }), carry.length > 0 && _jsxs("div", { className: "carry-list", children: [carry.slice(0, 4).map(item => _jsxs("div", { children: [_jsx("span", { children: item.title }), _jsxs("button", { onClick: () => updateItem(item.id, { due_date: addDaysISO(1), snoozed_until: null }), children: ["Tomorrow ", _jsx(ArrowRight, { size: 14 })] })] }, item.id)), carry.length > 1 && _jsx("button", { className: "secondary-button", disabled: busy, onClick: moveAll, children: "Move all to tomorrow" })] }), _jsxs("label", { className: "reset-capture", children: ["Anything on your mind?", _jsxs("div", { children: [_jsx("input", { value: thought, onChange: e => setThought(e.target.value), onKeyDown: e => { if (e.key === 'Enter')
                                    void captureTomorrow(); }, placeholder: "Capture it for tomorrow\u2026" }), _jsx("button", { className: "icon-button", disabled: !thought.trim() || busy, onClick: captureTomorrow, "aria-label": "Capture for tomorrow", children: _jsx(Send, { size: 18 }) })] })] }), _jsx("button", { className: "text-button reset-done", onClick: finish, children: "Done for today" })] });
}
