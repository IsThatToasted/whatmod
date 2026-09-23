import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { CheckCircle2, Home, Plus, ShoppingBasket, UserCog, UserPlus, UsersRound, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../components/Modal.js';
import { useAppData } from '../contexts/AppDataContext.js';
import { useAuth } from '../contexts/AuthContext.js';
import { DEFAULT_SPACE_PERMISSIONS, normalizeSpacePermissions, SPACE_PERMISSION_GROUPS } from '../lib/spacePermissions.js';
import { supabase } from '../lib/supabase.js';
function memberAccessLabel(member) {
    if (member.role === 'owner' || member.role === 'admin')
        return member.role === 'owner' ? 'Owner · full access' : 'Admin · full access';
    const permissions = normalizeSpacePermissions(member.permissions);
    const editable = SPACE_PERMISSION_GROUPS.filter(group => permissions[group.edit]).length;
    const visible = SPACE_PERMISSION_GROUPS.filter(group => permissions[group.view]).length;
    if (editable === SPACE_PERMISSION_GROUPS.length)
        return 'All categories · edit';
    if (editable)
        return `${editable} edit · ${visible} visible`;
    if (visible)
        return `${visible} categories · view only`;
    return 'No category access';
}
export default function SpacesPage() {
    const { spaces, members, items, createSpace, updateMemberAccess } = useAppData();
    const { user, userId, demo } = useAuth();
    const nav = useNavigate();
    const [open, setOpen] = useState(false), [name, setName] = useState(''), [error, setError] = useState('');
    const [pendingInvites, setPendingInvites] = useState([]), [pendingError, setPendingError] = useState('');
    const [managePersonId, setManagePersonId] = useState(''), [accessDrafts, setAccessDrafts] = useState({}), [accessBusy, setAccessBusy] = useState(false), [accessError, setAccessError] = useState('');
    const sharedSpaces = useMemo(() => spaces.filter(space => !space.is_personal && space.name !== 'Personal'), [spaces]);
    const sharedIds = useMemo(() => new Set(sharedSpaces.map(space => space.id)), [sharedSpaces]);
    const people = useMemo(() => {
        const map = new Map();
        for (const member of members) {
            if (member.user_id === userId || !sharedIds.has(member.space_id))
                continue;
            const current = map.get(member.user_id) || { user_id: member.user_id, display_name: member.display_name, greeting_name: member.greeting_name, avatar_url: member.avatar_url, memberships: [] };
            current.memberships.push(member);
            map.set(member.user_id, current);
        }
        return [...map.values()].sort((a, b) => (a.greeting_name || a.display_name).localeCompare(b.greeting_name || b.display_name));
    }, [members, sharedIds, userId]);
    const managePerson = people.find(person => person.user_id === managePersonId) || null;
    function myMembership(spaceId) { return members.find(member => member.space_id === spaceId && member.user_id === userId); }
    function canManageSpace(spaceId) { const space = spaces.find(candidate => candidate.id === spaceId), mine = myMembership(spaceId); return !!(space?.role === 'owner' || space?.role === 'admin' || mine?.role === 'owner' || mine?.role === 'admin'); }
    function amOwner(spaceId) { const space = spaces.find(candidate => candidate.id === spaceId), mine = myMembership(spaceId); return !!(space?.role === 'owner' || mine?.role === 'owner'); }
    async function save() { if (!name.trim())
        return; setError(''); try {
        await createSpace(name.trim());
        setName('');
        setOpen(false);
    }
    catch (e) {
        setError(e instanceof Error ? e.message : 'Could not create that space.');
    } }
    async function loadPendingInvites() {
        if (demo || !supabase || !userId) {
            setPendingInvites([]);
            return;
        }
        const { data, error } = await supabase.from('invites').select('id,space_id,invite_email,role,permissions,expires_at,created_at').eq('created_by', userId).is('accepted_at', null).gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false });
        if (error) {
            setPendingError(error.message);
            return;
        }
        setPendingError('');
        setPendingInvites((data || []));
    }
    useEffect(() => { void loadPendingInvites(); }, [demo, userId, spaces.length]);
    async function revokePendingInvite(id) {
        if (!supabase)
            return;
        const { error } = await supabase.from('invites').delete().eq('id', id);
        if (error) {
            setPendingError(error.message);
            return;
        }
        setPendingInvites(current => current.filter(invite => invite.id !== id));
    }
    function openPersonAccess(person) {
        const drafts = {};
        for (const membership of person.memberships)
            drafts[membership.space_id] = { role: membership.role === 'admin' ? 'admin' : 'member', permissions: normalizeSpacePermissions(membership.permissions) };
        setAccessDrafts(drafts);
        setManagePersonId(person.user_id);
        setAccessError('');
    }
    function setDraftRole(spaceId, role) { setAccessDrafts(current => ({ ...current, [spaceId]: { ...(current[spaceId] || { permissions: { ...DEFAULT_SPACE_PERMISSIONS } }), role } })); }
    function toggleDraftPermission(spaceId, key, checked) {
        setAccessDrafts(current => { const original = current[spaceId] || { role: 'member', permissions: { ...DEFAULT_SPACE_PERMISSIONS } }; const permissions = { ...original.permissions, [key]: checked }; for (const group of SPACE_PERMISSION_GROUPS) {
            if (key === group.view && !checked)
                permissions[group.edit] = false;
            if (key === group.edit && checked)
                permissions[group.view] = true;
        } return { ...current, [spaceId]: { ...original, permissions } }; });
    }
    async function savePersonAccess() {
        if (!managePerson)
            return;
        setAccessBusy(true);
        setAccessError('');
        try {
            for (const membership of managePerson.memberships) {
                if (!canManageSpace(membership.space_id) || membership.role === 'owner')
                    continue;
                const draft = accessDrafts[membership.space_id];
                if (!draft)
                    continue;
                await updateMemberAccess(membership.space_id, managePerson.user_id, draft.permissions, amOwner(membership.space_id) ? draft.role : undefined);
            }
            setManagePersonId('');
        }
        catch (e) {
            setAccessError(e instanceof Error ? e.message : 'Could not update that person’s access.');
        }
        finally {
            setAccessBusy(false);
        }
    }
    return _jsxs("div", { className: "page organizer-page spaces-directory-page", children: [_jsxs("header", { className: "page-header", children: [_jsxs("div", { children: [_jsx("span", { className: "eyebrow", children: "SHARING" }), _jsx("h1", { children: "People first. Spaces second." }), _jsx("p", { children: "A person can belong to more than one Space. See everyone you share with here, then adjust what they can view or edit in each Space." })] }), _jsxs("button", { className: "primary-button", onClick: () => setOpen(true), children: [_jsx(Plus, { size: 18 }), "New space"] })] }), _jsxs("div", { className: "account-status-card", children: [_jsx("strong", { children: demo ? 'Demo mode' : 'Signed in' }), _jsx("span", { children: demo ? 'Shared links are disabled in demo mode.' : user?.email || 'Supabase account' })] }), _jsxs("section", { className: "people-access-section", children: [_jsx("div", { className: "section-heading inline", children: _jsxs("div", { children: [_jsx("span", { className: "eyebrow", children: "PEOPLE & ACCESS" }), _jsx("h2", { children: people.length ? `${people.length} ${people.length === 1 ? 'person' : 'people'} connected` : 'Nobody else has joined yet' }), _jsx("p", { children: "Manage one person across every shared Space you can administer." })] }) }), people.length ? _jsx("div", { className: "people-access-grid", children: people.map(person => {
                            const name = person.greeting_name || person.display_name || 'Member';
                            const manageable = person.memberships.some(m => canManageSpace(m.space_id) && m.role !== 'owner');
                            return _jsxs("article", { className: "person-access-card", children: [_jsxs("div", { className: "person-access-top", children: [_jsx("span", { className: "member-avatar large", children: person.avatar_url ? _jsx("img", { src: person.avatar_url, alt: "" }) : name[0].toUpperCase() }), _jsxs("div", { children: [_jsx("strong", { children: name }), _jsxs("span", { children: [person.memberships.length, " shared ", person.memberships.length === 1 ? 'space' : 'spaces'] })] }), manageable && _jsxs("button", { className: "mini-action", onClick: () => openPersonAccess(person), children: [_jsx(UserCog, { size: 15 }), "Manage"] })] }), _jsx("div", { className: "person-space-list", children: person.memberships.map(membership => { const space = spaces.find(candidate => candidate.id === membership.space_id); return _jsxs("button", { type: "button", onClick: () => nav(`/spaces/${membership.space_id}`), children: [_jsx(Home, { size: 14 }), _jsxs("span", { children: [_jsx("b", { children: space?.name || 'Shared space' }), _jsx("small", { children: memberAccessLabel(membership) })] })] }, membership.space_id); }) })] }, person.user_id);
                        }) }) : _jsxs("div", { className: "sharing-empty", children: [_jsx(UsersRound, {}), _jsxs("div", { children: [_jsx("strong", { children: "Invite someone from a Space." }), _jsx("span", { children: "Once they join, they appear here even if you later share additional Spaces with them." })] })] })] }), pendingInvites.length > 0 && _jsxs("section", { className: "pending-invites-section", children: [_jsx("div", { className: "section-heading inline", children: _jsxs("div", { children: [_jsx("span", { className: "eyebrow", children: "PENDING" }), _jsx("h2", { children: "Invite links waiting to be used" })] }) }), _jsx("div", { className: "pending-invite-list", children: pendingInvites.map(invite => { const space = spaces.find(candidate => candidate.id === invite.space_id); return _jsxs("div", { className: "pending-invite-row", children: [_jsx("span", { className: "pending-icon", children: _jsx(UserPlus, { size: 16 }) }), _jsxs("div", { children: [_jsx("strong", { children: invite.invite_email || 'Shareable invite link' }), _jsxs("small", { children: [space?.name || 'Shared space', " \u00B7 ", invite.role, " \u00B7 expires ", new Date(invite.expires_at).toLocaleDateString()] })] }), _jsx("button", { className: "text-button danger-text", onClick: () => void revokePendingInvite(invite.id), children: "Revoke" })] }, invite.id); }) }), pendingError && _jsx("div", { className: "form-message", children: pendingError })] }), _jsxs("section", { className: "spaces-list-section", children: [_jsx("div", { className: "section-heading inline", children: _jsxs("div", { children: [_jsx("span", { className: "eyebrow", children: "YOUR SPACES" }), _jsx("h2", { children: "Shared areas of your life" }), _jsx("p", { children: "Open a Space to invite people, view its activity, or jump into one of its categories." })] }) }), _jsxs("div", { className: "space-grid", children: [sharedSpaces.map(space => { const count = items.filter(i => i.space_id === space.id && i.status === 'open').length; const shop = items.filter(i => i.space_id === space.id && i.type === 'shopping' && i.status === 'open').length; const memberCount = members.filter(member => member.space_id === space.id).length; return _jsxs("button", { className: "space-card", onClick: () => nav(`/spaces/${space.id}`), children: [_jsx("div", { className: "space-icon", children: _jsx(Home, {}) }), _jsxs("div", { children: [_jsx("h2", { children: space.name }), _jsxs("p", { children: [_jsx(UsersRound, { size: 15 }), " ", memberCount, " ", memberCount === 1 ? 'person' : 'people', " \u00B7 ", space.role || 'member'] }), _jsxs("div", { className: "space-card-meta", children: [_jsxs("span", { children: [count, " open"] }), shop > 0 && _jsxs("span", { className: "space-shopping", children: [_jsx(ShoppingBasket, { size: 14 }), shop, " shopping"] })] })] })] }, space.id); }), sharedSpaces.length === 0 && _jsxs("div", { className: "large-empty", children: [_jsx(UsersRound, {}), _jsx("h2", { children: "No shared spaces yet." }), _jsx("p", { children: "Create one for a household, relationship, trip, team, or anything you want to share." })] })] })] }), _jsx(Modal, { open: open, onClose: () => setOpen(false), title: "Create a shared space", children: _jsxs("div", { className: "form-stack", children: [_jsxs("label", { children: ["Space name", _jsx("input", { value: name, onChange: e => setName(e.target.value), placeholder: "Home", autoFocus: true })] }), error && _jsx("div", { className: "form-message", children: error }), _jsx("button", { className: "primary-button", onClick: save, disabled: !name.trim(), children: "Create space" })] }) }), _jsx(Modal, { open: !!managePerson, onClose: () => setManagePersonId(''), title: managePerson ? `Access for ${managePerson.greeting_name || managePerson.display_name}` : 'Person access', children: _jsx("div", { className: "form-stack global-access-editor", children: managePerson && _jsxs(_Fragment, { children: [_jsx("p", { className: "modal-intro", children: "This is the same person across every Space below. Change category access here instead of opening each Space individually." }), managePerson.memberships.map(membership => { const space = spaces.find(candidate => candidate.id === membership.space_id); const draft = accessDrafts[membership.space_id] || { role: membership.role === 'admin' ? 'admin' : 'member', permissions: normalizeSpacePermissions(membership.permissions) }; const manageable = canManageSpace(membership.space_id) && membership.role !== 'owner'; const owner = amOwner(membership.space_id); return _jsxs("section", { className: `global-space-access ${manageable ? '' : 'read-only'}`, children: [_jsxs("div", { className: "global-space-access-head", children: [_jsxs("div", { children: [_jsx("strong", { children: space?.name || 'Shared space' }), _jsx("span", { children: manageable ? 'You can manage access here.' : 'Read only from your account.' })] }), _jsx("button", { className: "icon-button subtle", onClick: () => nav(`/spaces/${membership.space_id}`), "aria-label": `Open ${space?.name || 'space'}`, children: _jsx(Home, { size: 15 }) })] }), manageable ? _jsxs(_Fragment, { children: [_jsxs("label", { children: ["Role", _jsxs("select", { value: draft.role, onChange: e => setDraftRole(membership.space_id, e.target.value), disabled: !owner, children: [_jsx("option", { value: "member", children: "Member" }), _jsx("option", { value: "admin", children: "Admin" })] }), !owner && _jsx("small", { children: "Only the Space owner can change admin status." })] }), _jsxs("div", { className: "permission-editor compact", children: [_jsxs("div", { className: "permission-head", children: [_jsx("strong", { children: "Categories" }), _jsx("span", { children: "View / edit" })] }), SPACE_PERMISSION_GROUPS.map(group => _jsxs("div", { className: "permission-row", children: [_jsx("span", { children: group.label }), _jsxs("label", { children: [_jsx("input", { type: "checkbox", checked: draft.permissions[group.view], onChange: e => toggleDraftPermission(membership.space_id, group.view, e.target.checked) }), "View"] }), _jsxs("label", { children: [_jsx("input", { type: "checkbox", checked: draft.permissions[group.edit], onChange: e => toggleDraftPermission(membership.space_id, group.edit, e.target.checked) }), "Edit"] })] }, group.key)), _jsxs("div", { className: "permission-row single", children: [_jsx("span", { children: "Can invite others" }), _jsxs("label", { children: [_jsx("input", { type: "checkbox", checked: draft.permissions.invite_members, onChange: e => toggleDraftPermission(membership.space_id, 'invite_members', e.target.checked) }), "Allow"] })] })] })] }) : _jsxs("div", { className: "access-readonly-summary", children: [_jsx(CheckCircle2, { size: 15 }), memberAccessLabel(membership)] })] }, membership.space_id); }), accessError && _jsx("div", { className: "form-message", children: accessError }), _jsxs("div", { className: "row-actions sticky-modal-actions", children: [_jsxs("button", { className: "secondary-button", onClick: () => setManagePersonId(''), children: [_jsx(X, { size: 16 }), "Cancel"] }), _jsx("button", { className: "primary-button", onClick: savePersonAccess, disabled: accessBusy, children: accessBusy ? 'Saving…' : 'Save access across spaces' })] })] }) }) })] });
}
