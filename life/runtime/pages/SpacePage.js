import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { ArrowLeft, CalendarDays, CheckCircle2, Copy, FolderKanban, Link2, Pencil, ShoppingBasket, StickyNote, UserCog, UserPlus, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Modal } from '../components/Modal.js';
import { useAppData } from '../contexts/AppDataContext.js';
import { useAuth } from '../contexts/AuthContext.js';
import { useOrganizer } from '../contexts/OrganizerContext.js';
import { DEFAULT_SPACE_PERMISSIONS, normalizeSpacePermissions, SPACE_PERMISSION_GROUPS } from '../lib/spacePermissions.js';
export default function SpacePage() {
    const { id } = useParams();
    const nav = useNavigate();
    const { userId, demo } = useAuth();
    const { spaces, members, items, events, notes, activity, createInvite, updateMemberAccess, updateSpace, collaborationAvailable } = useAppData();
    const { projects } = useOrganizer();
    const space = spaces.find(s => s.id === id);
    const [inviteOpen, setInviteOpen] = useState(false), [email, setEmail] = useState(''), [inviteRole, setInviteRole] = useState('member'), [invitePermissions, setInvitePermissions] = useState({ ...DEFAULT_SPACE_PERMISSIONS }), [inviteLink, setInviteLink] = useState(''), [inviteExpiry, setInviteExpiry] = useState(''), [inviteError, setInviteError] = useState(''), [inviteSaving, setInviteSaving] = useState(false);
    const [manageMember, setManageMember] = useState(null), [memberPermissions, setMemberPermissions] = useState({ ...DEFAULT_SPACE_PERMISSIONS }), [memberRole, setMemberRole] = useState('member'), [memberError, setMemberError] = useState(''), [memberSaving, setMemberSaving] = useState(false);
    const [editOpen, setEditOpen] = useState(false), [spaceName, setSpaceName] = useState(space?.name || ''), [spaceError, setSpaceError] = useState('');
    const spaceMembers = members.filter(m => m.space_id === id);
    const me = spaceMembers.find(m => m.user_id === userId);
    const canManage = space?.role === 'owner' || space?.role === 'admin' || me?.role === 'owner' || me?.role === 'admin';
    const myPermissions = canManage ? normalizeSpacePermissions(DEFAULT_SPACE_PERMISSIONS) : normalizeSpacePermissions(me?.permissions);
    const canInvite = !space?.is_personal && (canManage || myPermissions.invite_members);
    const counts = useMemo(() => ({
        shopping: items.filter(item => item.space_id === id && item.type === 'shopping' && item.status === 'open').length,
        tasks: items.filter(item => item.space_id === id && item.type !== 'shopping' && item.status === 'open').length,
        calendar: events.filter(event => event.space_id === id).length,
        notes: notes.filter(note => note.space_id === id).length,
        projects: projects.filter(project => project.space_id === id && project.status !== 'archived').length,
    }), [items, events, notes, projects, id]);
    if (!space)
        return _jsxs("div", { className: "page", children: [_jsxs("button", { className: "text-button", onClick: () => nav('/spaces'), children: [_jsx(ArrowLeft, {}), "Spaces"] }), _jsx("div", { className: "empty-state large", children: _jsx("strong", { children: "Space not found." }) })] });
    const currentSpace = space;
    const categories = [
        { key: 'shopping', label: 'Shopping', description: 'Lists, product links and shared purchases.', Icon: ShoppingBasket, view: myPermissions.view_shopping, edit: myPermissions.edit_shopping, route: `/shopping?space=${id}`, count: counts.shopping },
        { key: 'tasks', label: 'Tasks & chores', description: 'Shared actions, errands and reminders.', Icon: CheckCircle2, view: myPermissions.view_tasks, edit: myPermissions.edit_tasks, route: `/tasks?space=${id}`, count: counts.tasks },
        { key: 'calendar', label: 'Calendar', description: 'Appointments and plans for this Space.', Icon: CalendarDays, view: myPermissions.view_calendar, edit: myPermissions.edit_calendar, route: `/planner?space=${id}`, count: counts.calendar },
        { key: 'notes', label: 'Thoughts & files', description: 'Shared notes, references and captured memory.', Icon: StickyNote, view: myPermissions.view_notes, edit: myPermissions.edit_notes, route: `/thoughts?space=${id}`, count: counts.notes },
        { key: 'projects', label: 'Projects', description: 'Shared outcomes and connected next actions.', Icon: FolderKanban, view: myPermissions.view_projects, edit: myPermissions.edit_projects, route: `/projects?space=${id}`, count: counts.projects },
    ];
    async function makeInvite() { if (!id)
        return; setInviteError(''); setInviteSaving(true); try {
        const result = await createInvite(id, email.trim() || undefined, inviteRole, invitePermissions);
        setInviteLink(`${location.origin}/life/#/invite/${encodeURIComponent(result.token)}`);
        setInviteExpiry(result.expires_at);
    }
    catch (e) {
        setInviteError(e instanceof Error ? e.message : 'Could not create invite.');
    }
    finally {
        setInviteSaving(false);
    } }
    function startManage(member) { setManageMember(member); setMemberPermissions(normalizeSpacePermissions(member.permissions)); setMemberRole(member.role === 'admin' ? 'admin' : 'member'); setMemberError(''); }
    function togglePermission(which, key, checked) { const setter = which === 'invite' ? setInvitePermissions : setMemberPermissions; setter(current => { const next = { ...current, [key]: checked }; for (const group of SPACE_PERMISSION_GROUPS) {
        if (key === group.view && !checked)
            next[group.edit] = false;
        if (key === group.edit && checked)
            next[group.view] = true;
    } return next; }); }
    async function saveMember() { if (!manageMember || !id)
        return; setMemberError(''); setMemberSaving(true); try {
        await updateMemberAccess(id, manageMember.user_id, memberPermissions, memberRole);
        setManageMember(null);
    }
    catch (e) {
        setMemberError(e instanceof Error ? e.message : 'Could not save access.');
    }
    finally {
        setMemberSaving(false);
    } }
    async function saveSpace() { if (!spaceName.trim())
        return; setSpaceError(''); try {
        await updateSpace(currentSpace.id, { name: spaceName.trim() });
        setEditOpen(false);
    }
    catch (e) {
        setSpaceError(e instanceof Error ? e.message : 'Could not rename this Space.');
    } }
    return _jsxs("div", { className: "page organizer-page space-hub-page", children: [_jsxs("button", { className: "text-button back-link", onClick: () => nav('/spaces'), children: [_jsx(ArrowLeft, { size: 16 }), "All spaces"] }), _jsxs("header", { className: "page-header", children: [_jsxs("div", { children: [_jsx("span", { className: "eyebrow", children: "SHARED SPACE" }), _jsx("h1", { children: currentSpace.name }), _jsx("p", { children: "People join this Space once. Their category permissions decide what they can see or change everywhere in JustGlance." })] }), _jsxs("div", { className: "header-actions", children: [canManage && _jsxs("button", { className: "secondary-button", onClick: () => { setSpaceName(currentSpace.name); setEditOpen(true); }, children: [_jsx(Pencil, { size: 16 }), "Edit space"] }), canInvite && _jsxs("button", { className: "primary-button", onClick: () => setInviteOpen(true), children: [_jsx(UserPlus, { size: 17 }), "Invite member"] })] })] }), !collaborationAvailable && !demo && _jsxs("div", { className: "migration-banner", children: [_jsx("strong", { children: "Shared permissions need the current collaboration schema." }), _jsx("span", { children: "Run the current master schema repair in Supabase." })] }), _jsxs("div", { className: "space-membership-explainer", children: [_jsx(Users, { size: 18 }), _jsxs("div", { children: [_jsx("strong", { children: "One membership, category-level access." }), _jsx("span", { children: "An invite never creates a separate shopping-only or task-only membership. It joins this entire Space, then permissions control Shopping, Tasks, Calendar, Thoughts/Files and Projects." })] })] }), _jsx("div", { className: "space-category-grid", children: categories.map(category => _jsxs("button", { className: `space-category-card ${category.view ? '' : 'disabled'}`, disabled: !category.view, onClick: () => category.view && nav(category.route), children: [_jsx("span", { className: "space-category-icon", children: _jsx(category.Icon, {}) }), _jsxs("span", { className: "space-category-copy", children: [_jsx("strong", { children: category.label }), _jsx("span", { children: category.description }), _jsx("small", { children: category.view ? (category.edit ? 'Can view & edit' : 'View only') : 'No access' })] }), _jsx("span", { className: "space-category-count", children: category.count })] }, category.key)) }), _jsxs("div", { className: "space-admin-grid", children: [_jsxs("section", { className: "panel-card", children: [_jsxs("div", { className: "section-heading inline", children: [_jsxs("div", { children: [_jsx("span", { className: "eyebrow", children: "MEMBERS" }), _jsxs("h2", { children: [spaceMembers.length, " people"] })] }), canInvite && _jsxs("button", { className: "mini-action", onClick: () => setInviteOpen(true), children: [_jsx(UserPlus, { size: 15 }), "Invite"] })] }), _jsx("div", { className: "member-list", children: spaceMembers.map(member => _jsxs("div", { className: "member-row member-row-manage", children: [_jsx("span", { className: "member-avatar", children: (member.greeting_name || member.display_name || 'M')[0].toUpperCase() }), _jsxs("span", { children: [_jsx("b", { children: member.greeting_name || member.display_name }), _jsxs("small", { children: [member.role, member.user_id === userId ? ' · you' : ''] })] }), canManage && member.role !== 'owner' && _jsx("button", { className: "member-manage-button", onClick: () => startManage(member), "aria-label": `Manage ${member.display_name}`, children: _jsx(UserCog, { size: 15 }) })] }, member.user_id)) })] }), _jsxs("section", { className: "panel-card", children: [_jsx("span", { className: "eyebrow", children: "RECENT ACTIVITY" }), _jsxs("div", { className: "space-activity-list", children: [activity.filter(entry => entry.space_id === id).slice(0, 8).map(entry => _jsxs("p", { children: [entry.actor_name || 'Someone', " ", entry.action, " ", _jsx("b", { children: entry.entity_title })] }, entry.id)), !activity.some(entry => entry.space_id === id) && _jsx("p", { className: "muted-copy", children: "Activity will appear here as members make changes." })] })] })] }), _jsx(Modal, { open: editOpen, onClose: () => setEditOpen(false), title: "Edit space", children: _jsxs("div", { className: "form-stack", children: [_jsxs("label", { children: ["Space name", _jsx("input", { autoFocus: true, value: spaceName, onChange: e => setSpaceName(e.target.value) })] }), spaceError && _jsx("div", { className: "form-message", children: spaceError }), _jsx("button", { className: "primary-button", onClick: saveSpace, disabled: !spaceName.trim(), children: "Save changes" })] }) }), _jsx(Modal, { open: inviteOpen, onClose: () => { setInviteOpen(false); setInviteLink(''); setInviteExpiry(''); setInviteError(''); }, title: `Invite to ${currentSpace.name}`, children: _jsx("div", { className: "form-stack", children: !inviteLink ? _jsxs(_Fragment, { children: [_jsxs("p", { className: "modal-intro", children: ["This link joins the entire ", _jsx("b", { children: currentSpace.name }), " Space. Choose which categories this person can view or edit."] }), _jsxs("label", { children: ["Email (optional)", _jsx("input", { type: "email", value: email, onChange: e => setEmail(e.target.value), placeholder: "person@example.com" })] }), (currentSpace.role === 'owner' || me?.role === 'owner') && _jsxs("label", { children: ["Role", _jsxs("select", { value: inviteRole, onChange: e => setInviteRole(e.target.value), children: [_jsx("option", { value: "member", children: "Member" }), _jsx("option", { value: "admin", children: "Admin" })] })] }), _jsxs("div", { className: "permission-editor", children: [_jsxs("div", { className: "permission-head", children: [_jsx("strong", { children: "Category permissions" }), _jsx("span", { children: "View / change" })] }), SPACE_PERMISSION_GROUPS.map(group => _jsxs("div", { className: "permission-row", children: [_jsx("span", { children: group.label }), _jsxs("label", { children: [_jsx("input", { type: "checkbox", checked: invitePermissions[group.view], onChange: e => togglePermission('invite', group.view, e.target.checked) }), "View"] }), _jsxs("label", { children: [_jsx("input", { type: "checkbox", checked: invitePermissions[group.edit], onChange: e => togglePermission('invite', group.edit, e.target.checked) }), "Edit"] })] }, group.key)), _jsxs("div", { className: "permission-row single", children: [_jsx("span", { children: "Can create invite links" }), _jsxs("label", { children: [_jsx("input", { type: "checkbox", checked: invitePermissions.invite_members, onChange: e => togglePermission('invite', 'invite_members', e.target.checked) }), "Allow"] })] })] }), _jsx("p", { className: "muted", children: "Leave email blank for a shareable link. Email-bound links only work for that signed-in email." }), inviteError && _jsx("div", { className: "form-message", children: inviteError }), _jsxs("button", { className: "primary-button", onClick: makeInvite, disabled: inviteSaving, children: [_jsx(Link2, { size: 17 }), inviteSaving ? 'Creating…' : 'Create invite link'] })] }) : _jsxs(_Fragment, { children: [_jsxs("label", { children: ["Secure invite link", _jsx("input", { value: inviteLink, readOnly: true })] }), _jsxs("button", { className: "primary-button", onClick: async () => { await navigator.clipboard.writeText(inviteLink); }, children: [_jsx(Copy, { size: 17 }), "Copy link"] }), _jsxs("p", { className: "muted", children: ["Expires ", inviteExpiry ? new Date(inviteExpiry).toLocaleString() : 'in seven days', ". The raw token is only shown here; Supabase stores its hash."] })] }) }) }), _jsx(Modal, { open: !!manageMember, onClose: () => setManageMember(null), title: manageMember ? `Access for ${manageMember.greeting_name || manageMember.display_name}` : 'Member access', children: _jsx("div", { className: "form-stack", children: manageMember && _jsxs(_Fragment, { children: [(currentSpace.role === 'owner' || me?.role === 'owner') && _jsxs("label", { children: ["Role", _jsxs("select", { value: memberRole, onChange: e => setMemberRole(e.target.value), children: [_jsx("option", { value: "member", children: "Member" }), _jsx("option", { value: "admin", children: "Admin" })] })] }), _jsxs("div", { className: "permission-editor", children: [_jsxs("div", { className: "permission-head", children: [_jsx("strong", { children: "Category permissions" }), _jsx("span", { children: "View / change" })] }), SPACE_PERMISSION_GROUPS.map(group => _jsxs("div", { className: "permission-row", children: [_jsx("span", { children: group.label }), _jsxs("label", { children: [_jsx("input", { type: "checkbox", checked: memberPermissions[group.view], onChange: e => togglePermission('member', group.view, e.target.checked) }), "View"] }), _jsxs("label", { children: [_jsx("input", { type: "checkbox", checked: memberPermissions[group.edit], onChange: e => togglePermission('member', group.edit, e.target.checked) }), "Edit"] })] }, group.key)), _jsxs("div", { className: "permission-row single", children: [_jsx("span", { children: "Can create invite links" }), _jsxs("label", { children: [_jsx("input", { type: "checkbox", checked: memberPermissions.invite_members, onChange: e => togglePermission('member', 'invite_members', e.target.checked) }), "Allow"] })] })] }), memberError && _jsx("div", { className: "form-message", children: memberError }), _jsx("button", { className: "primary-button", onClick: saveMember, disabled: memberSaving, children: memberSaving ? 'Saving…' : 'Save access' })] }) }) })] });
}
