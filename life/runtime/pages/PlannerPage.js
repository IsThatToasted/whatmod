import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { CalendarDays, Clock3, Download, Edit3, MapPin, Phone, Plus, Trash2, Upload, UserRound } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAppData } from '../contexts/AppDataContext.js';
import { useAuth } from '../contexts/AuthContext.js';
import { useOrganizer } from '../contexts/OrganizerContext.js';
import { agendaForDate, addDays, formatClock, formatFriendlyDate, isoToday } from '../lib/organizer.js';
import { inspectFile } from '../lib/smartIntake.js';
import { contactPrimaryPhone, dialHref } from '../lib/contacts.js';
import { spaceCategoryAccess } from '../lib/spacePermissions.js';
export default function PlannerPage() {
    const { userId } = useAuth();
    const { items, events, spaces, members, contacts, createEvent, updateEvent, deleteEvent, importCalendarEvents } = useAppData();
    const { projects, reminders, createReminder } = useOrganizer();
    const [params] = useSearchParams();
    const spaceId = params.get('space') || '';
    const space = spaces.find(candidate => candidate.id === spaceId);
    const member = space ? members.find(m => m.space_id === space.id && m.user_id === userId) : undefined;
    const access = spaceCategoryAccess(space, member, 'calendar');
    const canEdit = !spaceId || access.canEdit;
    const [selected, setSelected] = useState(isoToday());
    const [creating, setCreating] = useState(false);
    const [editingEvent, setEditingEvent] = useState(null);
    const [title, setTitle] = useState(''), [time, setTime] = useState('09:00'), [end, setEnd] = useState(''), [location, setLocation] = useState(''), [projectId, setProjectId] = useState(''), [contactId, setContactId] = useState(''), [remind, setRemind] = useState('30');
    const [importing, setImporting] = useState(false), [importMessage, setImportMessage] = useState('');
    const fileRef = useRef(null);
    const days = useMemo(() => Array.from({ length: 14 }, (_, i) => addDays(i)), []);
    const scopedItems = useMemo(() => spaceId ? items.filter(item => item.space_id === spaceId) : items, [items, spaceId]);
    const scopedEvents = useMemo(() => spaceId ? events.filter(event => event.space_id === spaceId) : events, [events, spaceId]);
    const agenda = useMemo(() => agendaForDate(selected, scopedItems, scopedEvents), [selected, scopedItems, scopedEvents]);
    function eventEditable(event) { if (!event.space_id)
        return true; const eventSpace = spaces.find(candidate => candidate.id === event.space_id); const eventMember = eventSpace ? members.find(candidate => candidate.space_id === eventSpace.id && candidate.user_id === userId) : undefined; return spaceCategoryAccess(eventSpace, eventMember, 'calendar').canEdit; }
    const projectOptions = projects.filter(project => project.status === 'active' && (!spaceId || project.space_id === spaceId));
    function resetForm() { setTitle(''); setTime('09:00'); setEnd(''); setLocation(''); setProjectId(''); setContactId(''); setRemind('30'); setEditingEvent(null); }
    function startCreate() { if (!canEdit)
        return; resetForm(); setCreating(true); }
    function startEdit(event) { if (!eventEditable(event))
        return; setEditingEvent(event); setSelected(event.event_date); setTitle(event.title); setTime(event.start_time?.slice(0, 5) || '09:00'); setEnd(event.end_time?.slice(0, 5) || ''); setLocation(event.location || ''); setProjectId(event.project_id || ''); setContactId(event.contact_id || ''); setCreating(true); }
    async function save() { if (!title.trim() || !canEdit)
        return; if (editingEvent) {
        if (!eventEditable(editingEvent))
            return;
        await updateEvent(editingEvent.id, { title: title.trim(), event_date: selected, start_time: time, end_time: end || null, location: location || null, project_id: projectId || null, contact_id: contactId || null });
        setCreating(false);
        resetForm();
        return;
    } const created = await createEvent({ title: title.trim(), event_date: selected, start_time: time, end_time: end || null, location: location || null, notes: null, attendees: [], recurrence_rule: null, project_id: projectId || null, contact_id: contactId || null, space_id: spaceId || null, provider: 'internal', external_id: null }); if (Number(remind) >= 0) {
        const when = new Date(`${selected}T${time}:00`);
        when.setMinutes(when.getMinutes() - Number(remind));
        await createReminder({ title, body: location ? `At ${location}` : null, remind_at: when.toISOString(), event_id: created.id });
    } setCreating(false); resetForm(); }
    async function removeEvent() { if (!editingEvent || !eventEditable(editingEvent))
        return; await deleteEvent(editingEvent.id); setCreating(false); resetForm(); }
    async function importFile(file) { if (!canEdit)
        return; setImporting(true); setImportMessage(''); try {
        const inspected = await inspectFile(file);
        if (!inspected.events.length)
            throw new Error('No calendar events were found. Try an .ics export or an Outlook-style calendar CSV.');
        const eventsForSpace = inspected.events.map(event => ({ ...event, space_id: spaceId || null }));
        const result = await importCalendarEvents(eventsForSpace, file.name);
        setImportMessage(`Imported ${result.imported} event${result.imported === 1 ? '' : 's'}${result.skipped ? ` · ${result.skipped} duplicate${result.skipped === 1 ? '' : 's'} skipped` : ''}.`);
    }
    catch (e) {
        setImportMessage(e instanceof Error ? e.message : 'Calendar import failed.');
    }
    finally {
        setImporting(false);
        if (fileRef.current)
            fileRef.current.value = '';
    } }
    return _jsxs("div", { className: "page organizer-page", children: [_jsxs("header", { className: "page-header", children: [_jsxs("div", { children: [_jsxs("span", { className: "eyebrow", children: ["PLANNER", space ? ` · ${space.name.toUpperCase()}` : ''] }), _jsx("h1", { children: "Your time and your tasks, together." }), _jsx("p", { children: space ? `Appointments and deadlines shared inside ${space.name}.` : 'Appointments, deadlines and reminders share one timeline so the day actually makes sense.' })] }), _jsxs("div", { className: "header-actions", children: [_jsx("input", { ref: fileRef, className: "sr-only", type: "file", accept: ".ics,.csv,text/calendar,text/csv", onChange: e => { const file = e.target.files?.[0]; if (file)
                                    void importFile(file); } }), _jsxs("button", { className: "secondary-button", onClick: () => fileRef.current?.click(), disabled: importing || !canEdit, children: [_jsx(Upload, { size: 17 }), importing ? 'Importing…' : 'Import calendar'] }), _jsxs("button", { className: "primary-button", onClick: startCreate, disabled: !canEdit, children: [_jsx(Plus, { size: 17 }), "Appointment"] })] })] }), spaceId && !canEdit && _jsx("div", { className: "permission-note prominent", children: "You have view-only access to Calendar in this Space." }), _jsxs("div", { className: "calendar-import-note", children: [_jsx(Download, { size: 16 }), _jsxs("div", { children: [_jsx("strong", { children: "Calendar import is live now." }), _jsxs("span", { children: ["Import an ", _jsx("code", { children: ".ics" }), " file from Outlook, Google Calendar, Apple Calendar, or another calendar app. Common Outlook/calendar ", _jsx("code", { children: ".csv" }), " exports are supported too."] }), importMessage && _jsx("b", { children: importMessage })] })] }), _jsx("div", { className: "date-strip", children: days.map(d => _jsxs("button", { className: selected === d ? 'active' : '', onClick: () => setSelected(d), children: [_jsx("span", { children: new Date(d + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short' }) }), _jsx("strong", { children: new Date(d + 'T12:00:00').getDate() })] }, d)) }), creating && _jsx("section", { className: "panel-card planner-create", children: _jsxs("div", { className: "form-stack", children: [_jsxs("div", { className: "section-heading inline", children: [_jsxs("div", { children: [_jsx("span", { className: "eyebrow", children: editingEvent ? 'EDIT APPOINTMENT' : 'NEW APPOINTMENT' }), _jsx("h2", { children: editingEvent ? 'Change the details' : 'Add something to the schedule' })] }), editingEvent && _jsxs("button", { className: "text-button danger-text", onClick: removeEvent, children: [_jsx(Trash2, { size: 15 }), "Delete"] })] }), _jsxs("label", { children: ["Appointment", _jsx("input", { autoFocus: true, value: title, onChange: e => setTitle(e.target.value), placeholder: "Dentist, meeting, dinner\u2026" })] }), _jsxs("div", { className: "two-col", children: [_jsxs("label", { children: ["Starts", _jsx("input", { type: "time", value: time, onChange: e => setTime(e.target.value) })] }), _jsxs("label", { children: ["Ends", _jsx("input", { type: "time", value: end, onChange: e => setEnd(e.target.value) })] })] }), _jsxs("label", { children: ["Location", _jsx("input", { value: location, onChange: e => setLocation(e.target.value), placeholder: "Optional" })] }), _jsxs("div", { className: "two-col", children: [_jsxs("label", { children: ["Project", _jsxs("select", { value: projectId, onChange: e => setProjectId(e.target.value), children: [_jsx("option", { value: "", children: "None" }), projectOptions.map(p => _jsx("option", { value: p.id, children: p.name }, p.id))] })] }), _jsxs("label", { children: ["Contact", _jsxs("select", { value: contactId, onChange: e => setContactId(e.target.value), children: [_jsx("option", { value: "", children: "None" }), contacts.map(contact => _jsx("option", { value: contact.id, children: contact.display_name }, contact.id))] })] })] }), !editingEvent && _jsxs("label", { children: ["Remind me", _jsxs("select", { value: remind, onChange: e => setRemind(e.target.value), children: [_jsx("option", { value: "0", children: "At start" }), _jsx("option", { value: "10", children: "10 min before" }), _jsx("option", { value: "30", children: "30 min before" }), _jsx("option", { value: "60", children: "1 hour before" }), _jsx("option", { value: "1440", children: "1 day before" })] })] }), _jsxs("div", { className: "row-actions", children: [_jsx("button", { className: "secondary-button", onClick: () => { setCreating(false); resetForm(); }, children: "Cancel" }), _jsx("button", { className: "primary-button", disabled: !title.trim(), onClick: save, children: editingEvent ? 'Save changes' : 'Save appointment' })] })] }) }), _jsxs("div", { className: "planner-grid", children: [_jsxs("section", { className: "panel-card agenda-panel", children: [_jsx("div", { className: "section-heading", children: _jsxs("div", { children: [_jsx("span", { className: "eyebrow", children: "AGENDA" }), _jsx("h2", { children: formatFriendlyDate(selected) })] }) }), _jsx("div", { className: "timeline", children: agenda.map(row => { const linkedContact = contacts.find(contact => contact.id === (row.kind === 'event' ? row.event.contact_id : row.item.contact_id)); const phone = contactPrimaryPhone(linkedContact); return _jsxs("article", { className: `timeline-row ${row.kind}`, children: [_jsx("time", { children: row.kind === 'task' && !row.item.due_time ? 'Anytime' : formatClock(row.time) }), _jsx("div", { className: "timeline-dot" }), _jsxs("div", { className: "timeline-content", children: [_jsxs("div", { className: "timeline-title-actions", children: [_jsx("strong", { children: row.title }), row.kind === 'event' && eventEditable(row.event) && _jsx("button", { className: "icon-button subtle", onClick: () => startEdit(row.event), "aria-label": `Edit ${row.title}`, children: _jsx(Edit3, { size: 14 }) })] }), row.kind === 'event' && row.event.location && _jsxs("span", { children: [_jsx(MapPin, { size: 13 }), row.event.location] }), linkedContact && _jsxs("span", { children: [_jsx(UserRound, { size: 13 }), linkedContact.display_name] }), row.kind === 'event' && row.event.provider && row.event.provider !== 'internal' && _jsx("span", { children: row.event.provider }), row.kind === 'task' && row.item.estimated_minutes && _jsxs("span", { children: [_jsx(Clock3, { size: 13 }), row.item.estimated_minutes, " min task"] }), phone && _jsxs("a", { className: "timeline-dial", href: dialHref(phone), children: [_jsx(Phone, { size: 13 }), "Dial"] })] })] }, `${row.kind}-${row.id}`); }) }), !agenda.length && _jsxs("div", { className: "empty-state", children: [_jsx(CalendarDays, {}), _jsx("strong", { children: "Open day." }), _jsx("span", { children: "No appointments or due tasks yet." })] })] }), _jsxs("aside", { className: "panel-card reminders-panel", children: [_jsxs("div", { className: "section-heading", children: [_jsxs("div", { children: [_jsx("span", { className: "eyebrow", children: "REMINDERS" }), _jsx("h2", { children: "Coming up" })] }), _jsx("span", { className: "count-pill", children: reminders.length })] }), _jsx("div", { className: "reminder-list", children: reminders.slice(0, 8).map(r => _jsxs("div", { children: [_jsx("span", { className: "reminder-time", children: new Date(r.remind_at).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' }) }), _jsx("strong", { children: r.title })] }, r.id)) }), !reminders.length && _jsx("p", { className: "muted-copy", children: "Add reminders to appointments from the planner. The iOS wrapper schedules native local notifications." })] })] })] });
}
