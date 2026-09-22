import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { ArrowLeft, CheckCircle2, Copy, Link2, Plus, ShoppingBasket, Users, UserPlus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppData } from '../contexts/AppDataContext.js';
import { ItemCard } from '../components/ItemCard.js';
import { lifeIntentParser } from '../lib/parser.js';
import { Modal } from '../components/Modal.js';
export default function SpacePage() {
    const { id } = useParams();
    const nav = useNavigate();
    const { spaces, members, items, createItem, activity, createInvite } = useAppData();
    const space = spaces.find(s => s.id === id);
    const [text, setText] = useState('');
    const [inviteOpen, setInviteOpen] = useState(false);
    const [email, setEmail] = useState('');
    const [inviteLink, setInviteLink] = useState('');
    const [inviteError, setInviteError] = useState('');
    const spaceMembers = members.filter(m => m.space_id === id);
    const relevant = useMemo(() => items.filter(i => i.space_id === id && i.status === 'open'), [items, id]);
    const shop = relevant.filter(i => i.type === 'shopping');
    const other = relevant.filter(i => i.type !== 'shopping');
    async function add() { if (!text.trim() || !id)
        return; const p = lifeIntentParser.parse(text); await createItem(p, text, { space_id: id }); setText(''); }
    async function makeInvite() { if (!id)
        return; setInviteError(''); try {
        const token = await createInvite(id, email.trim() || undefined);
        setInviteLink(`${location.origin}/life/#/invite/${encodeURIComponent(token)}`);
    }
    catch (e) {
        setInviteError(e instanceof Error ? e.message : 'Could not create invite.');
    } }
    if (!space)
        return _jsx("div", { className: "page", children: _jsxs("div", { className: "large-empty", children: [_jsx("h2", { children: "That space isn\u2019t available." }), _jsx("button", { className: "secondary-button", onClick: () => nav('/spaces'), children: "Back to spaces" })] }) });
    return _jsxs("div", { className: "page", children: [_jsxs("button", { className: "text-button", onClick: () => nav('/spaces'), children: [_jsx(ArrowLeft, { size: 16 }), "Spaces"] }), _jsxs("header", { className: "page-header compact", children: [_jsxs("div", { children: [_jsx("span", { className: "eyebrow", children: "SHARED SPACE" }), _jsx("h1", { children: space.name }), _jsxs("p", { children: [_jsx(Users, { size: 16 }), " ", space.role || 'member', " access \u00B7 updates sync in realtime"] })] }), space.role !== 'member' && _jsxs("button", { className: "secondary-button", onClick: () => setInviteOpen(true), children: [_jsx(UserPlus, { size: 17 }), "Invite"] })] }), _jsxs("div", { className: "space-detail-grid", children: [_jsxs("section", { children: [_jsxs("div", { className: "quick-add", children: [_jsx("input", { value: text, onChange: e => setText(e.target.value), onKeyDown: e => { if (e.key === 'Enter')
                                            add(); }, placeholder: "Add milk, take trash out, remind us\u2026" }), _jsx("button", { className: "primary-button square", onClick: add, disabled: !text.trim(), children: _jsx(Plus, {}) })] }), _jsxs("div", { className: "section-heading inline", children: [_jsxs("h2", { children: [_jsx(ShoppingBasket, { size: 18 }), " Shopping"] }), _jsx("span", { children: shop.length })] }), shop.length ? shop.map(i => _jsx(ItemCard, { item: i }, i.id)) : _jsxs("div", { className: "empty-row", children: [_jsx(CheckCircle2, { size: 16 }), "Your shared list is clear."] }), _jsxs("div", { className: "section-heading inline top-gap", children: [_jsx("h2", { children: "Everything else" }), _jsx("span", { children: other.length })] }), other.length ? other.map(i => _jsx(ItemCard, { item: i }, i.id)) : _jsx("div", { className: "empty-row", children: "No shared tasks waiting." })] }), _jsxs("aside", { className: "context-panel", children: [_jsxs("div", { className: "context-card", children: [_jsx("strong", { children: "Members" }), _jsx("div", { className: "member-list", children: spaceMembers.map(m => _jsxs("div", { className: "member-row", children: [_jsx("span", { className: "member-avatar", children: (m.greeting_name || m.display_name || 'M')[0].toUpperCase() }), _jsxs("span", { children: [_jsx("b", { children: m.greeting_name || m.display_name }), _jsx("small", { children: m.role })] })] }, m.user_id)) })] }), _jsxs("div", { className: "context-card", children: [_jsx("strong", { children: "Recent activity" }), activity.filter(a => a.space_id === id).slice(0, 5).map(a => _jsxs("p", { children: [a.actor_name || 'Someone', " ", a.action, " ", _jsx("b", { children: a.entity_title })] }, a.id)), activity.length === 0 && _jsx("p", { children: "Activity will appear here as members make changes." })] }), _jsxs("div", { className: "context-card", children: [_jsx("strong", { children: "Sharing" }), _jsx("p", { children: "Owners and admins can create email-bound or secure-link invites. Personal spaces can never be shared." })] })] })] }), _jsx(Modal, { open: inviteOpen, onClose: () => { setInviteOpen(false); setInviteLink(''); setInviteError(''); }, title: `Invite to ${space.name}`, children: _jsx("div", { className: "form-stack", children: !inviteLink ? _jsxs(_Fragment, { children: [_jsxs("label", { children: ["Email (optional)", _jsx("input", { type: "email", value: email, onChange: e => setEmail(e.target.value), placeholder: "person@example.com" })] }), _jsx("p", { className: "muted", children: "Leave email blank to create a secure share link. Email delivery is not sent by the browser; copy the generated link into the message service you prefer." }), inviteError && _jsx("div", { className: "form-message", children: inviteError }), _jsxs("button", { className: "primary-button", onClick: makeInvite, children: [_jsx(Link2, { size: 17 }), "Create invite link"] })] }) : _jsxs(_Fragment, { children: [_jsxs("label", { children: ["Secure invite link", _jsx("input", { value: inviteLink, readOnly: true })] }), _jsxs("button", { className: "primary-button", onClick: async () => { await navigator.clipboard.writeText(inviteLink); }, children: [_jsx(Copy, { size: 17 }), "Copy link"] }), _jsx("p", { className: "muted", children: "This token is stored only as a hash in Supabase and expires after seven days." })] }) }) })] });
}
