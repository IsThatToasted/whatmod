import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Calendar, FileText, FolderKanban, Image as ImageIcon, Link2, MapPin, Paperclip, Send, Sparkles, Users, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppData } from '../contexts/AppDataContext.js';
import { useOrganizer } from '../contexts/OrganizerContext.js';
import { isoToday } from '../lib/organizer.js';
import { analyzeSmartText, inspectFile } from '../lib/smartIntake.js';
function mappedKind(kind) {
    if (kind === 'appointment')
        return 'appointment';
    if (kind === 'thought')
        return 'note';
    if (kind === 'link')
        return 'link';
    if (kind === 'shopping')
        return 'shopping';
    if (kind === 'reminder')
        return 'reminder';
    return 'task';
}
export function CaptureSheet({ open, onClose }) {
    const { createItem, createNote, createEvent, createCapture, importCalendarEvents, spaces, places } = useAppData();
    const { projects, createProject, createReminder } = useOrganizer();
    const [text, setText] = useState('');
    const [kind, setKind] = useState(null);
    const [priority, setPriority] = useState('normal');
    const [spaceId, setSpaceId] = useState('');
    const [projectId, setProjectId] = useState('');
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [placeId, setPlaceId] = useState('');
    const [files, setFiles] = useState([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const fileRef = useRef(null);
    const lastInferredDate = useRef('');
    const lastInferredTime = useRef('');
    const analysis = useMemo(() => text.trim() ? analyzeSmartText(text) : null, [text]);
    const effectiveKind = kind || (analysis ? mappedKind(analysis.kind) : null);
    useEffect(() => {
        const inferredDate = analysis?.dueDate || '';
        const inferredTime = analysis?.dueTime || '';
        setDate(current => (!current || current === lastInferredDate.current) ? inferredDate : current);
        setTime(current => (!current || current === lastInferredTime.current) ? inferredTime : current);
        lastInferredDate.current = inferredDate;
        lastInferredTime.current = inferredTime;
    }, [analysis?.dueDate, analysis?.dueTime]);
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
        setFiles([]);
        setError('');
        lastInferredDate.current = '';
        lastInferredTime.current = '';
    }
    async function saveText() {
        if (!text.trim() || !analysis)
            return;
        const chosen = kind || mappedKind(analysis.kind);
        if (chosen === 'note') {
            await createNote(text, spaceId || null);
            return;
        }
        if (chosen === 'project') {
            await createProject({ name: analysis.title || text.trim(), description: text.trim() === analysis.title ? undefined : text.trim(), priority, space_id: spaceId || null });
            return;
        }
        if (chosen === 'link') {
            await createCapture({ kind: 'link', title: analysis.title || analysis.url || 'Saved link', raw_text: text, source_url: analysis.url, space_id: spaceId || null, parsed_kind: 'link', parsed_data: { url: analysis.url, tags: analysis.tags, confidence: analysis.confidence } });
            return;
        }
        if (chosen === 'appointment') {
            const eventDate = date || analysis.dueDate || isoToday();
            const startTime = time || analysis.dueTime || '09:00';
            const selectedPlace = places.find(p => p.id === placeId);
            const created = await createEvent({
                title: analysis.title,
                event_date: eventDate,
                start_time: startTime,
                end_time: analysis.endTime,
                location: selectedPlace?.name || analysis.location || null,
                notes: text.trim() === analysis.title ? null : text.trim(),
                attendees: [], recurrence_rule: null, project_id: projectId || null, space_id: spaceId || null,
                provider: 'internal-smart', external_id: null,
            });
            const when = new Date(`${eventDate}T${startTime}:00`);
            if (!Number.isNaN(when.getTime())) {
                when.setMinutes(when.getMinutes() - 30);
                if (when.getTime() > Date.now())
                    await createReminder({ title: created.title, body: created.location ? `At ${created.location}` : null, remind_at: when.toISOString(), event_id: created.id });
            }
            return;
        }
        const intent = { ...analysis.intent };
        if (chosen !== 'link' && chosen !== 'appointment' && chosen !== 'note' && chosen !== 'project')
            intent.type = chosen;
        intent.priority = priority;
        const selectedPlace = places.find(place => place.id === placeId);
        const item = await createItem(intent, text, {
            space_id: spaceId || null,
            project_id: projectId || null,
            due_date: date || analysis.dueDate || null,
            due_time: time || analysis.dueTime || null,
            place_id: placeId || null,
            place_name: selectedPlace?.name || analysis.location || null,
            is_inbox: !(date || analysis.dueDate || projectId || placeId || spaceId),
            shopping: intent.type === 'shopping' ? { preferred_store: analysis.location || intent.context || null } : undefined,
        });
        if ((chosen === 'reminder' || intent.type === 'reminder') && (date || analysis.dueDate)) {
            const whenDate = date || analysis.dueDate || isoToday();
            const whenTime = time || analysis.dueTime || '09:00';
            const when = new Date(`${whenDate}T${whenTime}:00`);
            if (!Number.isNaN(when.getTime()))
                await createReminder({ title: item.title, body: item.description || null, remind_at: when.toISOString(), item_id: item.id });
        }
    }
    async function saveFiles() {
        for (const file of files) {
            if (file.size > 15 * 1024 * 1024)
                throw new Error(`${file.name} is over the 15 MB capture limit.`);
            const inspected = await inspectFile(file);
            if (inspected.kind === 'calendar' && inspected.events.length) {
                const result = await importCalendarEvents(inspected.events, file.name);
                await createCapture({ kind: 'calendar_import', title: file.name, raw_text: null, parsed_kind: 'calendar', parsed_data: { imported: result.imported, skipped: result.skipped, discovered: inspected.events.length }, file, status: 'processed', space_id: spaceId || null });
                continue;
            }
            const fileAnalysis = inspected.text?.trim() ? analyzeSmartText(inspected.text.slice(0, 12000)) : null;
            await createCapture({
                kind: inspected.kind === 'image' ? 'image' : 'file',
                title: file.name,
                raw_text: inspected.text?.slice(0, 200000) || null,
                space_id: spaceId || null,
                parsed_kind: fileAnalysis?.kind || inspected.kind,
                parsed_data: { summary: inspected.summary, smart: fileAnalysis ? { kind: fileAnalysis.kind, title: fileAnalysis.title, date: fileAnalysis.dueDate, time: fileAnalysis.dueTime, location: fileAnalysis.location, url: fileAnalysis.url, confidence: fileAnalysis.confidence } : null },
                file,
            });
        }
    }
    async function save() {
        if (!text.trim() && !files.length)
            return;
        setSaving(true);
        setError('');
        try {
            if (text.trim())
                await saveText();
            if (files.length)
                await saveFiles();
            reset();
            onClose();
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Could not save that capture.');
        }
        finally {
            setSaving(false);
        }
    }
    return _jsx("div", { className: "capture-backdrop", onMouseDown: e => { if (e.target === e.currentTarget)
            onClose(); }, children: _jsxs("section", { className: "capture-sheet", "aria-modal": "true", role: "dialog", "aria-label": "Quick capture", children: [_jsxs("div", { className: "capture-head", children: [_jsxs("div", { children: [_jsx("span", { className: "eyebrow", children: "SMART INTAKE" }), _jsx("h2", { children: "Drop anything here." })] }), _jsx("button", { className: "icon-button", onClick: onClose, "aria-label": "Close", children: _jsx(X, {}) })] }), _jsx("textarea", { autoFocus: true, value: text, onChange: e => setText(e.target.value), onKeyDown: e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter')
                        void save(); }, placeholder: "Dentist Thursday at 2:30 PM at Aspen Dental, buy milk, save a link, or attach a file\u2026", rows: 4 }), analysis && _jsxs("div", { className: "parse-preview smart-preview", children: [_jsx(Sparkles, { size: 16 }), _jsxs("span", { children: [_jsx("strong", { children: effectiveKind }), " \u00B7 ", Math.round(analysis.confidence * 100), "% understood", analysis.dueDate ? ` · ${analysis.dueDate}` : '', analysis.dueTime ? ` ${analysis.dueTime}` : '', analysis.location ? ` · ${analysis.location}` : ''] })] }), _jsxs("div", { className: "attachment-row", children: [_jsxs("button", { className: "attachment-button", type: "button", onClick: () => fileRef.current?.click(), children: [_jsx(Paperclip, { size: 17 }), "Add files or images"] }), _jsx("input", { ref: fileRef, className: "sr-only", type: "file", multiple: true, accept: "image/*,.pdf,.txt,.md,.csv,.json,.ics,text/calendar,text/csv", onChange: e => setFiles(Array.from(e.target.files || [])) }), _jsx("span", { children: "ICS and common Outlook/calendar CSV exports import directly." })] }), !!files.length && _jsx("div", { className: "attachment-list", children: files.map((file, index) => _jsxs("div", { children: [file.type.startsWith('image/') ? _jsx(ImageIcon, { size: 15 }) : file.name.toLowerCase().endsWith('.ics') ? _jsx(Calendar, { size: 15 }) : _jsx(FileText, { size: 15 }), _jsx("span", { children: file.name }), _jsx("button", { onClick: () => setFiles(current => current.filter((_, i) => i !== index)), "aria-label": `Remove ${file.name}`, children: _jsx(X, { size: 13 }) })] }, `${file.name}-${index}`)) }), _jsxs("div", { className: "capture-options", children: [_jsxs("div", { className: "chip-row", children: [['task', 'reminder', 'shopping', 'call', 'errand', 'chore', 'idea'].map(type => _jsx("button", { className: `chip ${kind === type ? 'active' : ''}`, onClick: () => setKind(kind === type ? null : type), children: type }, type)), _jsx("button", { className: `chip ${kind === 'appointment' ? 'active' : ''}`, onClick: () => setKind(kind === 'appointment' ? null : 'appointment'), children: "appointment" }), _jsx("button", { className: `chip ${kind === 'note' ? 'active' : ''}`, onClick: () => setKind(kind === 'note' ? null : 'note'), children: "thought" }), _jsxs("button", { className: `chip ${kind === 'link' ? 'active' : ''}`, onClick: () => setKind(kind === 'link' ? null : 'link'), children: [_jsx(Link2, { size: 13 }), "link"] }), _jsx("button", { className: `chip ${kind === 'project' ? 'active' : ''}`, onClick: () => setKind(kind === 'project' ? null : 'project'), children: "project" })] }), effectiveKind !== 'project' && _jsxs("div", { className: "capture-grid", children: [_jsxs("label", { children: [_jsx(Calendar, { size: 16 }), "Date", _jsx("input", { type: "date", value: date, onChange: e => setDate(e.target.value), placeholder: analysis?.dueDate || '', disabled: effectiveKind === 'note' || effectiveKind === 'link' })] }), _jsxs("label", { children: [_jsx(Calendar, { size: 16 }), "Time", _jsx("input", { type: "time", value: time, onChange: e => setTime(e.target.value), disabled: effectiveKind === 'note' || effectiveKind === 'link' })] }), _jsxs("label", { children: [_jsx(Users, { size: 16 }), "Space", _jsxs("select", { value: spaceId, onChange: e => setSpaceId(e.target.value), children: [_jsx("option", { value: "", children: "Personal" }), spaces.filter(space => !space.is_personal && space.name !== 'Personal').map(space => _jsx("option", { value: space.id, children: space.name }, space.id))] })] }), _jsxs("label", { children: [_jsx(FolderKanban, { size: 16 }), "Project", _jsxs("select", { value: projectId, onChange: e => setProjectId(e.target.value), disabled: effectiveKind === 'note' || effectiveKind === 'link', children: [_jsx("option", { value: "", children: "None" }), projects.filter(project => project.status === 'active').map(project => _jsx("option", { value: project.id, children: project.name }, project.id))] })] }), _jsxs("label", { children: [_jsx(MapPin, { size: 16 }), "Place", _jsxs("select", { value: placeId, onChange: e => setPlaceId(e.target.value), disabled: effectiveKind === 'note' || effectiveKind === 'link', children: [_jsx("option", { value: "", children: analysis?.location || 'Any place' }), places.map(place => _jsx("option", { value: place.id, children: place.name }, place.id))] })] })] }), effectiveKind === 'project' && _jsx("div", { className: "capture-grid single", children: _jsxs("label", { children: [_jsx(Users, { size: 16 }), "Space", _jsxs("select", { value: spaceId, onChange: e => setSpaceId(e.target.value), children: [_jsx("option", { value: "", children: "Personal" }), spaces.filter(space => !space.is_personal && space.name !== 'Personal').map(space => _jsx("option", { value: space.id, children: space.name }, space.id))] })] }) }), effectiveKind !== 'note' && effectiveKind !== 'appointment' && effectiveKind !== 'link' && _jsxs("label", { className: "priority-select", children: ["Priority", _jsxs("select", { value: priority, onChange: e => setPriority(e.target.value), children: [_jsx("option", { value: "low", children: "Low" }), _jsx("option", { value: "normal", children: "Normal" }), _jsx("option", { value: "high", children: "High" })] })] })] }), error && _jsx("div", { className: "form-message capture-error", children: error }), _jsx("button", { className: "primary-button capture-submit", disabled: (!text.trim() && !files.length) || saving, onClick: save, children: saving ? 'Organizing…' : _jsxs(_Fragment, { children: ["Capture ", _jsx(Send, { size: 17 })] }) }), _jsx("p", { className: "capture-footnote", children: "Text is categorized locally first. Files, images and links are preserved in your private Supabase capture inbox so richer parsing can be added without changing how you capture today." })] }) });
}
