import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { ArrowLeft, CalendarDays, CheckCircle2, Plus, Target } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppData } from '../contexts/AppDataContext.js';
import { useOrganizer } from '../contexts/OrganizerContext.js';
import { ItemCard } from '../components/ItemCard.js';
import { lifeIntentParser } from '../lib/parser.js';
import { projectProgress } from '../lib/organizer.js';
export default function ProjectPage() {
    const { id } = useParams();
    const nav = useNavigate();
    const { items, events, notes, createItem } = useAppData();
    const { projects, updateProject } = useOrganizer();
    const [quick, setQuick] = useState('');
    const project = projects.find(p => p.id === id);
    const related = useMemo(() => items.filter(i => i.project_id === id && i.status !== 'dismissed'), [items, id]);
    const progress = project ? projectProgress(project, items) : { percent: 0, open: 0, total: 0, completed: 0 };
    if (!project)
        return _jsxs("div", { className: "page", children: [_jsxs("button", { className: "text-button", onClick: () => nav('/projects'), children: [_jsx(ArrowLeft, {}), "Projects"] }), _jsx("div", { className: "empty-state large", children: _jsx("strong", { children: "Project not found." }) })] });
    async function add() { if (!quick.trim())
        return; const parsed = lifeIntentParser.parse(quick); await createItem(parsed, quick, { project_id: project.id, is_inbox: false }); setQuick(''); }
    return _jsxs("div", { className: "page organizer-page", children: [_jsxs("button", { className: "text-button back-link", onClick: () => nav('/projects'), children: [_jsx(ArrowLeft, { size: 16 }), "All projects"] }), _jsxs("header", { className: "project-hero", children: [_jsxs("div", { children: [_jsx("span", { className: "eyebrow", children: "PROJECT" }), _jsx("h1", { children: project.name }), _jsx("p", { children: project.description || 'Add a clear outcome so Future You knows what finished means.' })] }), _jsxs("div", { className: "project-health", children: [_jsxs("strong", { children: [progress.percent, "%"] }), _jsxs("span", { children: [progress.completed, " of ", progress.total, " actions complete"] })] })] }), _jsx("div", { className: "progress-track hero-progress", children: _jsx("span", { style: { width: `${progress.percent}%` } }) }), _jsxs("div", { className: "project-detail-grid", children: [_jsxs("section", { className: "panel-card", children: [_jsx("div", { className: "section-heading", children: _jsxs("div", { children: [_jsx("span", { className: "eyebrow", children: "NEXT ACTIONS" }), _jsxs("h2", { children: [progress.open, " open"] })] }) }), _jsxs("div", { className: "quick-add-line", children: [_jsx("input", { value: quick, onChange: e => setQuick(e.target.value), onKeyDown: e => { if (e.key === 'Enter')
                                            void add(); }, placeholder: "Add the next thing to do\u2026" }), _jsx("button", { onClick: add, children: _jsx(Plus, {}) })] }), _jsx("div", { className: "item-stack", children: related.filter(i => i.status === 'open').map(item => _jsx(ItemCard, { item: item }, item.id)) }), !progress.open && _jsxs("div", { className: "empty-state", children: [_jsx(CheckCircle2, {}), _jsx("strong", { children: "No open actions." }), _jsx("span", { children: "Add a next step or mark the project complete." })] })] }), _jsxs("aside", { className: "project-side", children: [_jsxs("section", { className: "panel-card", children: [_jsx("span", { className: "eyebrow", children: "PROJECT DETAILS" }), _jsxs("label", { className: "detail-field", children: [_jsx(Target, { size: 16 }), "Status", _jsxs("select", { value: project.status, onChange: e => updateProject(project.id, { status: e.target.value }), children: [_jsx("option", { value: "active", children: "Active" }), _jsx("option", { value: "paused", children: "Paused" }), _jsx("option", { value: "completed", children: "Completed" })] })] }), _jsxs("label", { className: "detail-field", children: [_jsx(CalendarDays, { size: 16 }), "Target", _jsx("input", { type: "date", value: project.target_date || '', onChange: e => updateProject(project.id, { target_date: e.target.value || null }) })] })] }), _jsxs("section", { className: "panel-card", children: [_jsx("span", { className: "eyebrow", children: "CONNECTED" }), _jsxs("div", { className: "connected-counts", children: [_jsxs("div", { children: [_jsx("strong", { children: events.filter(e => e.project_id === id).length }), _jsx("span", { children: "appointments" })] }), _jsxs("div", { children: [_jsx("strong", { children: notes.filter(n => n.project_id === id).length }), _jsx("span", { children: "notes" })] }), _jsxs("div", { children: [_jsx("strong", { children: related.filter(i => i.status === 'completed').length }), _jsx("span", { children: "completed" })] })] })] })] })] })] });
}
