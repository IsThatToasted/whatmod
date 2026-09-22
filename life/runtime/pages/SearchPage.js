import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { FolderKanban, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppData } from '../contexts/AppDataContext.js';
import { useOrganizer } from '../contexts/OrganizerContext.js';
import { ItemCard } from '../components/ItemCard.js';
export default function SearchPage() {
    const { items, notes, events, spaces, places, activity } = useAppData();
    const { projects } = useOrganizer();
    const navigate = useNavigate();
    const [q, setQ] = useState('');
    const term = q.trim().toLowerCase();
    const results = useMemo(() => ({
        items: term ? items.filter(i => `${i.title} ${i.description || ''} ${i.source_text || ''} ${i.place_name || ''}`.toLowerCase().includes(term)).slice(0, 20) : [],
        projects: term ? projects.filter(p => `${p.name} ${p.description || ''}`.toLowerCase().includes(term)).slice(0, 12) : [],
        notes: term ? notes.filter(n => `${n.title} ${n.body} ${n.source_text || ''}`.toLowerCase().includes(term)).slice(0, 10) : [],
        events: term ? events.filter(e => `${e.title} ${e.location || ''} ${e.notes || ''}`.toLowerCase().includes(term)).slice(0, 10) : [],
        spaces: term ? spaces.filter(s => s.name.toLowerCase().includes(term)) : [],
        places: term ? places.filter(p => `${p.name} ${p.address || ''} ${p.notes || ''}`.toLowerCase().includes(term)).slice(0, 10) : [],
        activity: term ? activity.filter(a => `${a.actor_name || ''} ${a.action} ${a.entity_title}`.toLowerCase().includes(term)).slice(0, 10) : [],
    }), [term, items, projects, notes, events, spaces, places, activity]);
    const count = Object.values(results).reduce((sum, value) => sum + value.length, 0);
    return _jsxs("div", { className: "page search-page", children: [_jsx("header", { className: "page-header compact", children: _jsxs("div", { children: [_jsx("span", { className: "eyebrow", children: "SEARCH" }), _jsx("h1", { children: "Find anything you saved." })] }) }), _jsxs("div", { className: "search-box", children: [_jsx(Search, {}), _jsx("input", { autoFocus: true, value: q, onChange: e => setQ(e.target.value), placeholder: "Dentist, paint color, groceries, project\u2026" })] }), !term ? _jsxs("div", { className: "large-empty", children: [_jsx(Search, {}), _jsx("h2", { children: "Search your life." }), _jsx("p", { children: "Tasks, projects, thoughts, appointments, spaces, places, shopping, and recent activity." })] }) : count === 0 ? _jsxs("div", { className: "large-empty", children: [_jsx("h2", { children: "No matches." }), _jsx("p", { children: "Try a shorter phrase." })] }) : _jsxs("div", { className: "search-results", children: [results.items.length > 0 && _jsxs("section", { children: [_jsx("h2", { children: "Items" }), results.items.map(item => _jsx(ItemCard, { item: item }, item.id))] }), results.projects.length > 0 && _jsxs("section", { children: [_jsx("h2", { children: "Projects" }), results.projects.map(project => _jsxs("button", { type: "button", className: "result-card result-card-button", onClick: () => navigate(`/projects/${project.id}`), children: [_jsx(FolderKanban, {}), _jsxs("span", { children: [_jsx("strong", { children: project.name }), _jsx("p", { children: project.description || `${project.status} project` })] })] }, project.id))] }), results.notes.length > 0 && _jsxs("section", { children: [_jsx("h2", { children: "Thoughts & notes" }), results.notes.map(note => _jsxs("article", { className: "result-card", children: [_jsx("strong", { children: note.title }), _jsx("p", { children: note.body })] }, note.id))] }), results.events.length > 0 && _jsxs("section", { children: [_jsx("h2", { children: "Appointments & events" }), results.events.map(event => _jsxs("article", { className: "result-card", children: [_jsx("strong", { children: event.title }), _jsxs("p", { children: [event.event_date, " \u00B7 ", event.start_time, event.location ? ` · ${event.location}` : ''] })] }, event.id))] }), results.places.length > 0 && _jsxs("section", { children: [_jsx("h2", { children: "Places" }), results.places.map(place => _jsxs("article", { className: "result-card", children: [_jsx("strong", { children: place.name }), _jsx("p", { children: place.address || place.category })] }, place.id))] }), results.spaces.length > 0 && _jsxs("section", { children: [_jsx("h2", { children: "Spaces" }), results.spaces.map(space => _jsx("article", { className: "result-card", children: _jsx("strong", { children: space.name }) }, space.id))] }), results.activity.length > 0 && _jsxs("section", { children: [_jsx("h2", { children: "History" }), results.activity.map(entry => _jsxs("article", { className: "result-card", children: [_jsx("strong", { children: entry.entity_title }), _jsxs("p", { children: [entry.actor_name || 'Someone', " ", entry.action, " this \u00B7 ", new Date(entry.created_at).toLocaleDateString()] })] }, entry.id))] })] })] });
}
