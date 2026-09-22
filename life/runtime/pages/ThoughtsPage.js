import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { ArrowRight, Lightbulb, Plus, Search } from 'lucide-react';
import { useAppData } from '../contexts/AppDataContext.js';
import { useOrganizer } from '../contexts/OrganizerContext.js';
export default function ThoughtsPage() {
    const { notes, createNote, createItem } = useAppData();
    const { projects } = useOrganizer();
    const [text, setText] = useState(''), [query, setQuery] = useState('');
    const visible = useMemo(() => notes.filter(n => !query || `${n.title} ${n.body} ${(n.tags || []).join(' ')}`.toLowerCase().includes(query.toLowerCase())), [notes, query]);
    async function add() { if (!text.trim())
        return; await createNote(text); setText(''); }
    return _jsxs("div", { className: "page organizer-page", children: [_jsx("header", { className: "page-header", children: _jsxs("div", { children: [_jsx("span", { className: "eyebrow", children: "THOUGHTS" }), _jsx("h1", { children: "A place for things that are not tasks yet." }), _jsx("p", { children: "Ideas, references, decisions, snippets and thoughts stay searchable without pretending everything needs a deadline." })] }) }), _jsxs("section", { className: "thought-capture panel-card", children: [_jsx("textarea", { value: text, onChange: e => setText(e.target.value), placeholder: "Capture a thought before it disappears\u2026", rows: 3 }), _jsxs("button", { className: "primary-button", onClick: add, disabled: !text.trim(), children: [_jsx(Plus, { size: 17 }), "Remember this"] })] }), _jsxs("label", { className: "inline-search thoughts-search", children: [_jsx(Search, { size: 17 }), _jsx("input", { value: query, onChange: e => setQuery(e.target.value), placeholder: "Search your thoughts\u2026" })] }), _jsx("div", { className: "notes-grid", children: visible.map(note => _jsxs("article", { className: "note-card", children: [_jsx("span", { className: "note-date", children: new Date(note.created_at).toLocaleDateString() }), _jsx("strong", { children: note.title }), _jsx("p", { children: note.body }), _jsxs("div", { className: "note-actions", children: [_jsxs("button", { onClick: () => createItem({ type: 'task', title: note.title, priority: 'normal', tags: ['from-note'], confidence: 1 }, note.body, { description: note.body, is_inbox: true }), children: ["Task ", _jsx(ArrowRight, { size: 13 })] }), projects[0] && _jsxs("span", { children: ["Can connect to ", projects[0].name, " from the project screen."] })] })] }, note.id)) }), !visible.length && _jsxs("div", { className: "empty-state large", children: [_jsx(Lightbulb, {}), _jsx("strong", { children: "Nothing here yet." }), _jsx("span", { children: "Capture the unfinished thought, not just the polished one." })] })] });
}
