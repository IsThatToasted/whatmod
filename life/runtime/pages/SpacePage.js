import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { ArrowLeft, CalendarDays, CheckCircle2, Copy, ExternalLink, FolderKanban, Link2, ListPlus, LoaderCircle, Plus, ShieldCheck, ShoppingBasket, Sparkles, StickyNote, UserCog, UserPlus, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppData } from '../contexts/AppDataContext.js';
import { useAuth } from '../contexts/AuthContext.js';
import { ItemCard } from '../components/ItemCard.js';
import { lifeIntentParser } from '../lib/parser.js';
import { DEFAULT_SPACE_PERMISSIONS, normalizeSpacePermissions, SPACE_PERMISSION_GROUPS } from '../lib/spacePermissions.js';
import { extractFirstUrl, fetchProductPreview, formatMoney, suggestShoppingList } from '../lib/productLinks.js';
import { Modal } from '../components/Modal.js';
export default function SpacePage() {
    const { id } = useParams();
    const nav = useNavigate();
    const { userId, user, demo } = useAuth();
    const { spaces, members, items, createItem, activity, createInvite, shoppingLists, createShoppingList, updateMemberAccess, collaborationAvailable } = useAppData();
    const space = spaces.find(s => s.id === id);
    const [text, setText] = useState('');
    const [inviteOpen, setInviteOpen] = useState(false);
    const [email, setEmail] = useState('');
    const [inviteRole, setInviteRole] = useState('member');
    const [invitePermissions, setInvitePermissions] = useState({ ...DEFAULT_SPACE_PERMISSIONS });
    const [inviteLink, setInviteLink] = useState('');
    const [inviteExpiry, setInviteExpiry] = useState('');
    const [inviteError, setInviteError] = useState('');
    const [inviteSaving, setInviteSaving] = useState(false);
    const [listOpen, setListOpen] = useState(false);
    const [listName, setListName] = useState('');
    const [listError, setListError] = useState('');
    const [selectedList, setSelectedList] = useState('');
    const [manageMember, setManageMember] = useState(null);
    const [memberPermissions, setMemberPermissions] = useState({ ...DEFAULT_SPACE_PERMISSIONS });
    const [memberRole, setMemberRole] = useState('member');
    const [memberError, setMemberError] = useState('');
    const [memberSaving, setMemberSaving] = useState(false);
    const [shoppingInput, setShoppingInput] = useState('');
    const [shoppingPreview, setShoppingPreview] = useState(null);
    const [shoppingBusy, setShoppingBusy] = useState(false);
    const [shoppingError, setShoppingError] = useState('');
    const [shoppingDestination, setShoppingDestination] = useState('');
    const spaceMembers = members.filter(m => m.space_id === id);
    const me = spaceMembers.find(m => m.user_id === userId);
    const canManage = space?.role === 'owner' || space?.role === 'admin' || me?.role === 'owner' || me?.role === 'admin';
    const myPermissions = canManage ? normalizeSpacePermissions(DEFAULT_SPACE_PERMISSIONS) : normalizeSpacePermissions(me?.permissions);
    const canInvite = !space?.is_personal && (canManage || myPermissions.invite_members);
    const relevant = useMemo(() => items.filter(i => i.space_id === id && i.status === 'open'), [items, id]);
    const allShopping = relevant.filter(i => i.type === 'shopping');
    const other = relevant.filter(i => i.type !== 'shopping');
    const lists = useMemo(() => shoppingLists.filter(list => list.space_id === id && !list.archived_at), [shoppingLists, id]);
    const activeList = selectedList || lists[0]?.id || 'general';
    const shop = activeList === 'general' ? allShopping.filter(item => !item.shopping?.list_id) : allShopping.filter(item => item.shopping?.list_id === activeList);
    const proposed = useMemo(() => text.trim() ? lifeIntentParser.parse(text) : null, [text]);
    const canAdd = proposed?.type === 'shopping' ? myPermissions.edit_shopping : myPermissions.edit_tasks;
    const productUrl = useMemo(() => extractFirstUrl(shoppingInput), [shoppingInput]);
    const destinationList = shoppingDestination || activeList;
    const suggestion = useMemo(() => shoppingPreview ? suggestShoppingList(shoppingPreview, lists) : null, [shoppingPreview, lists]);
    useEffect(() => { if (!selectedList && lists[0])
        setSelectedList(lists[0].id); }, [selectedList, lists]);
    useEffect(() => { if (!shoppingInput.trim())
        setShoppingDestination(activeList); }, [activeList, shoppingInput]);
    useEffect(() => {
        if (!productUrl) {
            setShoppingPreview(null);
            setShoppingBusy(false);
            setShoppingError('');
            return;
        }
        let cancelled = false;
        setShoppingBusy(true);
        setShoppingError('');
        const timer = setTimeout(() => {
            void fetchProductPreview(productUrl).then(preview => {
                if (cancelled)
                    return;
                setShoppingPreview(preview);
                const suggested = suggestShoppingList(preview, lists);
                if (suggested.list && suggested.confidence >= .3)
                    setShoppingDestination(suggested.list.id);
                else
                    setShoppingDestination(activeList);
            }).catch(() => { if (!cancelled)
                setShoppingError('Could not inspect that product link. You can still save it manually.'); }).finally(() => { if (!cancelled)
                setShoppingBusy(false); });
        }, 350);
        return () => { cancelled = true; clearTimeout(timer); };
    }, [productUrl, lists, activeList]);
    async function add() {
        if (!text.trim() || !id || !proposed)
            return;
        const shopping = proposed.type === 'shopping' ? { preferred_store: proposed.context || null, ...(collaborationAvailable && activeList !== 'general' ? { list_id: activeList } : {}) } : undefined;
        await createItem(proposed, text, { space_id: id, shopping });
        setText('');
    }
    async function addShopping() {
        if (!shoppingInput.trim() || !id || !myPermissions.edit_shopping)
            return;
        setShoppingError('');
        try {
            const url = extractFirstUrl(shoppingInput);
            let preview = shoppingPreview;
            if (url && !preview) {
                setShoppingBusy(true);
                preview = await fetchProductPreview(url);
                setShoppingPreview(preview);
            }
            const title = preview?.title || shoppingInput.replace(url || '', '').trim() || shoppingInput.trim();
            const base = lifeIntentParser.parse(`buy ${title}`);
            const parsed = { ...base, type: 'shopping', title, context: preview?.store || base.context, tags: [...new Set([...(base.tags || []), 'shopping', ...(url ? ['product-link'] : [])])] };
            const target = destinationList === 'general' ? null : destinationList;
            await createItem(parsed, shoppingInput, {
                space_id: id,
                description: preview?.description || null,
                shopping: {
                    quantity: 1,
                    preferred_store: preview?.store || base.context || null,
                    estimated_price: preview?.price ?? null,
                    aisle_category: preview?.category || null,
                    list_id: target,
                    source_url: preview?.canonical_url || preview?.url || url || null,
                    image_url: preview?.image_url || null,
                    currency: preview?.currency || null,
                    product_id: preview?.product_id || null,
                    product_metadata: preview ? { brand: preview.brand || null, description: preview.description || null, source: preview.source, ...(preview.metadata || {}) } : {},
                }
            });
            if (target)
                setSelectedList(target);
            else
                setSelectedList('general');
            setShoppingInput('');
            setShoppingPreview(null);
            setShoppingDestination('');
            setShoppingError('');
        }
        catch (e) {
            setShoppingError(e instanceof Error ? e.message : 'Could not add that shopping item.');
        }
        finally {
            setShoppingBusy(false);
        }
    }
    async function makeInvite() {
        if (!id)
            return;
        setInviteError('');
        setInviteSaving(true);
        try {
            const result = await createInvite(id, email.trim() || undefined, inviteRole, invitePermissions);
            setInviteLink(`${location.origin}/life/#/invite/${encodeURIComponent(result.token)}`);
            setInviteExpiry(result.expires_at);
        }
        catch (e) {
            setInviteError(e instanceof Error ? e.message : 'Could not create invite.');
        }
        finally {
            setInviteSaving(false);
        }
    }
    async function makeList() {
        if (!id || !listName.trim())
            return;
        setListError('');
        try {
            const created = await createShoppingList(id, listName.trim());
            setSelectedList(created.id);
            setListName('');
            setListOpen(false);
        }
        catch (e) {
            setListError(e instanceof Error ? e.message : 'Could not create list.');
        }
    }
    function startManage(member) { setManageMember(member); setMemberPermissions(normalizeSpacePermissions(member.permissions)); setMemberRole(member.role === 'admin' ? 'admin' : 'member'); setMemberError(''); }
    async function saveMember() {
        if (!id || !manageMember)
            return;
        setMemberSaving(true);
        setMemberError('');
        try {
            await updateMemberAccess(id, manageMember.user_id, memberPermissions, memberRole);
            setManageMember(null);
        }
        catch (e) {
            setMemberError(e instanceof Error ? e.message : 'Could not update access.');
        }
        finally {
            setMemberSaving(false);
        }
    }
    function togglePermission(target, key, value) {
        const set = target === 'invite' ? setInvitePermissions : setMemberPermissions;
        set(current => {
            const next = { ...current, [key]: value };
            if (String(key).startsWith('view_') && !value) {
                const edit = `edit_${String(key).slice(5)}`;
                if (edit in next)
                    next[edit] = false;
            }
            if (String(key).startsWith('edit_') && value) {
                const view = `view_${String(key).slice(5)}`;
                if (view in next)
                    next[view] = true;
            }
            return next;
        });
    }
    if (!space)
        return _jsx("div", { className: "page", children: _jsxs("div", { className: "large-empty", children: [_jsx("h2", { children: "That space isn\u2019t available." }), _jsx("button", { className: "secondary-button", onClick: () => nav('/spaces'), children: "Back to spaces" })] }) });
    return _jsxs("div", { className: "page", children: [_jsxs("button", { className: "text-button", onClick: () => nav('/spaces'), children: [_jsx(ArrowLeft, { size: 16 }), "Spaces"] }), _jsxs("header", { className: "page-header compact", children: [_jsxs("div", { children: [_jsx("span", { className: "eyebrow", children: "SHARED SPACE" }), _jsx("h1", { children: space.name }), _jsxs("p", { children: [_jsx(Users, { size: 16 }), " ", space.role || me?.role || 'member', " access \u00B7 updates sync in realtime"] })] }), canInvite && _jsxs("button", { className: "secondary-button", onClick: () => { setInvitePermissions({ ...myPermissions }); setInviteOpen(true); }, children: [_jsx(UserPlus, { size: 17 }), "Invite"] })] }), demo && _jsxs("div", { className: "migration-banner", children: [_jsx("strong", { children: "You are viewing demo data." }), _jsx("span", { children: "Demo mode cannot create invite links for other people. Sign in to the Supabase-backed app to use real shared spaces." })] }), !collaborationAvailable && _jsxs("div", { className: "migration-banner", children: [_jsx("strong", { children: "Shared-space upgrade is not active yet." }), _jsxs("span", { children: ["Run ", _jsx("code", { children: "003_shared_spaces_smart_intake.sql" }), " in Supabase. Existing data stays intact."] })] }), _jsxs("div", { className: "space-access-strip", children: [_jsxs("span", { children: [_jsx(ShieldCheck, { size: 15 }), demo ? 'Demo mode' : user?.email || 'Signed in'] }), _jsx("span", { children: space.role || me?.role || 'member' }), SPACE_PERMISSION_GROUPS.filter(group => myPermissions[group.view]).map(group => _jsx("span", { children: group.label }, group.key)), canInvite && _jsx("span", { children: "Invites" })] }), _jsxs("div", { className: "space-detail-grid", children: [_jsxs("section", { children: [_jsxs("div", { className: "quick-add", children: [_jsx("input", { value: text, onChange: e => setText(e.target.value), onKeyDown: e => { if (e.key === 'Enter' && canAdd)
                                            void add(); }, placeholder: "Add a task, reminder, chore\u2026" }), _jsx("button", { className: "primary-button square", onClick: add, disabled: !text.trim() || !canAdd, children: _jsx(Plus, {}) })] }), proposed && !canAdd && _jsx("div", { className: "permission-note", children: "Your access allows you to view this category, but not add or edit it." }), myPermissions.view_shopping && _jsxs(_Fragment, { children: [_jsxs("div", { className: "section-heading inline", children: [_jsxs("h2", { children: [_jsx(ShoppingBasket, { size: 18 }), " Shopping lists"] }), myPermissions.edit_shopping && _jsxs("button", { className: "mini-action", onClick: () => setListOpen(true), children: [_jsx(ListPlus, { size: 15 }), "New list"] })] }), _jsxs("div", { className: "shopping-list-tabs", children: [lists.map(list => _jsxs("button", { className: activeList === list.id ? 'active' : '', onClick: () => setSelectedList(list.id), children: [list.name, _jsx("span", { children: allShopping.filter(item => item.shopping?.list_id === list.id).length })] }, list.id)), _jsxs("button", { className: activeList === 'general' ? 'active' : '', onClick: () => setSelectedList('general'), children: ["General", _jsx("span", { children: allShopping.filter(item => !item.shopping?.list_id).length })] })] }), myPermissions.edit_shopping && _jsxs("div", { className: "smart-shopping-box", children: [_jsxs("div", { className: "smart-shopping-input", children: [_jsx(Sparkles, { size: 17 }), _jsx("input", { value: shoppingInput, onChange: e => setShoppingInput(e.target.value), onKeyDown: e => { if (e.key === 'Enter' && !shoppingBusy)
                                                            void addShopping(); }, placeholder: `Add to ${lists.find(list => list.id === activeList)?.name || 'General'} or paste a product link…` }), _jsxs("button", { className: "primary-button", onClick: addShopping, disabled: !shoppingInput.trim() || shoppingBusy, children: [shoppingBusy ? _jsx(LoaderCircle, { className: "spin", size: 17 }) : _jsx(Plus, { size: 17 }), "Add"] })] }), productUrl && _jsxs("div", { className: "product-link-preview", children: [shoppingPreview?.image_url ? _jsx("img", { src: shoppingPreview.image_url, alt: "", referrerPolicy: "no-referrer" }) : _jsx("div", { className: "product-image-placeholder", children: _jsx(ShoppingBasket, { size: 22 }) }), _jsxs("div", { className: "product-preview-main", children: [_jsx("span", { className: "eyebrow", children: "PRODUCT LINK" }), _jsx("strong", { children: shoppingPreview?.title || (shoppingBusy ? 'Reading product…' : 'Product link') }), _jsxs("div", { className: "product-preview-meta", children: [_jsx("span", { children: shoppingPreview?.store || new URL(productUrl).hostname.replace(/^www\./, '') }), formatMoney(shoppingPreview?.price, shoppingPreview?.currency) && _jsx("span", { children: formatMoney(shoppingPreview?.price, shoppingPreview?.currency) }), shoppingPreview?.brand && _jsx("span", { children: shoppingPreview.brand })] }), shoppingPreview?.source === 'url-fallback' && !shoppingBusy && _jsx("small", { children: "Basic link preview only. Deploy the included product-preview Edge Function for server-side title/image/price extraction; the Chrome extension captures page metadata directly." }), suggestion?.list && suggestion.confidence >= .3 && _jsxs("small", { children: [_jsx(Sparkles, { size: 12 }), "Looks like ", _jsx("b", { children: suggestion.list.name }), suggestion.reason ? ` · matched ${suggestion.reason}` : ''] })] }), _jsxs("div", { className: "product-preview-actions", children: [_jsxs("label", { children: ["Save to", _jsxs("select", { value: destinationList, onChange: e => setShoppingDestination(e.target.value), children: [lists.map(list => _jsx("option", { value: list.id, children: list.name }, list.id)), _jsx("option", { value: "general", children: "General" })] })] }), _jsx("a", { className: "icon-button", href: productUrl, target: "_blank", rel: "noreferrer", "aria-label": "Open product", children: _jsx(ExternalLink, { size: 17 }) })] })] }), shoppingError && _jsx("div", { className: "form-message", children: shoppingError })] }), shop.length ? shop.map(i => _jsx(ItemCard, { item: i }, i.id)) : _jsxs("div", { className: "empty-row", children: [_jsx(CheckCircle2, { size: 16 }), "This shopping list is clear."] })] }), myPermissions.view_tasks && _jsxs(_Fragment, { children: [_jsxs("div", { className: "section-heading inline top-gap", children: [_jsx("h2", { children: "Tasks & chores" }), _jsx("span", { children: other.length })] }), other.length ? other.map(i => _jsx(ItemCard, { item: i }, i.id)) : _jsx("div", { className: "empty-row", children: "No shared tasks waiting." })] })] }), _jsxs("aside", { className: "context-panel", children: [_jsxs("div", { className: "context-card", children: [_jsx("strong", { children: "Members" }), _jsx("div", { className: "member-list", children: spaceMembers.map(m => _jsxs("div", { className: "member-row member-row-manage", children: [_jsx("span", { className: "member-avatar", children: (m.greeting_name || m.display_name || 'M')[0].toUpperCase() }), _jsxs("span", { children: [_jsx("b", { children: m.greeting_name || m.display_name }), _jsxs("small", { children: [m.role, m.user_id === userId ? ' · you' : ''] })] }), canManage && m.role !== 'owner' && _jsx("button", { className: "member-manage-button", onClick: () => startManage(m), "aria-label": `Manage ${m.display_name}`, children: _jsx(UserCog, { size: 15 }) })] }, m.user_id)) })] }), _jsxs("div", { className: "context-card", children: [_jsx("strong", { children: "Recent activity" }), activity.filter(a => a.space_id === id).slice(0, 5).map(a => _jsxs("p", { children: [a.actor_name || 'Someone', " ", a.action, " ", _jsx("b", { children: a.entity_title })] }, a.id)), activity.filter(a => a.space_id === id).length === 0 && _jsx("p", { children: "Activity will appear here as members make changes." })] }), _jsxs("div", { className: "context-card", children: [_jsx("strong", { children: "Category access" }), _jsxs("div", { className: "access-summary", children: [_jsxs("span", { children: [_jsx(ShoppingBasket, { size: 14 }), "Shopping"] }), _jsxs("span", { children: [_jsx(CheckCircle2, { size: 14 }), "Tasks"] }), _jsxs("span", { children: [_jsx(CalendarDays, { size: 14 }), "Calendar"] }), _jsxs("span", { children: [_jsx(StickyNote, { size: 14 }), "Thoughts/files"] }), _jsxs("span", { children: [_jsx(FolderKanban, { size: 14 }), "Projects"] })] }), _jsx("p", { children: "Owners and admins can decide which categories each member can view or change." })] }), _jsxs("div", { className: "context-card", children: [_jsx("strong", { children: "Smart shopping" }), _jsx("p", { children: "Paste a product URL into a shopping list. JustGlance will keep the link, preview data, price and image when available, and suggest the best named list." })] }), !canInvite && _jsxs("div", { className: "context-card", children: [_jsx("strong", { children: "Invites" }), _jsx("p", { children: "You\u2019re signed in as a member of this space. An owner/admin must enable invite permission before this account can create links." })] })] })] }), _jsx(Modal, { open: inviteOpen, onClose: () => { setInviteOpen(false); setInviteLink(''); setInviteExpiry(''); setInviteError(''); }, title: `Invite to ${space.name}`, children: _jsx("div", { className: "form-stack", children: !inviteLink ? _jsxs(_Fragment, { children: [_jsxs("label", { children: ["Email (optional)", _jsx("input", { type: "email", value: email, onChange: e => setEmail(e.target.value), placeholder: "person@example.com" })] }), (space.role === 'owner' || me?.role === 'owner') && _jsxs("label", { children: ["Role", _jsxs("select", { value: inviteRole, onChange: e => setInviteRole(e.target.value), children: [_jsx("option", { value: "member", children: "Member" }), _jsx("option", { value: "admin", children: "Admin" })] })] }), _jsxs("div", { className: "permission-editor", children: [_jsxs("div", { className: "permission-head", children: [_jsx("strong", { children: "Category permissions" }), _jsx("span", { children: "View / change" })] }), SPACE_PERMISSION_GROUPS.map(group => _jsxs("div", { className: "permission-row", children: [_jsx("span", { children: group.label }), _jsxs("label", { children: [_jsx("input", { type: "checkbox", checked: invitePermissions[group.view], onChange: e => togglePermission('invite', group.view, e.target.checked) }), "View"] }), _jsxs("label", { children: [_jsx("input", { type: "checkbox", checked: invitePermissions[group.edit], onChange: e => togglePermission('invite', group.edit, e.target.checked) }), "Edit"] })] }, group.key)), _jsxs("div", { className: "permission-row single", children: [_jsx("span", { children: "Can create invite links" }), _jsxs("label", { children: [_jsx("input", { type: "checkbox", checked: invitePermissions.invite_members, onChange: e => togglePermission('invite', 'invite_members', e.target.checked) }), "Allow"] })] })] }), _jsx("p", { className: "muted", children: "Leave email blank for a shareable link. Email-bound links only work for that signed-in email." }), inviteError && _jsx("div", { className: "form-message", children: inviteError }), _jsxs("button", { className: "primary-button", onClick: makeInvite, disabled: inviteSaving, children: [_jsx(Link2, { size: 17 }), inviteSaving ? 'Creating…' : 'Create invite link'] })] }) : _jsxs(_Fragment, { children: [_jsxs("label", { children: ["Secure invite link", _jsx("input", { value: inviteLink, readOnly: true })] }), _jsxs("button", { className: "primary-button", onClick: async () => { await navigator.clipboard.writeText(inviteLink); }, children: [_jsx(Copy, { size: 17 }), "Copy link"] }), _jsxs("p", { className: "muted", children: ["Expires ", inviteExpiry ? new Date(inviteExpiry).toLocaleString() : 'in seven days', ". The raw token is only shown here; Supabase stores its hash."] })] }) }) }), _jsx(Modal, { open: listOpen, onClose: () => { setListOpen(false); setListError(''); }, title: "New shopping list", children: _jsxs("div", { className: "form-stack", children: [_jsxs("label", { children: ["List name", _jsx("input", { autoFocus: true, value: listName, onChange: e => setListName(e.target.value), onKeyDown: e => { if (e.key === 'Enter')
                                        void makeList(); }, placeholder: "Groceries, Lingerie/Panties, Heels\u2026" })] }), listError && _jsx("div", { className: "form-message", children: listError }), _jsxs("button", { className: "primary-button", disabled: !listName.trim(), onClick: makeList, children: [_jsx(ListPlus, { size: 17 }), "Create list"] })] }) }), _jsx(Modal, { open: !!manageMember, onClose: () => setManageMember(null), title: manageMember ? `Access for ${manageMember.greeting_name || manageMember.display_name}` : 'Member access', children: _jsx("div", { className: "form-stack", children: manageMember && _jsxs(_Fragment, { children: [(space.role === 'owner' || me?.role === 'owner') && _jsxs("label", { children: ["Role", _jsxs("select", { value: memberRole, onChange: e => setMemberRole(e.target.value), children: [_jsx("option", { value: "member", children: "Member" }), _jsx("option", { value: "admin", children: "Admin" })] })] }), _jsxs("div", { className: "permission-editor", children: [_jsxs("div", { className: "permission-head", children: [_jsx("strong", { children: "Category permissions" }), _jsx("span", { children: "View / change" })] }), SPACE_PERMISSION_GROUPS.map(group => _jsxs("div", { className: "permission-row", children: [_jsx("span", { children: group.label }), _jsxs("label", { children: [_jsx("input", { type: "checkbox", checked: memberPermissions[group.view], onChange: e => togglePermission('member', group.view, e.target.checked) }), "View"] }), _jsxs("label", { children: [_jsx("input", { type: "checkbox", checked: memberPermissions[group.edit], onChange: e => togglePermission('member', group.edit, e.target.checked) }), "Edit"] })] }, group.key)), _jsxs("div", { className: "permission-row single", children: [_jsx("span", { children: "Can create invite links" }), _jsxs("label", { children: [_jsx("input", { type: "checkbox", checked: memberPermissions.invite_members, onChange: e => togglePermission('member', 'invite_members', e.target.checked) }), "Allow"] })] })] }), memberError && _jsx("div", { className: "form-message", children: memberError }), _jsx("button", { className: "primary-button", onClick: saveMember, disabled: memberSaving, children: memberSaving ? 'Saving…' : 'Save access' })] }) }) })] });
}
