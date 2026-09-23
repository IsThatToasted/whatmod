import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { CheckCircle2, CircleDashed, Inbox, ListChecks, Search, TimerReset } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ItemCard } from '../components/ItemCard.js';
import { useAppData } from '../contexts/AppDataContext.js';
import { taskBucket } from '../lib/organizer.js';
const filters = [
    ['today', 'Today'], ['inbox', 'Inbox'], ['overdue', 'Overdue'], ['upcoming', 'Next 7 days'], ['waiting', 'Waiting'], ['anytime', 'Anytime'], ['completed', 'Completed'], ['all', 'All']
];
export default function TasksPage() {
    const { items, spaces } = useAppData();
    const [params] = useSearchParams();
    const spaceId = params.get('space') || '';
    const space = spaces.find(candidate => candidate.id === spaceId);
    const [filter, setFilter] = useState('today');
    const [query, setQuery] = useState('');
    const taskItems = useMemo(() => items.filter(item => item.type !== 'shopping' && (!spaceId || item.space_id === spaceId)), [items, spaceId]);
    const visible = useMemo(() => taskItems.filter(item => {
        if (query && !`${item.title} ${item.description || ''} ${item.context_tags.join(' ')}`.toLowerCase().includes(query.toLowerCase()))
            return false;
        if (filter === 'all')
            return item.status !== 'dismissed';
        return taskBucket(item) === filter;
    }).sort((a, b) => {
        const pa = a.priority === 'high' ? 0 : a.priority === 'normal' ? 1 : 2;
        const pb = b.priority === 'high' ? 0 : b.priority === 'normal' ? 1 : 2;
        if (pa !== pb)
            return pa - pb;
        return `${a.due_date || '9999'}${a.due_time || '99'}`.localeCompare(`${b.due_date || '9999'}${b.due_time || '99'}`);
    }), [taskItems, filter, query]);
    const open = taskItems.filter(i => i.status === 'open').length;
    const inbox = taskItems.filter(i => taskBucket(i) === 'inbox').length;
    const overdue = taskItems.filter(i => taskBucket(i) === 'overdue').length;
    return _jsxs("div", { className: "page organizer-page", children: [_jsx("header", { className: "page-header", children: _jsxs("div", { children: [_jsxs("span", { className: "eyebrow", children: ["TASKS", space ? ` · ${space.name.toUpperCase()}` : ''] }), _jsx("h1", { children: "Everything you need to do." }), _jsx("p", { children: space ? `Tasks and chores shared inside ${space.name}.` : 'One list underneath, useful views on top. Shopping now has its own dedicated home.' })] }) }), _jsxs("section", { className: "organizer-stats", children: [_jsxs("div", { children: [_jsx(ListChecks, {}), _jsxs("span", { children: [_jsx("strong", { children: open }), " open"] })] }), _jsxs("div", { children: [_jsx(Inbox, {}), _jsxs("span", { children: [_jsx("strong", { children: inbox }), " inbox"] })] }), _jsxs("div", { children: [_jsx(TimerReset, {}), _jsxs("span", { children: [_jsx("strong", { children: overdue }), " overdue"] })] }), _jsxs("div", { children: [_jsx(CheckCircle2, {}), _jsxs("span", { children: [_jsx("strong", { children: taskItems.filter(i => i.status === 'completed').length }), " done"] })] })] }), _jsxs("div", { className: "task-toolbar", children: [_jsx("div", { className: "smart-filter-row", children: filters.map(([id, label]) => _jsx("button", { className: filter === id ? 'active' : '', onClick: () => setFilter(id), children: label }, id)) }), _jsxs("label", { className: "inline-search", children: [_jsx(Search, { size: 17 }), _jsx("input", { value: query, onChange: e => setQuery(e.target.value), placeholder: "Filter tasks\u2026" })] })] }), _jsxs("section", { className: "task-list-panel", children: [_jsx("div", { className: "section-heading", children: _jsxs("div", { children: [_jsx("span", { className: "eyebrow", children: filters.find(x => x[0] === filter)?.[1] }), _jsxs("h2", { children: [visible.length, " ", visible.length === 1 ? 'item' : 'items'] })] }) }), _jsx("div", { className: "item-stack", children: visible.map(item => _jsx(ItemCard, { item: item }, item.id)) }), !visible.length && _jsxs("div", { className: "empty-state", children: [_jsx(CircleDashed, { size: 34 }), _jsx("strong", { children: "Clear here." }), _jsx("span", { children: "Anything matching this view will show up automatically." })] })] })] });
}
