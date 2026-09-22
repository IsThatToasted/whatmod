import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Calendar, FolderKanban, MapPin, Send, Sparkles, StickyNote, Users, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { lifeIntentParser } from '../lib/parser.js';
import { useAppData } from '../contexts/AppDataContext.js';
import { useOrganizer } from '../contexts/OrganizerContext.js';
import { isoToday } from '../lib/organizer.js';
export function CaptureSheet({ open, onClose }) {
    const { createItem, createNote, createEvent, spaces, places } = useAppData();
    const { projects, createProject, createReminder } = useOrganizer();
    const [text, setText] = useState('');
    const [kind, setKind] = useState(null);
    const [priority, setPriority] = useState('normal');
    const [spaceId, setSpaceId] = useState('');
    const [projectId, setProjectId] = useState('');
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [placeId, setPlaceId] = useState('');
    const [saving, setSaving] = useState(false);
    const parsed = useMemo(() => text.trim() ? lifeIntentParser.parse(text) : null, [text]);
    if (!open)
        return null;
    function reset() {
        setText('');
        setKind(null);
        setPriority('normal');
        setSpaceId('');
        setProjectId('');
        setDate('');
        setTime('');
        setPlaceId('');
    }
    async function save() {
        if (!text.trim())
            return;
        setSaving(true);
        try {
            if (kind === 'note') {
                await createNote(text, spaceId || null);
            }
            else if (kind === 'project') {
                await createProject({ name: text.trim(), priority, space_id: spaceId || null });
            }
            else if (kind === 'appointment') {
                const intent = lifeIntentParser.parse(text);
                await createEvent({ title: intent.title, event_date: date || intent.dueDate || isoToday(), start_time: time || intent.dueTime || '09:00', end_time: null, location: places.find(p => p.id === placeId)?.name || intent.context || null, notes: null, attendees: [], recurrence_rule: null, project_id: projectId || null, space_id: spaceId || null });
            }
            else {
                const intent = lifeIntentParser.parse(text);
                if (kind)
                    intent.type = kind;
                intent.priority = priority;
                const selectedPlace = places.find(place => place.id === placeId);
                const item = await createItem(intent, text, {
                    space_id: spaceId || null,
                    project_id: projectId || null,
                    due_date: date || intent.dueDate || null,
                    due_time: time || intent.dueTime || null,
                    place_id: placeId || null,
                    place_name: selectedPlace?.name || intent.context || null,
                    is_inbox: !(date || intent.dueDate || projectId || placeId || spaceId),
                });
                if ((kind === 'reminder' || intent.type === 'reminder') && (date || intent.dueDate)) {
                    const whenDate = date || intent.dueDate || isoToday();
                    const whenTime = time || intent.dueTime || '09:00';
                    const when = new Date(`${whenDate}T${whenTime}:00`);
                    if (!Number.isNaN(when.getTime()))
                        await createReminder({ title: item.title, body: item.description || null, remind_at: when.toISOString(), item_id: item.id });
                }
            }
            reset();
            onClose();
        }
        finally {
            setSaving(false);
        }
    }
    return _jsx("div", { className: "capture-backdrop", onMouseDown: e => { if (e.target === e.currentTarget)
            onClose(); }, children: _jsxs("section", { className: "capture-sheet", "aria-modal": "true", role: "dialog", "aria-label": "Quick capture", children: [_jsxs("div", { className: "capture-head", children: [_jsxs("div", { children: [_jsx("span", { className: "eyebrow", children: "UNIVERSAL CAPTURE" }), _jsx("h2", { children: "What\u2019s on your mind?" })] }), _jsx("button", { className: "icon-button", onClick: onClose, "aria-label": "Close", children: _jsx(X, {}) })] }), _jsx("textarea", { autoFocus: true, value: text, onChange: e => setText(e.target.value), onKeyDown: e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter')
                        void save(); }, placeholder: "Anything: call dentist Friday, project idea, appointment, buy milk\u2026", rows: 4 }), parsed && kind !== 'note' && kind !== 'project' && _jsxs("div", { className: "parse-preview", children: [_jsx(Sparkles, { size: 16 }), _jsxs("span", { children: [kind || parsed.type, " \u00B7 ", Math.round(parsed.confidence * 100), "% understood", parsed.dueDate ? ' · date detected' : '', parsed.context ? ` · ${parsed.context}` : ''] })] }), kind === 'note' && _jsxs("div", { className: "parse-preview", children: [_jsx(StickyNote, { size: 16 }), _jsx("span", { children: "Save as a thought. No deadline required." })] }), kind === 'project' && _jsxs("div", { className: "parse-preview", children: [_jsx(FolderKanban, { size: 16 }), _jsx("span", { children: "Create an outcome you can connect tasks, notes and appointments to." })] }), _jsxs("div", { className: "capture-options", children: [_jsxs("div", { className: "chip-row", children: [['task', 'reminder', 'shopping', 'call', 'errand', 'chore', 'idea'].map(type => _jsx("button", { className: `chip ${kind === type ? 'active' : ''}`, onClick: () => setKind(kind === type ? null : type), children: type }, type)), _jsx("button", { className: `chip ${kind === 'appointment' ? 'active' : ''}`, onClick: () => setKind(kind === 'appointment' ? null : 'appointment'), children: "appointment" }), _jsx("button", { className: `chip ${kind === 'note' ? 'active' : ''}`, onClick: () => setKind(kind === 'note' ? null : 'note'), children: "thought" }), _jsx("button", { className: `chip ${kind === 'project' ? 'active' : ''}`, onClick: () => setKind(kind === 'project' ? null : 'project'), children: "project" })] }), kind !== 'project' && _jsxs("div", { className: "capture-grid", children: [_jsxs("label", { children: [_jsx(Calendar, { size: 16 }), "Date", _jsx("input", { type: "date", value: date, onChange: e => setDate(e.target.value), disabled: kind === 'note' })] }), _jsxs("label", { children: [_jsx(Calendar, { size: 16 }), "Time", _jsx("input", { type: "time", value: time, onChange: e => setTime(e.target.value), disabled: kind === 'note' })] }), _jsxs("label", { children: [_jsx(Users, { size: 16 }), "Space", _jsxs("select", { value: spaceId, onChange: e => setSpaceId(e.target.value), children: [_jsx("option", { value: "", children: "Personal" }), spaces.filter(space => !space.is_personal && space.name !== 'Personal').map(space => _jsx("option", { value: space.id, children: space.name }, space.id))] })] }), _jsxs("label", { children: [_jsx(FolderKanban, { size: 16 }), "Project", _jsxs("select", { value: projectId, onChange: e => setProjectId(e.target.value), disabled: kind === 'note', children: [_jsx("option", { value: "", children: "None" }), projects.filter(project => project.status === 'active').map(project => _jsx("option", { value: project.id, children: project.name }, project.id))] })] }), _jsxs("label", { children: [_jsx(MapPin, { size: 16 }), "Place", _jsxs("select", { value: placeId, onChange: e => setPlaceId(e.target.value), disabled: kind === 'note', children: [_jsx("option", { value: "", children: "Any place" }), places.map(place => _jsx("option", { value: place.id, children: place.name }, place.id))] })] })] }), kind === 'project' && _jsx("div", { className: "capture-grid single", children: _jsxs("label", { children: [_jsx(Users, { size: 16 }), "Space", _jsxs("select", { value: spaceId, onChange: e => setSpaceId(e.target.value), children: [_jsx("option", { value: "", children: "Personal" }), spaces.filter(space => !space.is_personal && space.name !== 'Personal').map(space => _jsx("option", { value: space.id, children: space.name }, space.id))] })] }) }), kind !== 'note' && kind !== 'appointment' && _jsxs("label", { className: "priority-select", children: ["Priority", _jsxs("select", { value: priority, onChange: e => setPriority(e.target.value), children: [_jsx("option", { value: "low", children: "Low" }), _jsx("option", { value: "normal", children: "Normal" }), _jsx("option", { value: "high", children: "High" })] })] })] }), _jsx("button", { className: "primary-button capture-submit", disabled: !text.trim() || saving, onClick: save, children: saving ? 'Saving…' : _jsxs(_Fragment, { children: ["Capture ", _jsx(Send, { size: 17 })] }) })] }) });
}
