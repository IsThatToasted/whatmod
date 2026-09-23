import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Building2, Cake, Mail, MapPin, Phone, Plus, Search, Trash2, Upload, UserRound, X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useAppData } from '../contexts/AppDataContext.js';
import { Modal } from '../components/Modal.js';
import { contactPrimaryAddress, contactPrimaryEmail, contactPrimaryPhone, dialHref, mailHref, mapHref, parseVCardContacts } from '../lib/contacts.js';
const blank = () => ({ display_name: '', first_name: '', last_name: '', nickname: '', relationship: '', company: '', job_title: '', email_personal: '', email_work: '', phone_mobile: '', phone_home: '', phone_work: '', address_home: '', address_business: '', birthday: '', notes: '', tags: [] });
export default function ContactsPage() {
    const { contacts, createContact, updateContact, deleteContact } = useAppData();
    const [query, setQuery] = useState(''), [editing, setEditing] = useState(null), [creating, setCreating] = useState(false), [form, setForm] = useState(blank()), [error, setError] = useState(''), [importMessage, setImportMessage] = useState('');
    const fileRef = useRef(null);
    const filtered = useMemo(() => { const q = query.trim().toLowerCase(); return !q ? contacts : contacts.filter(c => `${c.display_name} ${c.nickname || ''} ${c.company || ''} ${c.relationship || ''} ${c.email_personal || ''} ${c.email_work || ''} ${c.phone_mobile || ''}`.toLowerCase().includes(q)); }, [contacts, query]);
    function startCreate() { setForm(blank()); setEditing(null); setCreating(true); setError(''); }
    function startEdit(contact) { setEditing(contact); setForm({ ...contact, tags: contact.tags || [] }); setCreating(true); setError(''); }
    function set(key, value) { setForm(current => ({ ...current, [key]: value })); }
    async function save() { if (!form.display_name.trim())
        return; setError(''); try {
        if (editing)
            await updateContact(editing.id, form);
        else
            await createContact(form);
        setCreating(false);
    }
    catch (e) {
        setError(e instanceof Error ? e.message : 'Could not save contact.');
    } }
    async function remove() { if (!editing)
        return; await deleteContact(editing.id); setCreating(false); }
    async function importVcf(file) { setImportMessage(''); try {
        const text = await file.text();
        const parsed = parseVCardContacts(text);
        if (!parsed.length)
            throw new Error('No contacts were found in that vCard file.');
        let added = 0;
        for (const contact of parsed) {
            const duplicate = contacts.some(existing => existing.display_name.toLowerCase() === contact.display_name.toLowerCase() && ((existing.email_personal && existing.email_personal === contact.email_personal) || (existing.phone_mobile && existing.phone_mobile === contact.phone_mobile)));
            if (duplicate)
                continue;
            await createContact(contact);
            added++;
        }
        setImportMessage(`Imported ${added} contact${added === 1 ? '' : 's'}${parsed.length - added ? ` · ${parsed.length - added} duplicate${parsed.length - added === 1 ? '' : 's'} skipped` : ''}.`);
    }
    catch (e) {
        setImportMessage(e instanceof Error ? e.message : 'Contact import failed.');
    }
    finally {
        if (fileRef.current)
            fileRef.current.value = '';
    } }
    return _jsxs("div", { className: "page organizer-page contacts-page", children: [_jsxs("header", { className: "page-header", children: [_jsxs("div", { children: [_jsx("span", { className: "eyebrow", children: "PEOPLE" }), _jsx("h1", { children: "Contacts that connect to your life." }), _jsx("p", { children: "Save the details once. JustGlance can then connect calls, reminders, appointments and addresses back to the right person." })] }), _jsxs("div", { className: "header-actions", children: [_jsx("input", { ref: fileRef, className: "sr-only", type: "file", accept: ".vcf,text/vcard,text/x-vcard", onChange: e => { const file = e.target.files?.[0]; if (file)
                                    void importVcf(file); } }), _jsxs("button", { className: "secondary-button", onClick: () => fileRef.current?.click(), children: [_jsx(Upload, { size: 17 }), "Import vCard"] }), _jsxs("button", { className: "primary-button", onClick: startCreate, children: [_jsx(Plus, { size: 17 }), "Contact"] })] })] }), importMessage && _jsx("div", { className: "form-message", children: importMessage }), _jsxs("div", { className: "search-box compact-search", children: [_jsx(Search, {}), _jsx("input", { value: query, onChange: e => setQuery(e.target.value), placeholder: "Search people, companies, email, phone\u2026" })] }), _jsx("div", { className: "contacts-grid", children: filtered.map(contact => { const phone = contactPrimaryPhone(contact), email = contactPrimaryEmail(contact), address = contactPrimaryAddress(contact); return _jsxs("article", { className: "contact-card", onClick: () => startEdit(contact), children: [_jsx("div", { className: "contact-avatar", children: contact.avatar_url ? _jsx("img", { src: contact.avatar_url, alt: "" }) : _jsx(UserRound, {}) }), _jsxs("div", { className: "contact-card-main", children: [_jsxs("div", { children: [_jsx("strong", { children: contact.display_name }), contact.nickname && _jsxs("span", { children: ["\u201C", contact.nickname, "\u201D"] })] }), contact.company && _jsxs("p", { children: [_jsx(Building2, { size: 14 }), contact.job_title ? `${contact.job_title} · ` : '', contact.company] }), contact.relationship && _jsx("p", { children: contact.relationship }), _jsxs("div", { className: "contact-quick-actions", children: [phone && _jsxs("a", { href: dialHref(phone), onClick: e => e.stopPropagation(), children: [_jsx(Phone, { size: 15 }), "Call"] }), email && _jsxs("a", { href: mailHref(email), onClick: e => e.stopPropagation(), children: [_jsx(Mail, { size: 15 }), "Email"] }), address && _jsxs("a", { href: mapHref(address), target: "_blank", rel: "noreferrer", onClick: e => e.stopPropagation(), children: [_jsx(MapPin, { size: 15 }), "Map"] })] })] })] }, contact.id); }) }), !filtered.length && _jsxs("div", { className: "large-empty", children: [_jsx(UserRound, {}), _jsx("h2", { children: contacts.length ? 'No matches.' : 'Your people live here.' }), _jsx("p", { children: contacts.length ? 'Try another search.' : 'Add a contact or import a .vcf export from another address book.' })] }), _jsx(Modal, { open: creating, onClose: () => setCreating(false), title: editing ? 'Edit contact' : 'New contact', children: _jsxs("div", { className: "form-stack contact-form", children: [_jsxs("label", { children: ["Display name", _jsx("input", { autoFocus: true, value: form.display_name || '', onChange: e => set('display_name', e.target.value), placeholder: "Ashley" })] }), _jsxs("div", { className: "two-col", children: [_jsxs("label", { children: ["First name", _jsx("input", { value: form.first_name || '', onChange: e => set('first_name', e.target.value) })] }), _jsxs("label", { children: ["Last name", _jsx("input", { value: form.last_name || '', onChange: e => set('last_name', e.target.value) })] })] }), _jsxs("div", { className: "two-col", children: [_jsxs("label", { children: ["Nickname", _jsx("input", { value: form.nickname || '', onChange: e => set('nickname', e.target.value) })] }), _jsxs("label", { children: ["Relationship", _jsx("input", { value: form.relationship || '', onChange: e => set('relationship', e.target.value), placeholder: "Partner, sister, coworker\u2026" })] })] }), _jsxs("div", { className: "two-col", children: [_jsxs("label", { children: ["Company", _jsx("input", { value: form.company || '', onChange: e => set('company', e.target.value) })] }), _jsxs("label", { children: ["Job title", _jsx("input", { value: form.job_title || '', onChange: e => set('job_title', e.target.value) })] })] }), _jsx("span", { className: "eyebrow", children: "PHONE" }), _jsxs("div", { className: "three-col", children: [_jsxs("label", { children: ["Mobile", _jsx("input", { inputMode: "tel", value: form.phone_mobile || '', onChange: e => set('phone_mobile', e.target.value) })] }), _jsxs("label", { children: ["Home", _jsx("input", { inputMode: "tel", value: form.phone_home || '', onChange: e => set('phone_home', e.target.value) })] }), _jsxs("label", { children: ["Work", _jsx("input", { inputMode: "tel", value: form.phone_work || '', onChange: e => set('phone_work', e.target.value) })] })] }), _jsx("span", { className: "eyebrow", children: "EMAIL" }), _jsxs("div", { className: "two-col", children: [_jsxs("label", { children: ["Personal", _jsx("input", { type: "email", value: form.email_personal || '', onChange: e => set('email_personal', e.target.value) })] }), _jsxs("label", { children: ["Work", _jsx("input", { type: "email", value: form.email_work || '', onChange: e => set('email_work', e.target.value) })] })] }), _jsx("span", { className: "eyebrow", children: "ADDRESSES" }), _jsxs("label", { children: ["Home address", _jsx("textarea", { value: form.address_home || '', onChange: e => set('address_home', e.target.value), rows: 2 })] }), _jsxs("label", { children: ["Business address", _jsx("textarea", { value: form.address_business || '', onChange: e => set('address_business', e.target.value), rows: 2 })] }), _jsxs("div", { className: "two-col", children: [_jsxs("label", { children: [_jsx(Cake, { size: 15 }), "Birthday", _jsx("input", { type: "date", value: form.birthday || '', onChange: e => set('birthday', e.target.value) })] }), _jsxs("label", { children: ["Tags", _jsx("input", { value: (form.tags || []).join(', '), onChange: e => set('tags', e.target.value.split(',').map(v => v.trim()).filter(Boolean)), placeholder: "family, doctor, work" })] })] }), _jsxs("label", { children: ["Notes", _jsx("textarea", { value: form.notes || '', onChange: e => set('notes', e.target.value), rows: 4, placeholder: "Anything useful to remember about this person\u2026" })] }), error && _jsx("div", { className: "form-message error", children: error }), _jsxs("div", { className: "row-actions", children: [editing && _jsxs("button", { className: "danger-button", onClick: remove, children: [_jsx(Trash2, { size: 16 }), "Delete"] }), _jsxs("button", { className: "secondary-button", onClick: () => setCreating(false), children: [_jsx(X, { size: 16 }), "Cancel"] }), _jsx("button", { className: "primary-button", onClick: save, disabled: !form.display_name.trim(), children: "Save contact" })] })] }) })] });
}
