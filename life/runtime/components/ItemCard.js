import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { CalendarPlus, Check, Clock3, Edit3, MoreHorizontal, RotateCcw, Trash2 } from 'lucide-react';
import { relativeDue, addDaysISO } from '../lib/time.js';
import { useEffect, useState } from 'react';
import { useAppData } from '../contexts/AppDataContext.js';
import { useOrganizer } from '../contexts/OrganizerContext.js';
import { Modal } from './Modal.js';
export function ItemCard({ item, compact = false }) {
    const { completeItem, snoozeItem, deleteItem, updateItem, updateShopping, places, spaces, members } = useAppData();
    const { projects } = useOrganizer();
    const [menu, setMenu] = useState(false);
    const [editing, setEditing] = useState(false);
    const [title, setTitle] = useState(item.title);
    const [description, setDescription] = useState(item.description || '');
    const [type, setType] = useState(item.type);
    const [dueDate, setDueDate] = useState(item.due_date || '');
    const [dueTime, setDueTime] = useState(item.due_time || '');
    const [priority, setPriority] = useState(item.priority);
    const [duration, setDuration] = useState(item.estimated_minutes?.toString() || '');
    const [placeId, setPlaceId] = useState(item.place_id || '');
    const [spaceId, setSpaceId] = useState(item.space_id || '');
    const [assignedTo, setAssignedTo] = useState(item.assigned_to || '');
    const [recurrence, setRecurrence] = useState(item.recurrence_rule || '');
    const [projectId, setProjectId] = useState(item.project_id || '');
    const [energy, setEnergy] = useState(item.energy_level || '');
    const [waitingFor, setWaitingFor] = useState(item.waiting_for || '');
    const [quantity, setQuantity] = useState(item.shopping?.quantity?.toString() || '');
    const [unit, setUnit] = useState(item.shopping?.unit || '');
    const [preferredStore, setPreferredStore] = useState(item.shopping?.preferred_store || '');
    const [estimatedPrice, setEstimatedPrice] = useState(item.shopping?.estimated_price?.toString() || '');
    const [aisleCategory, setAisleCategory] = useState(item.shopping?.aisle_category || '');
    const due = relativeDue(item.due_date, item.due_time);
    const contextName = item.place_name || item.parser_result?.context || null;
    const currentSpace = spaces.find(space => space.id === item.space_id);
    const assignee = members.find(member => member.user_id === item.assigned_to && member.space_id === item.space_id);
    const availableMembers = members.filter(member => member.space_id === spaceId);
    const currentProject = projects.find(project => project.id === item.project_id);
    useEffect(() => {
        setTitle(item.title);
        setDescription(item.description || '');
        setType(item.type);
        setDueDate(item.due_date || '');
        setDueTime(item.due_time || '');
        setPriority(item.priority);
        setDuration(item.estimated_minutes?.toString() || '');
        setPlaceId(item.place_id || '');
        setSpaceId(item.space_id || '');
        setAssignedTo(item.assigned_to || '');
        setRecurrence(item.recurrence_rule || '');
        setProjectId(item.project_id || '');
        setEnergy(item.energy_level || '');
        setWaitingFor(item.waiting_for || '');
        setQuantity(item.shopping?.quantity?.toString() || '');
        setUnit(item.shopping?.unit || '');
        setPreferredStore(item.shopping?.preferred_store || '');
        setEstimatedPrice(item.shopping?.estimated_price?.toString() || '');
        setAisleCategory(item.shopping?.aisle_category || '');
    }, [item]);
    async function saveEdit() {
        if (!title.trim())
            return;
        const selected = places.find(place => place.id === placeId);
        await updateItem(item.id, {
            title: title.trim(),
            description: description.trim() || null,
            type,
            due_date: dueDate || null,
            due_time: dueTime || null,
            priority,
            estimated_minutes: duration ? Math.max(1, Number(duration)) : null,
            place_id: placeId || null,
            place_name: selected?.name || null,
            space_id: spaceId || null,
            assigned_to: spaceId ? assignedTo || null : null,
            recurrence_rule: recurrence || null,
            project_id: projectId || null,
            energy_level: energy || null,
            waiting_for: waitingFor.trim() || null,
            is_inbox: false,
        });
        if (type === 'shopping') {
            await updateShopping(item.id, {
                quantity: quantity ? Number(quantity) : null,
                unit: unit || null,
                preferred_store: preferredStore || null,
                estimated_price: estimatedPrice ? Number(estimatedPrice) : null,
                aisle_category: aisleCategory || null,
            });
        }
        setEditing(false);
    }
    return _jsxs(_Fragment, { children: [_jsxs("article", { className: `item-card ${compact ? 'compact' : ''}`, children: [_jsx("button", { className: "complete-button", onClick: () => completeItem(item.id), "aria-label": `Complete ${item.title}`, children: _jsx(Check, { size: 18 }) }), _jsxs("div", { className: "item-main", children: [_jsxs("div", { className: "item-title-row", children: [_jsx("strong", { children: item.title }), item.priority === 'high' && _jsx("span", { className: "priority-dot", title: "High priority" })] }), _jsxs("div", { className: "item-meta", children: [due && _jsx("span", { children: due }), item.estimated_minutes && _jsxs("span", { children: [_jsx(Clock3, { size: 13 }), item.estimated_minutes, " min"] }), contextName && _jsx("span", { children: contextName }), currentSpace && _jsx("span", { children: currentSpace.name }), currentProject && _jsx("span", { children: currentProject.name }), item.waiting_for && _jsxs("span", { children: ["Waiting for ", item.waiting_for] }), assignee && _jsxs("span", { children: ["For ", assignee.greeting_name || assignee.display_name] }), item.recurrence_rule && _jsxs("span", { children: ["Repeats ", formatRecurrence(item.recurrence_rule)] }), item.type === 'shopping' && item.shopping?.quantity != null && _jsxs("span", { children: [item.shopping.quantity, item.shopping.unit ? ` ${item.shopping.unit}` : ''] }), item.type === 'shopping' && item.shopping?.preferred_store && _jsx("span", { children: item.shopping.preferred_store })] })] }), _jsxs("div", { className: "item-actions", children: [_jsx("button", { className: "icon-button", onClick: () => setMenu(value => !value), "aria-label": "Item actions", children: _jsx(MoreHorizontal, { size: 19 }) }), menu && _jsxs("div", { className: "popover", children: [_jsxs("button", { onClick: () => { setEditing(true); setMenu(false); }, children: [_jsx(Edit3, { size: 15 }), "Edit"] }), _jsxs("button", { onClick: () => { void updateItem(item.id, { due_date: addDaysISO(1), snoozed_until: null }); setMenu(false); }, children: [_jsx(CalendarPlus, { size: 15 }), "Move to tomorrow"] }), _jsxs("button", { onClick: () => { void snoozeItem(item.id); setMenu(false); }, children: [_jsx(RotateCcw, { size: 15 }), "Snooze 1 day"] }), _jsxs("button", { onClick: () => { void deleteItem(item.id); setMenu(false); }, children: [_jsx(Trash2, { size: 15 }), "Delete"] })] })] })] }), _jsx(Modal, { open: editing, onClose: () => setEditing(false), title: "Edit item", children: _jsxs("div", { className: "form-stack", children: [_jsxs("label", { children: ["Title", _jsx("input", { value: title, onChange: e => setTitle(e.target.value) })] }), _jsxs("label", { children: ["Notes", _jsx("textarea", { value: description, onChange: e => setDescription(e.target.value), rows: 3 })] }), _jsxs("div", { className: "two-col", children: [_jsxs("label", { children: ["Type", _jsxs("select", { value: type, onChange: e => setType(e.target.value), children: [_jsx("option", { value: "task", children: "Task" }), _jsx("option", { value: "shopping", children: "Shopping" }), _jsx("option", { value: "call", children: "Call" }), _jsx("option", { value: "errand", children: "Errand" }), _jsx("option", { value: "chore", children: "Chore" }), _jsx("option", { value: "reminder", children: "Reminder" }), _jsx("option", { value: "idea", children: "Idea" })] })] }), _jsxs("label", { children: ["Priority", _jsxs("select", { value: priority, onChange: e => setPriority(e.target.value), children: [_jsx("option", { value: "low", children: "Low" }), _jsx("option", { value: "normal", children: "Normal" }), _jsx("option", { value: "high", children: "High" })] })] })] }), _jsxs("div", { className: "two-col", children: [_jsxs("label", { children: ["Due date", _jsx("input", { type: "date", value: dueDate, onChange: e => setDueDate(e.target.value) })] }), _jsxs("label", { children: ["Due time", _jsx("input", { type: "time", value: dueTime, onChange: e => setDueTime(e.target.value) })] })] }), _jsxs("div", { className: "two-col", children: [_jsxs("label", { children: ["Expected minutes", _jsx("input", { type: "number", min: "1", max: "1440", value: duration, onChange: e => setDuration(e.target.value) })] }), _jsxs("label", { children: ["Place", _jsxs("select", { value: placeId, onChange: e => setPlaceId(e.target.value), children: [_jsx("option", { value: "", children: "None" }), places.map(place => _jsx("option", { value: place.id, children: place.name }, place.id))] })] })] }), _jsxs("div", { className: "two-col", children: [_jsxs("label", { children: ["Space", _jsxs("select", { value: spaceId, onChange: e => { setSpaceId(e.target.value); setAssignedTo(''); }, children: [_jsx("option", { value: "", children: "Personal" }), spaces.filter(space => !space.is_personal && space.name !== 'Personal').map(space => _jsx("option", { value: space.id, children: space.name }, space.id))] })] }), _jsxs("label", { children: ["Assigned to", _jsxs("select", { value: assignedTo, onChange: e => setAssignedTo(e.target.value), disabled: !spaceId, children: [_jsx("option", { value: "", children: "Anyone" }), availableMembers.map(member => _jsx("option", { value: member.user_id, children: member.greeting_name || member.display_name }, member.user_id))] })] })] }), _jsxs("div", { className: "two-col", children: [_jsxs("label", { children: ["Project", _jsxs("select", { value: projectId, onChange: e => setProjectId(e.target.value), children: [_jsx("option", { value: "", children: "None" }), projects.filter(project => project.status === 'active').map(project => _jsx("option", { value: project.id, children: project.name }, project.id))] })] }), _jsxs("label", { children: ["Energy", _jsxs("select", { value: energy, onChange: e => setEnergy(e.target.value), children: [_jsx("option", { value: "", children: "Any" }), _jsx("option", { value: "low", children: "Low" }), _jsx("option", { value: "medium", children: "Medium" }), _jsx("option", { value: "high", children: "High" })] })] })] }), _jsxs("label", { children: ["Waiting for", _jsx("input", { value: waitingFor, onChange: e => setWaitingFor(e.target.value), placeholder: "Person, delivery, approval\u2026" })] }), _jsxs("label", { children: ["Recurrence", _jsxs("select", { value: recurrence, onChange: e => setRecurrence(e.target.value), children: [_jsx("option", { value: "", children: "Does not repeat" }), _jsx("option", { value: "daily", children: "Daily" }), _jsx("option", { value: "weekdays", children: "Weekdays" }), _jsx("option", { value: "weekdays:1,3,5", children: "Mon / Wed / Fri" }), _jsx("option", { value: "weekly", children: "Weekly" }), _jsx("option", { value: "biweekly", children: "Every 2 weeks" }), _jsx("option", { value: "monthly", children: "Monthly" }), _jsx("option", { value: "every:2", children: "Every 2 days" }), _jsx("option", { value: "every:3", children: "Every 3 days" }), _jsx("option", { value: "every:14", children: "Every 14 days" })] })] }), type === 'shopping' && _jsxs("div", { className: "shopping-edit-group", children: [_jsx("span", { className: "eyebrow", children: "SHOPPING DETAILS" }), _jsxs("div", { className: "two-col", children: [_jsxs("label", { children: ["Quantity", _jsx("input", { type: "number", min: "0", step: "0.01", value: quantity, onChange: e => setQuantity(e.target.value) })] }), _jsxs("label", { children: ["Unit", _jsx("input", { value: unit, onChange: e => setUnit(e.target.value), placeholder: "each, lb, pack\u2026" })] })] }), _jsxs("div", { className: "two-col", children: [_jsxs("label", { children: ["Preferred store", _jsx("input", { value: preferredStore, onChange: e => setPreferredStore(e.target.value), placeholder: "Walmart" })] }), _jsxs("label", { children: ["Estimated price", _jsx("input", { type: "number", min: "0", step: "0.01", value: estimatedPrice, onChange: e => setEstimatedPrice(e.target.value) })] })] }), _jsxs("label", { children: ["Category / aisle", _jsx("input", { value: aisleCategory, onChange: e => setAisleCategory(e.target.value), placeholder: "Pantry, household, produce\u2026" })] })] }), _jsx("button", { className: "primary-button", onClick: saveEdit, disabled: !title.trim(), children: "Save changes" })] }) })] });
}
function formatRecurrence(rule) {
    if (rule === 'weekdays:1,3,5')
        return 'Mon / Wed / Fri';
    if (rule === 'biweekly')
        return 'every 2 weeks';
    if (rule.startsWith('every:'))
        return `every ${rule.split(':')[1]} days`;
    return rule;
}
