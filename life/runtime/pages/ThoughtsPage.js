import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { ArrowRight, Edit3, Lightbulb, Plus, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Modal } from '../components/Modal.js';
import { useAppData } from '../contexts/AppDataContext.js';
import { useAuth } from '../contexts/AuthContext.js';
import { useOrganizer } from '../contexts/OrganizerContext.js';
import { spaceCategoryAccess } from '../lib/spacePermissions.js';
export default function ThoughtsPage() {
    const { userId } = useAuth();
    const { notes, spaces, members, createNote, updateNote, deleteNote, createItem } = useAppData();
    const { projects } = useOrganizer();
    const [params] = useSearchParams();
    const spaceId = params.get('space') || '';
    const space = spaces.find(candidate => candidate.id === spaceId);
    const member = space ? members.find(m => m.space_id === space.id && m.user_id === userId) : undefined;
    const access = spaceCategoryAccess(space, member, 'notes');
    const canEdit = !spaceId || access.canEdit;
    function noteEditable(note) { if (!note.space_id)
        return true; const noteSpace = spaces.find(candidate => candidate.id === note.space_id); const noteMember = noteSpace ? members.find(candidate => candidate.space_id === noteSpace.id && candidate.user_id === userId) : undefined; return spaceCategoryAccess(noteSpace, noteMember, 'notes').canEdit; }
    const [text, setText] = useState(''), [query, setQuery] = useState(''), [editing, setEditing] = useState(null), [editTitle, setEditTitle] = useState(''), [editBody, setEditBody] = useState(''), [editTags, setEditTags] = useState('');
    const visible = useMemo(() => notes.filter(note => (!spaceId || note.space_id === spaceId) && (!query || `${note.title} ${note.body} ${(note.tags || []).join(' ')}`.toLowerCase().includes(query.toLowerCase()))), [notes, query, spaceId]);
    async function add() { if (!text.trim() || !canEdit)
        return; await createNote(text, spaceId || null); setText(''); }
    function startEdit(note) { if (!noteEditable(note))
        return; setEditing(note); setEditTitle(note.title); setEditBody(note.body); setEditTags((note.tags || []).join(', ')); }
    async function saveEdit() { if (!editing || !editBody.trim() || !noteEditable(editing))
        return; await updateNote(editing.id, { title: editTitle.trim() || 'Note', body: editBody.trim(), tags: editTags.split(',').map(tag => tag.trim()).filter(Boolean) }); setEditing(null); }
    async function remove() { if (!editing || !noteEditable(editing))
        return; await deleteNote(editing.id); setEditing(null); }
    return _jsxs("div", { className: "page organizer-page", children: [_jsx("header", { className: "page-header", children: _jsxs("div", { children: [_jsxs("span", { className: "eyebrow", children: ["THOUGHTS", space ? ` · ${space.name.toUpperCase()}` : ''] }), _jsx("h1", { children: "A place for things that are not tasks yet." }), _jsx("p", { children: space ? `Shared notes and references inside ${space.name}.` : 'Ideas, references, decisions, snippets and thoughts stay searchable without pretending everything needs a deadline.' })] }) }), spaceId && !canEdit && _jsx("div", { className: "permission-note prominent", children: "You have view-only access to Thoughts & files in this Space." }), canEdit && _jsxs("section", { className: "thought-capture panel-card", children: [_jsx("textarea", { value: text, onChange: e => setText(e.target.value), placeholder: "Capture a thought before it disappears\u2026", rows: 3 }), _jsxs("button", { className: "primary-button", onClick: add, disabled: !text.trim(), children: [_jsx(Plus, { size: 17 }), "Remember this"] })] }), _jsxs("label", { className: "inline-search thoughts-search", children: [_jsx(Search, { size: 17 }), _jsx("input", { value: query, onChange: e => setQuery(e.target.value), placeholder: "Search your thoughts\u2026" })] }), _jsx("div", { className: "notes-grid", children: visible.map(note => _jsxs("article", { className: "note-card", children: [_jsxs("div", { className: "note-card-head", children: [_jsx("span", { className: "note-date", children: new Date(note.created_at).toLocaleDateString() }), noteEditable(note) && _jsx("button", { className: "icon-button subtle", onClick: () => startEdit(note), "aria-label": `Edit ${note.title}`, children: _jsx(Edit3, { size: 15 }) })] }), _jsx("strong", { children: note.title }), _jsx("p", { children: note.body }), note.tags?.length ? _jsx("div", { className: "note-tags", children: note.tags.map(tag => _jsx("span", { children: tag }, tag)) }) : null, _jsxs("div", { className: "note-actions", children: [noteEditable(note) && _jsxs("button", { onClick: () => createItem({ type: 'task', title: note.title, priority: 'normal', tags: ['from-note'], confidence: 1 }, note.body, { description: note.body, is_inbox: true, space_id: note.space_id || null }), children: ["Task ", _jsx(ArrowRight, { size: 13 })] }), projects.find(project => project.space_id === note.space_id || (!project.space_id && !note.space_id)) && _jsx("span", { children: "Can connect to a project from the item editor." })] })] }, note.id)) }), !visible.length && _jsxs("div", { className: "empty-state large", children: [_jsx(Lightbulb, {}), _jsx("strong", { children: "Nothing here yet." }), _jsx("span", { children: "Capture the unfinished thought, not just the polished one." })] }), _jsx(Modal, { open: !!editing && !!editing && noteEditable(editing), onClose: () => setEditing(null), title: "Edit thought", children: _jsxs("div", { className: "form-stack", children: [_jsxs("label", { children: ["Title", _jsx("input", { value: editTitle, onChange: e => setEditTitle(e.target.value) })] }), _jsxs("label", { children: ["Thought", _jsx("textarea", { rows: 7, value: editBody, onChange: e => setEditBody(e.target.value) })] }), _jsxs("label", { children: ["Tags", _jsx("input", { value: editTags, onChange: e => setEditTags(e.target.value), placeholder: "idea, home, reference" })] }), _jsxs("div", { className: "row-actions", children: [_jsxs("button", { className: "text-button danger-text", onClick: remove, children: [_jsx(Trash2, { size: 15 }), "Delete"] }), _jsx("button", { className: "primary-button", onClick: saveEdit, disabled: !editBody.trim(), children: "Save changes" })] })] }) })] });
}
