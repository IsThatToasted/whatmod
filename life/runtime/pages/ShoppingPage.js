import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { CheckCircle2, ExternalLink, ListPlus, LoaderCircle, Pencil, Plus, Settings2, ShoppingBasket, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ItemCard } from '../components/ItemCard.js';
import { Modal } from '../components/Modal.js';
import { useAppData } from '../contexts/AppDataContext.js';
import { useAuth } from '../contexts/AuthContext.js';
import { lifeIntentParser } from '../lib/parser.js';
import { extractFirstUrl, fetchProductPreview, formatMoney, suggestShoppingList } from '../lib/productLinks.js';
import { DEFAULT_SPACE_PERMISSIONS, normalizeSpacePermissions } from '../lib/spacePermissions.js';
export default function ShoppingPage() {
    const { userId } = useAuth();
    const { spaces, members, items, shoppingLists, createShoppingList, updateShoppingList, archiveShoppingList, createItem, collaborationAvailable } = useAppData();
    const nav = useNavigate();
    const [params, setParams] = useSearchParams();
    const requested = params.get('space') || '';
    const [selectedSpace, setSelectedSpace] = useState(requested);
    const [selectedList, setSelectedList] = useState('');
    const [listOpen, setListOpen] = useState(false), [listName, setListName] = useState(''), [listError, setListError] = useState('');
    const [editingList, setEditingList] = useState(null), [editingListName, setEditingListName] = useState('');
    const [shoppingInput, setShoppingInput] = useState(''), [shoppingPreview, setShoppingPreview] = useState(null), [shoppingBusy, setShoppingBusy] = useState(false), [shoppingError, setShoppingError] = useState(''), [shoppingDestination, setShoppingDestination] = useState('');
    const allowedSpaces = useMemo(() => spaces.filter(space => {
        const member = members.find(m => m.space_id === space.id && m.user_id === userId);
        const elevated = space.is_personal || space.name === 'Personal' || space.role === 'owner' || space.role === 'admin' || member?.role === 'owner' || member?.role === 'admin';
        return elevated || normalizeSpacePermissions(member?.permissions).view_shopping;
    }), [spaces, members, userId]);
    useEffect(() => {
        const next = (requested && allowedSpaces.some(space => space.id === requested) ? requested : '') || selectedSpace || allowedSpaces[0]?.id || '';
        if (next !== selectedSpace)
            setSelectedSpace(next);
    }, [requested, allowedSpaces, selectedSpace]);
    useEffect(() => {
        if (selectedSpace && params.get('space') !== selectedSpace) {
            const next = new URLSearchParams(params);
            next.set('space', selectedSpace);
            setParams(next, { replace: true });
        }
        setSelectedList('');
    }, [selectedSpace]);
    const space = allowedSpaces.find(candidate => candidate.id === selectedSpace) || allowedSpaces[0];
    const member = space ? members.find(m => m.space_id === space.id && m.user_id === userId) : undefined;
    const elevated = !!space && (space.is_personal || space.name === 'Personal' || space.role === 'owner' || space.role === 'admin' || member?.role === 'owner' || member?.role === 'admin');
    const permissions = elevated ? normalizeSpacePermissions(DEFAULT_SPACE_PERMISSIONS) : normalizeSpacePermissions(member?.permissions);
    const canEdit = elevated || permissions.edit_shopping;
    const lists = useMemo(() => shoppingLists.filter(list => list.space_id === space?.id && !list.archived_at), [shoppingLists, space?.id]);
    const activeList = selectedList || lists[0]?.id || 'general';
    const allShopping = useMemo(() => items.filter(item => item.type === 'shopping' && item.status === 'open' && (space?.is_personal || space?.name === 'Personal' ? (item.space_id === space.id || !item.space_id) : item.space_id === space?.id)), [items, space]);
    const visible = activeList === 'general' ? allShopping.filter(item => !item.shopping?.list_id) : allShopping.filter(item => item.shopping?.list_id === activeList);
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
                setShoppingDestination(suggested.list && suggested.confidence >= .3 ? suggested.list.id : activeList);
            }).catch(() => { if (!cancelled)
                setShoppingError('Could not inspect that product link. You can still save it manually.'); }).finally(() => { if (!cancelled)
                setShoppingBusy(false); });
        }, 300);
        return () => { cancelled = true; clearTimeout(timer); };
    }, [productUrl, lists, activeList]);
    async function addShopping() {
        if (!space || !shoppingInput.trim() || !canEdit)
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
            await createItem(parsed, shoppingInput, { space_id: space.id, description: preview?.description || null, shopping: { quantity: 1, preferred_store: preview?.store || base.context || null, estimated_price: preview?.price ?? null, aisle_category: preview?.category || null, list_id: target, source_url: preview?.canonical_url || preview?.url || url || null, image_url: preview?.image_url || null, currency: preview?.currency || null, product_id: preview?.product_id || null, product_metadata: preview ? { brand: preview.brand || null, description: preview.description || null, source: preview.source, ...(preview.metadata || {}) } : {} } });
            setSelectedList(target || 'general');
            setShoppingInput('');
            setShoppingPreview(null);
            setShoppingDestination('');
        }
        catch (e) {
            setShoppingError(e instanceof Error ? e.message : 'Could not add that shopping item.');
        }
        finally {
            setShoppingBusy(false);
        }
    }
    async function makeList() { if (!space || !listName.trim())
        return; setListError(''); try {
        const created = await createShoppingList(space.id, listName.trim());
        setSelectedList(created.id);
        setListName('');
        setListOpen(false);
    }
    catch (e) {
        setListError(e instanceof Error ? e.message : 'Could not create list.');
    } }
    function beginEditList(list) { setEditingList(list); setEditingListName(list.name); }
    async function saveList() { if (!editingList || !editingListName.trim())
        return; await updateShoppingList(editingList.id, { name: editingListName.trim() }); setEditingList(null); }
    async function removeList() { if (!editingList)
        return; await archiveShoppingList(editingList.id); if (selectedList === editingList.id)
        setSelectedList('general'); setEditingList(null); }
    return _jsxs("div", { className: "page organizer-page shopping-page", children: [_jsxs("header", { className: "page-header", children: [_jsxs("div", { children: [_jsx("span", { className: "eyebrow", children: "SHOPPING" }), _jsx("h1", { children: "Every list, one place." }), _jsx("p", { children: "Groceries, wish lists, product links and shared shopping stay here instead of being buried inside a Space." })] }), space && !space.is_personal && space.name !== 'Personal' && _jsxs("button", { className: "secondary-button", onClick: () => nav(`/spaces/${space.id}`), children: [_jsx(Settings2, { size: 17 }), "Manage ", space.name] })] }), !collaborationAvailable && _jsxs("div", { className: "migration-banner", children: [_jsx("strong", { children: "Named shopping lists need the collaboration schema." }), _jsx("span", { children: "Run the current master schema repair in Supabase." })] }), _jsx("div", { className: "shopping-space-switcher", children: allowedSpaces.map(candidate => _jsxs("button", { className: candidate.id === space?.id ? 'active' : '', onClick: () => setSelectedSpace(candidate.id), children: [_jsx("span", { children: candidate.name }), candidate.name !== 'Personal' && !candidate.is_personal && _jsx("small", { children: "shared" })] }, candidate.id)) }), !space ? _jsxs("div", { className: "empty-state large", children: [_jsx(ShoppingBasket, {}), _jsx("strong", { children: "No shopping space yet." }), _jsx("span", { children: "Create a Space first, then shopping lists can live inside it." })] }) : _jsx(_Fragment, { children: _jsxs("section", { className: "panel-card shopping-workspace", children: [_jsxs("div", { className: "section-heading inline", children: [_jsxs("div", { children: [_jsx("span", { className: "eyebrow", children: space.name }), _jsx("h2", { children: "Shopping lists" })] }), canEdit && _jsxs("button", { className: "mini-action", onClick: () => setListOpen(true), children: [_jsx(ListPlus, { size: 15 }), "New list"] })] }), _jsxs("div", { className: "shopping-list-tabs managed-tabs", children: [lists.map(list => _jsxs("div", { className: "shopping-list-tab-wrap", children: [_jsxs("button", { className: activeList === list.id ? 'active' : '', onClick: () => setSelectedList(list.id), children: [list.name, _jsx("span", { children: allShopping.filter(item => item.shopping?.list_id === list.id).length })] }), canEdit && _jsx("button", { className: "shopping-list-edit", onClick: () => beginEditList(list), "aria-label": `Edit ${list.name}`, children: _jsx(Pencil, { size: 13 }) })] }, list.id)), _jsxs("button", { className: activeList === 'general' ? 'active' : '', onClick: () => setSelectedList('general'), children: ["General", _jsx("span", { children: allShopping.filter(item => !item.shopping?.list_id).length })] })] }), canEdit ? _jsxs("div", { className: "smart-shopping-box", children: [_jsxs("div", { className: "smart-shopping-input", children: [_jsx(Sparkles, { size: 17 }), _jsx("input", { value: shoppingInput, onChange: e => setShoppingInput(e.target.value), onKeyDown: e => { if (e.key === 'Enter' && !shoppingBusy)
                                                void addShopping(); }, placeholder: `Add to ${lists.find(list => list.id === activeList)?.name || 'General'} or paste a product link…` }), _jsxs("button", { className: "primary-button", onClick: addShopping, disabled: !shoppingInput.trim() || shoppingBusy, children: [shoppingBusy ? _jsx(LoaderCircle, { className: "spin", size: 17 }) : _jsx(Plus, { size: 17 }), "Add"] })] }), productUrl && _jsxs("div", { className: "product-link-preview", children: [shoppingPreview?.image_url ? _jsx("img", { src: shoppingPreview.image_url, alt: "", referrerPolicy: "no-referrer" }) : _jsx("div", { className: "product-image-placeholder", children: _jsx(ShoppingBasket, { size: 22 }) }), _jsxs("div", { className: "product-preview-main", children: [_jsx("span", { className: "eyebrow", children: "PRODUCT LINK" }), _jsx("strong", { children: shoppingPreview?.title || (shoppingBusy ? 'Reading product…' : 'Product link') }), _jsxs("div", { className: "product-preview-meta", children: [_jsx("span", { children: shoppingPreview?.store || new URL(productUrl).hostname.replace(/^www\./, '') }), formatMoney(shoppingPreview?.price, shoppingPreview?.currency) && _jsx("span", { children: formatMoney(shoppingPreview?.price, shoppingPreview?.currency) }), shoppingPreview?.brand && _jsx("span", { children: shoppingPreview.brand })] }), shoppingPreview?.source === 'url-fallback' && !shoppingBusy && _jsx("small", { children: "Basic preview only. The product-preview Edge Function or Chrome extension can extract richer title, image and price data." }), suggestion?.list && suggestion.confidence >= .3 && _jsxs("small", { children: [_jsx(Sparkles, { size: 12 }), "Looks like ", _jsx("b", { children: suggestion.list.name }), suggestion.reason ? ` · matched ${suggestion.reason}` : ''] })] }), _jsxs("div", { className: "product-preview-actions", children: [_jsxs("label", { children: ["Save to", _jsxs("select", { value: destinationList, onChange: e => setShoppingDestination(e.target.value), children: [lists.map(list => _jsx("option", { value: list.id, children: list.name }, list.id)), _jsx("option", { value: "general", children: "General" })] })] }), _jsx("a", { className: "icon-button", href: productUrl, target: "_blank", rel: "noreferrer", "aria-label": "Open product", children: _jsx(ExternalLink, { size: 17 }) })] })] }), shoppingError && _jsx("div", { className: "form-message", children: shoppingError })] }) : _jsx("div", { className: "permission-note", children: "You can view shopping in this Space, but your permissions do not allow changes." }), _jsx("div", { className: "item-stack", children: visible.map(item => _jsx(ItemCard, { item: item }, item.id)) }), !visible.length && _jsxs("div", { className: "empty-row", children: [_jsx(CheckCircle2, { size: 16 }), "This list is clear."] })] }) }), _jsx(Modal, { open: listOpen, onClose: () => { setListOpen(false); setListError(''); }, title: "New shopping list", children: _jsxs("div", { className: "form-stack", children: [_jsxs("label", { children: ["List name", _jsx("input", { autoFocus: true, value: listName, onChange: e => setListName(e.target.value), onKeyDown: e => { if (e.key === 'Enter')
                                        void makeList(); }, placeholder: "Groceries, Lingerie/Panties, Heels\u2026" })] }), listError && _jsx("div", { className: "form-message", children: listError }), _jsxs("button", { className: "primary-button", disabled: !listName.trim(), onClick: makeList, children: [_jsx(ListPlus, { size: 17 }), "Create list"] })] }) }), _jsx(Modal, { open: !!editingList, onClose: () => setEditingList(null), title: "Edit shopping list", children: _jsxs("div", { className: "form-stack", children: [_jsxs("label", { children: ["List name", _jsx("input", { autoFocus: true, value: editingListName, onChange: e => setEditingListName(e.target.value) })] }), _jsxs("div", { className: "row-actions", children: [_jsx("button", { className: "text-button danger-text", onClick: removeList, children: "Archive list" }), _jsx("button", { className: "primary-button", onClick: saveList, disabled: !editingListName.trim(), children: "Save changes" })] })] }) })] });
}
