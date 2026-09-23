import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Calendar, Camera, ContactRound, FileText, FolderKanban, Image as ImageIcon, Link2, MapPin, Paperclip, Send, Sparkles, Users, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppData } from '../contexts/AppDataContext.js';
import { useOrganizer } from '../contexts/OrganizerContext.js';
import { isoToday } from '../lib/organizer.js';
import { analyzeSmartText, inspectFile } from '../lib/smartIntake.js';
import { parseVCardContacts, resolveContactFromText } from '../lib/contacts.js';
function mappedKind(kind) {
    if (kind === 'appointment')
        return 'appointment';
    if (kind === 'thought')
        return 'note';
    if (kind === 'link')
        return 'link';
    if (['shopping', 'reminder', 'call', 'errand', 'chore', 'idea', 'task'].includes(kind))
        return kind;
    return 'task';
}
function contactDraftFromText(text) {
    const email = text.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i)?.[0] || null;
    const phone = text.match(/(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/)?.[0] || null;
    let name = text.replace(email || '', '').replace(phone || '', '').replace(/^\s*(?:add|save|new)?\s*contact\s+(?:for\s+)?/i, '').replace(/\b(?:phone|mobile|cell|email|is)\b.*$/i, '').trim();
    if (!name || name.length > 100)
        name = 'New contact';
    const parts = name.split(/\s+/);
    return { display_name: name, first_name: parts[0] || null, last_name: parts.length > 1 ? parts.slice(1).join(' ') : null, phone_mobile: phone, email_personal: email };
}
async function prepareImageForUpload(file) {
    if (!file.type.startsWith('image/') || file.size < 1_200_000)
        return file;
    try {
        const bitmap = await createImageBitmap(file);
        const max = 1800;
        const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
        const width = Math.max(1, Math.round(bitmap.width * scale)), height = Math.max(1, Math.round(bitmap.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            bitmap.close();
            return file;
        }
        ctx.drawImage(bitmap, 0, 0, width, height);
        bitmap.close();
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .84));
        if (!blob || blob.size >= file.size)
            return file;
        const base = file.name.replace(/\.[^.]+$/, '') || 'photo';
        return new File([blob], `${base}.jpg`, { type: 'image/jpeg', lastModified: file.lastModified });
    }
    catch {
        return file;
    }
}
export function CaptureSheet({ open, onClose }) {
    const { createItem, createNote, createEvent, createCapture, updateCapture, analyzeCapture, importCalendarEvents, createContact, contacts, spaces, places } = useAppData();
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
    const [saveStage, setSaveStage] = useState('');
    const [error, setError] = useState('');
    const fileRef = useRef(null);
    const cameraRef = useRef(null);
    const lastInferredDate = useRef('');
    const lastInferredTime = useRef('');
    const analysis = useMemo(() => text.trim() ? analyzeSmartText(text) : null, [text]);
    const contactMatch = useMemo(() => text.trim() ? resolveContactFromText(text, contacts) : null, [text, contacts]);
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
        setSaveStage('');
        lastInferredDate.current = '';
        lastInferredTime.current = '';
    }
    async function saveText() {
        if (!text.trim() || !analysis)
            return;
        const chosen = kind || mappedKind(analysis.kind);
        // Preserve the original first. If any structuring step fails, the memory remains in Inbox.
        const memory = await createCapture({
            kind: chosen === 'note' ? 'thought' : chosen === 'link' ? 'link' : 'text',
            title: analysis.title || text.trim().slice(0, 120), raw_text: text.trim(), source_url: analysis.url || null,
            space_id: spaceId || null, parsed_kind: chosen,
            parsed_data: { local: { kind: analysis.kind, title: analysis.title, date: analysis.dueDate, time: analysis.dueTime, location: analysis.location, url: analysis.url, confidence: analysis.confidence } },
            status: 'inbox', ai_status: 'not_requested',
        });
        if (chosen === 'note') {
            await createNote(text, spaceId || null);
            await updateCapture(memory.id, { status: 'processed', parsed_kind: 'thought' });
            return;
        }
        if (chosen === 'project') {
            const project = await createProject({ name: analysis.title || text.trim(), description: text.trim() === analysis.title ? undefined : text.trim(), priority, space_id: spaceId || null });
            await updateCapture(memory.id, { status: 'processed', parsed_kind: 'project', parsed_data: { ...(memory.parsed_data || {}), project_id: project.id } });
            return;
        }
        if (chosen === 'contact') {
            const contact = await createContact(contactDraftFromText(text));
            await updateCapture(memory.id, { status: 'processed', parsed_kind: 'contact', contact_id: contact.id });
            return;
        }
        if (chosen === 'link') {
            await updateCapture(memory.id, { status: 'processed', source_url: analysis.url || memory.source_url || null, parsed_kind: 'link' });
            return;
        }
        if (chosen === 'appointment') {
            const eventDate = date || analysis.dueDate || isoToday();
            const startTime = time || analysis.dueTime || '09:00';
            const selectedPlace = places.find(p => p.id === placeId);
            const created = await createEvent({
                title: analysis.title, event_date: eventDate, start_time: startTime, end_time: analysis.endTime,
                location: selectedPlace?.name || analysis.location || null,
                notes: text.trim() === analysis.title ? null : text.trim(), attendees: [], recurrence_rule: null,
                project_id: projectId || null, space_id: spaceId || null, contact_id: contactMatch?.id || null,
                provider: 'internal-smart', external_id: null,
            });
            await updateCapture(memory.id, { status: 'processed', created_event_id: created.id, contact_id: contactMatch?.id || null, parsed_kind: 'appointment' });
            const when = new Date(`${eventDate}T${startTime}:00`);
            if (!Number.isNaN(when.getTime())) {
                when.setMinutes(when.getMinutes() - 30);
                if (when.getTime() > Date.now())
                    await createReminder({ title: created.title, body: created.location ? `At ${created.location}` : null, remind_at: when.toISOString(), event_id: created.id });
            }
            return;
        }
        const intent = { ...analysis.intent, type: chosen, priority };
        const selectedPlace = places.find(place => place.id === placeId);
        const dueDate = date || analysis.dueDate || null;
        const dueTime = time || analysis.dueTime || null;
        const item = await createItem(intent, text, {
            space_id: spaceId || null, project_id: projectId || null, due_date: dueDate, due_time: dueTime,
            place_id: placeId || null, place_name: selectedPlace?.name || analysis.location || null,
            contact_id: contactMatch?.id || null,
            is_inbox: !(dueDate || projectId || placeId || spaceId),
            shopping: intent.type === 'shopping' ? { preferred_store: analysis.location || intent.context || null, source_url: analysis.url || null } : undefined,
        });
        await updateCapture(memory.id, { status: 'processed', created_item_id: item.id, contact_id: contactMatch?.id || null, parsed_kind: intent.type });
        if ((chosen === 'reminder' || intent.type === 'reminder') && dueDate) {
            const when = new Date(`${dueDate}T${dueTime || '09:00'}:00`);
            if (!Number.isNaN(when.getTime()))
                await createReminder({ title: item.title, body: item.description || null, remind_at: when.toISOString(), item_id: item.id });
        }
    }
    async function applyAI(captureId, smart) {
        const matched = smart.person ? resolveContactFromText(smart.person, contacts) : null;
        // Auto-structure only when Smart Intake is confident. Ambiguous memories stay in Inbox for review.
        if (smart.suggested_action === 'keep_memory' && smart.confidence >= 0.72) {
            await updateCapture(captureId, { status: 'processed', parsed_kind: smart.kind });
            return;
        }
        if (smart.confidence < 0.82)
            return;
        if (smart.suggested_action === 'create_contact' && smart.contact?.display_name) {
            const existing = resolveContactFromText(String(smart.contact.display_name), contacts);
            const contact = existing || await createContact({ ...smart.contact, display_name: String(smart.contact.display_name), notes: smart.contact.notes || smart.summary, tags: [...(smart.contact.tags || []), 'from-smart-intake'] });
            await updateCapture(captureId, { status: 'processed', contact_id: contact.id, parsed_kind: 'contact' });
            return;
        }
        if (smart.suggested_action === 'create_event' && smart.due_date) {
            const created = await createEvent({ title: smart.title, event_date: smart.due_date, start_time: smart.due_time || '09:00', end_time: null, location: smart.location || null, notes: smart.summary || null, attendees: [], recurrence_rule: null, space_id: spaceId || null, project_id: null, contact_id: matched?.id || null, provider: 'smart-vision', external_id: null });
            await updateCapture(captureId, { status: 'processed', created_event_id: created.id, contact_id: matched?.id || null });
            return;
        }
        if (smart.suggested_action === 'create_item') {
            const type = smart.kind === 'shopping' ? 'shopping' : smart.kind === 'call' ? 'call' : smart.kind === 'reminder' ? 'reminder' : smart.kind === 'idea' ? 'idea' : 'task';
            const created = await createItem({ type, title: smart.title, priority: 'normal', tags: ['from-smart-intake', ...(smart.tags || [])], confidence: smart.confidence, dueDate: smart.due_date || null, dueTime: smart.due_time || null }, smart.summary || smart.title, { description: smart.summary || null, space_id: spaceId || null, due_date: smart.due_date || null, due_time: smart.due_time || null, contact_id: matched?.id || null, is_inbox: !smart.due_date, shopping: type === 'shopping' ? { preferred_store: smart.shopping?.store || null, estimated_price: smart.shopping?.price ?? null, currency: smart.shopping?.currency || null } : undefined });
            await updateCapture(captureId, { status: 'processed', created_item_id: created.id, contact_id: matched?.id || null });
            return;
        }
    }
    async function saveFiles() {
        for (const original of files) {
            if (original.size > 15 * 1024 * 1024)
                throw new Error(`${original.name} is over the 15 MB capture limit.`);
            if (/\.vcf$/i.test(original.name) || /vcard/i.test(original.type)) {
                setSaveStage('Importing contacts…');
                const parsed = parseVCardContacts(await original.text());
                for (const contact of parsed)
                    await createContact(contact);
                await createCapture({ kind: 'contact_import', title: original.name, raw_text: null, parsed_kind: 'contacts', parsed_data: { imported: parsed.length }, file: original, status: 'processed', space_id: null });
                continue;
            }
            const file = await prepareImageForUpload(original);
            const inspected = await inspectFile(file);
            if (inspected.kind === 'calendar' && inspected.events.length) {
                setSaveStage('Importing calendar…');
                const result = await importCalendarEvents(inspected.events, file.name);
                await createCapture({ kind: 'calendar_import', title: file.name, raw_text: null, parsed_kind: 'calendar', parsed_data: { imported: result.imported, skipped: result.skipped, discovered: inspected.events.length }, file, status: 'processed', space_id: spaceId || null });
                continue;
            }
            const fileAnalysis = inspected.text?.trim() ? analyzeSmartText(inspected.text.slice(0, 12000)) : null;
            setSaveStage(inspected.kind === 'image' ? 'Saving photo…' : 'Saving file…');
            const capture = await createCapture({
                kind: inspected.kind === 'image' ? 'image' : 'file', title: file.name, raw_text: inspected.text?.slice(0, 200000) || null,
                space_id: spaceId || null, parsed_kind: fileAnalysis?.kind || inspected.kind,
                parsed_data: { summary: inspected.summary, smart: fileAnalysis ? { kind: fileAnalysis.kind, title: fileAnalysis.title, date: fileAnalysis.dueDate, time: fileAnalysis.dueTime, location: fileAnalysis.location, url: fileAnalysis.url, confidence: fileAnalysis.confidence } : null },
                file, ai_status: inspected.kind === 'image' ? 'queued' : 'not_requested',
            });
            if (inspected.kind === 'image') {
                setSaveStage('Looking at the photo…');
                try {
                    const smart = await analyzeCapture(capture.id);
                    if (smart)
                        await applyAI(capture.id, smart);
                }
                catch { /* Never lose the raw capture because AI is unavailable. */ }
            }
        }
    }
    async function save() {
        if (!text.trim() && !files.length)
            return;
        setSaving(true);
        setError('');
        setSaveStage('Organizing…');
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
            setSaveStage('');
        }
    }
    return _jsx("div", { className: "capture-backdrop", onMouseDown: e => { if (e.target === e.currentTarget)
            onClose(); }, children: _jsxs("section", { className: "capture-sheet", "aria-modal": "true", role: "dialog", "aria-label": "Quick capture", children: [_jsxs("div", { className: "capture-head", children: [_jsxs("div", { children: [_jsx("span", { className: "eyebrow", children: "UNIVERSAL INTAKE" }), _jsx("h2", { children: "Give JustGlance anything." })] }), _jsx("button", { className: "icon-button", onClick: onClose, "aria-label": "Close", children: _jsx(X, {}) })] }), _jsx("textarea", { autoFocus: true, value: text, onChange: e => setText(e.target.value), onKeyDown: e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter')
                        void save(); }, placeholder: "Call Ashley next Tuesday, dentist Thursday at 2:30, remember this link\u2026 or just take a photo.", rows: 4 }), analysis && _jsxs("div", { className: "parse-preview smart-preview", children: [_jsx(Sparkles, { size: 16 }), _jsxs("span", { children: [_jsx("strong", { children: effectiveKind }), " \u00B7 ", Math.round(analysis.confidence * 100), "% understood", analysis.dueDate ? ` · ${analysis.dueDate}` : '', analysis.dueTime ? ` ${analysis.dueTime}` : '', analysis.location ? ` · ${analysis.location}` : '', contactMatch ? ` · ${contactMatch.display_name}` : ''] })] }), _jsxs("div", { className: "attachment-row universal-capture-actions", children: [_jsxs("button", { className: "attachment-button camera-button", type: "button", onClick: () => cameraRef.current?.click(), children: [_jsx(Camera, { size: 17 }), "Take photo"] }), _jsxs("button", { className: "attachment-button", type: "button", onClick: () => fileRef.current?.click(), children: [_jsx(Paperclip, { size: 17 }), "Add files"] }), _jsx("input", { ref: cameraRef, className: "sr-only", type: "file", accept: "image/*", capture: "environment", onChange: e => { const f = e.target.files?.[0]; if (f)
                                setFiles(current => [...current, f]); if (cameraRef.current)
                                cameraRef.current.value = ''; } }), _jsx("input", { ref: fileRef, className: "sr-only", type: "file", multiple: true, accept: "image/*,.pdf,.txt,.md,.csv,.json,.ics,.vcf,text/calendar,text/csv,text/vcard", onChange: e => setFiles(current => [...current, ...Array.from(e.target.files || [])]) }), _jsx("span", { children: "Photos can be the entire capture. Calendar and vCard imports are understood too." })] }), !!files.length && _jsx("div", { className: "attachment-list rich-attachments", children: files.map((file, index) => _jsxs("div", { className: file.type.startsWith('image/') ? 'image-attachment' : '', children: [file.type.startsWith('image/') ? _jsx(ImageIcon, { size: 15 }) : file.name.toLowerCase().endsWith('.ics') ? _jsx(Calendar, { size: 15 }) : file.name.toLowerCase().endsWith('.vcf') ? _jsx(ContactRound, { size: 15 }) : _jsx(FileText, { size: 15 }), _jsx("span", { children: file.name }), _jsxs("small", { children: [Math.max(1, Math.round(file.size / 1024)), " KB"] }), _jsx("button", { onClick: () => setFiles(current => current.filter((_, i) => i !== index)), "aria-label": `Remove ${file.name}`, children: _jsx(X, { size: 13 }) })] }, `${file.name}-${index}`)) }), _jsxs("div", { className: "capture-options", children: [_jsxs("div", { className: "chip-row", children: [['task', 'reminder', 'shopping', 'call', 'errand', 'chore', 'idea'].map(type => _jsx("button", { className: `chip ${kind === type ? 'active' : ''}`, onClick: () => setKind(kind === type ? null : type), children: type }, type)), _jsx("button", { className: `chip ${kind === 'appointment' ? 'active' : ''}`, onClick: () => setKind(kind === 'appointment' ? null : 'appointment'), children: "appointment" }), _jsxs("button", { className: `chip ${kind === 'contact' ? 'active' : ''}`, onClick: () => setKind(kind === 'contact' ? null : 'contact'), children: [_jsx(ContactRound, { size: 13 }), "contact"] }), _jsx("button", { className: `chip ${kind === 'note' ? 'active' : ''}`, onClick: () => setKind(kind === 'note' ? null : 'note'), children: "thought" }), _jsxs("button", { className: `chip ${kind === 'link' ? 'active' : ''}`, onClick: () => setKind(kind === 'link' ? null : 'link'), children: [_jsx(Link2, { size: 13 }), "link"] }), _jsx("button", { className: `chip ${kind === 'project' ? 'active' : ''}`, onClick: () => setKind(kind === 'project' ? null : 'project'), children: "project" })] }), effectiveKind !== 'project' && effectiveKind !== 'contact' && _jsxs("div", { className: "capture-grid", children: [_jsxs("label", { children: [_jsx(Calendar, { size: 16 }), "Date", _jsx("input", { type: "date", value: date, onChange: e => setDate(e.target.value), placeholder: analysis?.dueDate || '', disabled: effectiveKind === 'note' || effectiveKind === 'link' })] }), _jsxs("label", { children: [_jsx(Calendar, { size: 16 }), "Time", _jsx("input", { type: "time", value: time, onChange: e => setTime(e.target.value), disabled: effectiveKind === 'note' || effectiveKind === 'link' })] }), _jsxs("label", { children: [_jsx(Users, { size: 16 }), "Space", _jsxs("select", { value: spaceId, onChange: e => setSpaceId(e.target.value), children: [_jsx("option", { value: "", children: "Personal" }), spaces.filter(space => !space.is_personal && space.name !== 'Personal').map(space => _jsx("option", { value: space.id, children: space.name }, space.id))] })] }), _jsxs("label", { children: [_jsx(FolderKanban, { size: 16 }), "Project", _jsxs("select", { value: projectId, onChange: e => setProjectId(e.target.value), disabled: effectiveKind === 'note' || effectiveKind === 'link', children: [_jsx("option", { value: "", children: "None" }), projects.filter(project => project.status === 'active').map(project => _jsx("option", { value: project.id, children: project.name }, project.id))] })] }), _jsxs("label", { children: [_jsx(MapPin, { size: 16 }), "Place", _jsxs("select", { value: placeId, onChange: e => setPlaceId(e.target.value), disabled: effectiveKind === 'note' || effectiveKind === 'link', children: [_jsx("option", { value: "", children: analysis?.location || 'Any place' }), places.map(place => _jsx("option", { value: place.id, children: place.name }, place.id))] })] })] }), effectiveKind === 'project' && _jsx("div", { className: "capture-grid single", children: _jsxs("label", { children: [_jsx(Users, { size: 16 }), "Space", _jsxs("select", { value: spaceId, onChange: e => setSpaceId(e.target.value), children: [_jsx("option", { value: "", children: "Personal" }), spaces.filter(space => !space.is_personal && space.name !== 'Personal').map(space => _jsx("option", { value: space.id, children: space.name }, space.id))] })] }) }), effectiveKind !== 'note' && effectiveKind !== 'appointment' && effectiveKind !== 'link' && effectiveKind !== 'contact' && _jsxs("label", { className: "priority-select", children: ["Priority", _jsxs("select", { value: priority, onChange: e => setPriority(e.target.value), children: [_jsx("option", { value: "low", children: "Low" }), _jsx("option", { value: "normal", children: "Normal" }), _jsx("option", { value: "high", children: "High" })] })] })] }), error && _jsx("div", { className: "form-message capture-error", children: error }), _jsx("button", { className: "primary-button capture-submit", disabled: (!text.trim() && !files.length) || saving, onClick: save, children: saving ? _jsx(_Fragment, { children: saveStage || 'Organizing…' }) : _jsxs(_Fragment, { children: ["Capture ", _jsx(Send, { size: 17 })] }) }), _jsx("p", { className: "capture-footnote", children: "Raw captures are saved first so they are never lost. Smart Intake can then turn clear photos/text into contacts, appointments, calls or tasks; uncertain material stays safely searchable in your memory inbox." })] }) });
}
