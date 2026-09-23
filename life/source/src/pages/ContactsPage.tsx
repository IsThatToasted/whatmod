import { Building2, Cake, Mail, MapPin, Phone, Plus, Search, Trash2, Upload, UserRound, X } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useAppData } from '../contexts/AppDataContext'
import type { Contact } from '../types'
import { Modal } from '../components/Modal'
import { contactPrimaryAddress, contactPrimaryEmail, contactPrimaryPhone, dialHref, mailHref, mapHref, parseVCardContacts } from '../lib/contacts'

const blank = (): Partial<Contact> & { display_name: string } => ({ display_name:'', first_name:'', last_name:'', nickname:'', relationship:'', company:'', job_title:'', email_personal:'', email_work:'', phone_mobile:'', phone_home:'', phone_work:'', address_home:'', address_business:'', birthday:'', notes:'', tags:[] })

export default function ContactsPage(){
  const { contacts, createContact, updateContact, deleteContact } = useAppData()
  const [query,setQuery]=useState(''),[editing,setEditing]=useState<Contact|null>(null),[creating,setCreating]=useState(false),[form,setForm]=useState<Partial<Contact>&{display_name:string}>(blank()),[error,setError]=useState(''),[importMessage,setImportMessage]=useState('')
  const fileRef=useRef<HTMLInputElement|null>(null)
  const filtered=useMemo(()=>{const q=query.trim().toLowerCase();return !q?contacts:contacts.filter(c=>`${c.display_name} ${c.nickname||''} ${c.company||''} ${c.relationship||''} ${c.email_personal||''} ${c.email_work||''} ${c.phone_mobile||''}`.toLowerCase().includes(q))},[contacts,query])
  function startCreate(){setForm(blank());setEditing(null);setCreating(true);setError('')}
  function startEdit(contact:Contact){setEditing(contact);setForm({...contact, tags:contact.tags||[]});setCreating(true);setError('')}
  function set<K extends keyof Contact>(key:K,value:Contact[K]){setForm(current=>({...current,[key]:value}))}
  async function save(){if(!form.display_name.trim())return;setError('');try{if(editing)await updateContact(editing.id,form);else await createContact(form);setCreating(false)}catch(e){setError(e instanceof Error?e.message:'Could not save contact.')}}
  async function remove(){if(!editing)return;await deleteContact(editing.id);setCreating(false)}
  async function importVcf(file:File){setImportMessage('');try{const text=await file.text();const parsed=parseVCardContacts(text);if(!parsed.length)throw new Error('No contacts were found in that vCard file.');let added=0;for(const contact of parsed){const duplicate=contacts.some(existing=>existing.display_name.toLowerCase()===contact.display_name.toLowerCase()&&((existing.email_personal&&existing.email_personal===contact.email_personal)||(existing.phone_mobile&&existing.phone_mobile===contact.phone_mobile)));if(duplicate)continue;await createContact(contact);added++}setImportMessage(`Imported ${added} contact${added===1?'':'s'}${parsed.length-added?` · ${parsed.length-added} duplicate${parsed.length-added===1?'':'s'} skipped`:''}.`)}catch(e){setImportMessage(e instanceof Error?e.message:'Contact import failed.')}finally{if(fileRef.current)fileRef.current.value=''}}
  return <div className="page organizer-page contacts-page">
    <header className="page-header"><div><span className="eyebrow">PEOPLE</span><h1>Contacts that connect to your life.</h1><p>Save the details once. JustGlance can then connect calls, reminders, appointments and addresses back to the right person.</p></div><div className="header-actions"><input ref={fileRef} className="sr-only" type="file" accept=".vcf,text/vcard,text/x-vcard" onChange={e=>{const file=e.target.files?.[0];if(file)void importVcf(file)}}/><button className="secondary-button" onClick={()=>fileRef.current?.click()}><Upload size={17}/>Import vCard</button><button className="primary-button" onClick={startCreate}><Plus size={17}/>Contact</button></div></header>
    {importMessage&&<div className="form-message">{importMessage}</div>}
    <div className="search-box compact-search"><Search/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search people, companies, email, phone…"/></div>
    <div className="contacts-grid">{filtered.map(contact=>{const phone=contactPrimaryPhone(contact),email=contactPrimaryEmail(contact),address=contactPrimaryAddress(contact);return <article className="contact-card" key={contact.id} onClick={()=>startEdit(contact)}><div className="contact-avatar">{contact.avatar_url?<img src={contact.avatar_url} alt=""/>:<UserRound/>}</div><div className="contact-card-main"><div><strong>{contact.display_name}</strong>{contact.nickname&&<span>“{contact.nickname}”</span>}</div>{contact.company&&<p><Building2 size={14}/>{contact.job_title?`${contact.job_title} · `:''}{contact.company}</p>}{contact.relationship&&<p>{contact.relationship}</p>}<div className="contact-quick-actions">{phone&&<a href={dialHref(phone)} onClick={e=>e.stopPropagation()}><Phone size={15}/>Call</a>}{email&&<a href={mailHref(email)} onClick={e=>e.stopPropagation()}><Mail size={15}/>Email</a>}{address&&<a href={mapHref(address)} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()}><MapPin size={15}/>Map</a>}</div></div></article>})}</div>
    {!filtered.length&&<div className="large-empty"><UserRound/><h2>{contacts.length?'No matches.':'Your people live here.'}</h2><p>{contacts.length?'Try another search.':'Add a contact or import a .vcf export from another address book.'}</p></div>}
    <Modal open={creating} onClose={()=>setCreating(false)} title={editing?'Edit contact':'New contact'}>
      <div className="form-stack contact-form">
        <label>Display name<input autoFocus value={form.display_name||''} onChange={e=>set('display_name',e.target.value)} placeholder="Ashley"/></label>
        <div className="two-col"><label>First name<input value={form.first_name||''} onChange={e=>set('first_name',e.target.value)}/></label><label>Last name<input value={form.last_name||''} onChange={e=>set('last_name',e.target.value)}/></label></div>
        <div className="two-col"><label>Nickname<input value={form.nickname||''} onChange={e=>set('nickname',e.target.value)}/></label><label>Relationship<input value={form.relationship||''} onChange={e=>set('relationship',e.target.value)} placeholder="Partner, sister, coworker…"/></label></div>
        <div className="two-col"><label>Company<input value={form.company||''} onChange={e=>set('company',e.target.value)}/></label><label>Job title<input value={form.job_title||''} onChange={e=>set('job_title',e.target.value)}/></label></div>
        <span className="eyebrow">PHONE</span>
        <div className="three-col"><label>Mobile<input inputMode="tel" value={form.phone_mobile||''} onChange={e=>set('phone_mobile',e.target.value)}/></label><label>Home<input inputMode="tel" value={form.phone_home||''} onChange={e=>set('phone_home',e.target.value)}/></label><label>Work<input inputMode="tel" value={form.phone_work||''} onChange={e=>set('phone_work',e.target.value)}/></label></div>
        <span className="eyebrow">EMAIL</span>
        <div className="two-col"><label>Personal<input type="email" value={form.email_personal||''} onChange={e=>set('email_personal',e.target.value)}/></label><label>Work<input type="email" value={form.email_work||''} onChange={e=>set('email_work',e.target.value)}/></label></div>
        <span className="eyebrow">ADDRESSES</span>
        <label>Home address<textarea value={form.address_home||''} onChange={e=>set('address_home',e.target.value)} rows={2}/></label>
        <label>Business address<textarea value={form.address_business||''} onChange={e=>set('address_business',e.target.value)} rows={2}/></label>
        <div className="two-col"><label><Cake size={15}/>Birthday<input type="date" value={form.birthday||''} onChange={e=>set('birthday',e.target.value)}/></label><label>Tags<input value={(form.tags||[]).join(', ')} onChange={e=>set('tags',e.target.value.split(',').map(v=>v.trim()).filter(Boolean))} placeholder="family, doctor, work"/></label></div>
        <label>Notes<textarea value={form.notes||''} onChange={e=>set('notes',e.target.value)} rows={4} placeholder="Anything useful to remember about this person…"/></label>
        {error&&<div className="form-message error">{error}</div>}
        <div className="row-actions">{editing&&<button className="danger-button" onClick={remove}><Trash2 size={16}/>Delete</button>}<button className="secondary-button" onClick={()=>setCreating(false)}><X size={16}/>Cancel</button><button className="primary-button" onClick={save} disabled={!form.display_name.trim()}>Save contact</button></div>
      </div>
    </Modal>
  </div>
}
