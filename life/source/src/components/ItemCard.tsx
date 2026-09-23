import { CalendarPlus, Check, Clock3, Edit3, ExternalLink, MoreHorizontal, Phone, RotateCcw, Trash2, UserRound } from 'lucide-react'
import type { ItemType, LifeItem, Priority } from '../types'
import { relativeDue, addDaysISO } from '../lib/time'
import { useEffect, useState } from 'react'
import { useAppData } from '../contexts/AppDataContext'
import { useAuth } from '../contexts/AuthContext'
import { useOrganizer } from '../contexts/OrganizerContext'
import type { EnergyLevel } from '../types'
import { Modal } from './Modal'
import { contactPrimaryPhone, dialHref } from '../lib/contacts'
import { spaceCategoryAccess } from '../lib/spacePermissions'

export function ItemCard({ item, compact = false, readOnly }: { item: LifeItem; compact?: boolean; readOnly?: boolean }) {
  const { userId } = useAuth()
  const { completeItem, snoozeItem, deleteItem, updateItem, updateShopping, places, spaces, members, contacts } = useAppData()
  const { projects } = useOrganizer()
  const [menu, setMenu] = useState(false)
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(item.title)
  const [description, setDescription] = useState(item.description || '')
  const [type, setType] = useState<ItemType>(item.type)
  const [dueDate, setDueDate] = useState(item.due_date || '')
  const [dueTime, setDueTime] = useState(item.due_time || '')
  const [priority, setPriority] = useState<Priority>(item.priority)
  const [duration, setDuration] = useState(item.estimated_minutes?.toString() || '')
  const [placeId, setPlaceId] = useState(item.place_id || '')
  const [spaceId, setSpaceId] = useState(item.space_id || '')
  const [assignedTo, setAssignedTo] = useState(item.assigned_to || '')
  const [recurrence, setRecurrence] = useState(item.recurrence_rule || '')
  const [projectId, setProjectId] = useState(item.project_id || '')
  const [energy, setEnergy] = useState<EnergyLevel | ''>(item.energy_level || '')
  const [waitingFor, setWaitingFor] = useState(item.waiting_for || '')
  const [contactId, setContactId] = useState(item.contact_id || '')
  const [quantity, setQuantity] = useState(item.shopping?.quantity?.toString() || '')
  const [unit, setUnit] = useState(item.shopping?.unit || '')
  const [preferredStore, setPreferredStore] = useState(item.shopping?.preferred_store || '')
  const [estimatedPrice, setEstimatedPrice] = useState(item.shopping?.estimated_price?.toString() || '')
  const [aisleCategory, setAisleCategory] = useState(item.shopping?.aisle_category || '')
  const [sourceUrl, setSourceUrl] = useState(item.shopping?.source_url || extractFirstUrl(item.source_text) || extractFirstUrl(item.description) || '')
  const [currency, setCurrency] = useState(item.shopping?.currency || 'USD')
  const due = relativeDue(item.due_date, item.due_time)
  const contextName = item.place_name || item.parser_result?.context || null
  const currentSpace = spaces.find(space => space.id === item.space_id)
  const currentMember = currentSpace ? members.find(member => member.space_id === currentSpace.id && member.user_id === userId) : undefined
  const permissionAccess = spaceCategoryAccess(currentSpace, currentMember, item.type === 'shopping' ? 'shopping' : 'tasks')
  const canEdit = readOnly === true ? false : permissionAccess.canEdit
  const assignee = members.find(member => member.user_id === item.assigned_to && member.space_id === item.space_id)
  const availableMembers = members.filter(member => member.space_id === spaceId)
  const currentProject = projects.find(project => project.id === item.project_id)
  const itemLink = item.shopping?.source_url || extractFirstUrl(item.source_text) || extractFirstUrl(item.description)
  const contact = contacts.find(contact => contact.id === item.contact_id)
  const contactPhone = contactPrimaryPhone(contact)

  useEffect(() => {
    setTitle(item.title)
    setDescription(item.description || '')
    setType(item.type)
    setDueDate(item.due_date || '')
    setDueTime(item.due_time || '')
    setPriority(item.priority)
    setDuration(item.estimated_minutes?.toString() || '')
    setPlaceId(item.place_id || '')
    setSpaceId(item.space_id || '')
    setAssignedTo(item.assigned_to || '')
    setRecurrence(item.recurrence_rule || '')
    setProjectId(item.project_id || '')
    setEnergy(item.energy_level || '')
    setWaitingFor(item.waiting_for || '')
    setContactId(item.contact_id || '')
    setQuantity(item.shopping?.quantity?.toString() || '')
    setUnit(item.shopping?.unit || '')
    setPreferredStore(item.shopping?.preferred_store || '')
    setEstimatedPrice(item.shopping?.estimated_price?.toString() || '')
    setAisleCategory(item.shopping?.aisle_category || '')
    setSourceUrl(item.shopping?.source_url || extractFirstUrl(item.source_text) || extractFirstUrl(item.description) || '')
    setCurrency(item.shopping?.currency || 'USD')
  }, [item])

  async function saveEdit() {
    if (!title.trim()) return
    const selected = places.find(place => place.id === placeId)
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
      contact_id: contactId || null,
      is_inbox: false,
      source_text: rewriteSourceUrl(item.source_text || item.title, sourceUrl),
    })
    if (type === 'shopping') {
      await updateShopping(item.id, {
        quantity: quantity ? Number(quantity) : null,
        unit: unit || null,
        preferred_store: preferredStore || null,
        estimated_price: estimatedPrice ? Number(estimatedPrice) : null,
        aisle_category: aisleCategory || null,
        source_url: sourceUrl || null,
        currency: currency || null,
      })
    }
    setEditing(false)
  }

  return <>
    <article className={`item-card ${compact ? 'compact' : ''} ${item.shopping?.image_url ? 'has-product-image' : ''}`}>
      {canEdit?<button className="complete-button" onClick={() => completeItem(item.id)} aria-label={`Complete ${item.title}`}><Check size={18}/></button>:<span className="complete-button readonly-complete" aria-hidden="true"><Check size={18}/></span>}
      {item.type === 'shopping' && item.shopping?.image_url && <a className="item-product-thumb" href={itemLink || item.shopping.image_url} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()}><img src={item.shopping.image_url} alt="" referrerPolicy="no-referrer"/></a>}
      <div className="item-main">
        <div className="item-title-row"><strong>{item.title}</strong>{itemLink&&<a className="item-product-link" href={itemLink} target="_blank" rel="noreferrer" aria-label="Open attached link" onClick={e=>e.stopPropagation()}><ExternalLink size={14}/></a>}{item.priority === 'high' && <span className="priority-dot" title="High priority"/>}</div>
        <div className="item-meta">
          {due && <span>{due}</span>}
          {item.estimated_minutes && <span><Clock3 size={13}/>{item.estimated_minutes} min</span>}
          {contextName && <span>{contextName}</span>}
          {currentSpace && <span>{currentSpace.name}</span>}
          {currentProject && <span>{currentProject.name}</span>}
          {item.waiting_for && <span>Waiting for {item.waiting_for}</span>}
          {assignee && <span>For {assignee.greeting_name || assignee.display_name}</span>}
          {contact && <span><UserRound size={13}/>{contact.display_name}</span>}
          {item.recurrence_rule && <span>Repeats {formatRecurrence(item.recurrence_rule)}</span>}
          {item.type === 'shopping' && item.shopping?.quantity != null && <span>{item.shopping.quantity}{item.shopping.unit ? ` ${item.shopping.unit}` : ''}</span>}
          {item.type === 'shopping' && item.shopping?.preferred_store && <span>{item.shopping.preferred_store}</span>}
          {item.type === 'shopping' && item.shopping?.estimated_price != null && <span>{formatPrice(item.shopping.estimated_price,item.shopping.currency)}</span>}
          {contactPhone && <a className="item-dial-link" href={dialHref(contactPhone)} onClick={e=>e.stopPropagation()}><Phone size={13}/>Dial {contact?.display_name}</a>}
          {itemLink && <a className="item-open-link" href={itemLink} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()}><ExternalLink size={13}/>Open link</a>}
        </div>
      </div>
      {canEdit&&<div className="item-actions">
        <button className="icon-button" onClick={() => setMenu(value => !value)} aria-label="Item actions"><MoreHorizontal size={19}/></button>
        {menu && <div className="popover">
          <button onClick={() => { setEditing(true); setMenu(false) }}><Edit3 size={15}/>Edit</button>
          <button onClick={() => { void updateItem(item.id, { due_date: addDaysISO(1), snoozed_until: null }); setMenu(false) }}><CalendarPlus size={15}/>Move to tomorrow</button>
          <button onClick={() => { void snoozeItem(item.id); setMenu(false) }}><RotateCcw size={15}/>Snooze 1 day</button>
          <button onClick={() => { void deleteItem(item.id); setMenu(false) }}><Trash2 size={15}/>Delete</button>
        </div>}
      </div>}
    </article>

    <Modal open={editing&&canEdit} onClose={() => setEditing(false)} title="Edit item">
      <div className="form-stack">
        <label>Title<input value={title} onChange={e => setTitle(e.target.value)}/></label>
        <label>Notes<textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}/></label>
        <label>Reference / product link<input type="url" inputMode="url" value={sourceUrl} onChange={e=>setSourceUrl(e.target.value)} placeholder="https://…"/></label>
        <div className="two-col">
          <label>Type<select value={type} onChange={e => setType(e.target.value as ItemType)}><option value="task">Task</option><option value="shopping">Shopping</option><option value="call">Call</option><option value="errand">Errand</option><option value="chore">Chore</option><option value="reminder">Reminder</option><option value="idea">Idea</option></select></label>
          <label>Priority<select value={priority} onChange={e => setPriority(e.target.value as Priority)}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option></select></label>
        </div>
        <div className="two-col">
          <label>Due date<input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}/></label>
          <label>Due time<input type="time" value={dueTime} onChange={e => setDueTime(e.target.value)}/></label>
        </div>
        <div className="two-col">
          <label>Expected minutes<input type="number" min="1" max="1440" value={duration} onChange={e => setDuration(e.target.value)}/></label>
          <label>Place<select value={placeId} onChange={e => setPlaceId(e.target.value)}><option value="">None</option>{places.map(place => <option key={place.id} value={place.id}>{place.name}</option>)}</select></label>
        </div>
        <div className="two-col">
          <label>Space<select value={spaceId} onChange={e => { setSpaceId(e.target.value); setAssignedTo('') }}><option value="">Personal</option>{spaces.filter(space => !space.is_personal && space.name !== 'Personal').map(space => <option key={space.id} value={space.id}>{space.name}</option>)}</select></label>
          <label>Assigned to<select value={assignedTo} onChange={e => setAssignedTo(e.target.value)} disabled={!spaceId}><option value="">Anyone</option>{availableMembers.map(member => <option key={member.user_id} value={member.user_id}>{member.greeting_name || member.display_name}</option>)}</select></label>
        </div>
        <div className="two-col">
          <label>Project<select value={projectId} onChange={e => setProjectId(e.target.value)}><option value="">None</option>{projects.filter(project => project.status === 'active').map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
          <label>Energy<select value={energy} onChange={e => setEnergy(e.target.value as EnergyLevel | '')}><option value="">Any</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
        </div>
        <label>Contact<select value={contactId} onChange={e=>setContactId(e.target.value)}><option value="">None</option>{contacts.map(contact=><option key={contact.id} value={contact.id}>{contact.display_name}</option>)}</select></label>
                <label>Waiting for<input value={waitingFor} onChange={e => setWaitingFor(e.target.value)} placeholder="Person, delivery, approval…"/></label>
        <label>Recurrence<select value={recurrence} onChange={e => setRecurrence(e.target.value)}><option value="">Does not repeat</option><option value="daily">Daily</option><option value="weekdays">Weekdays</option><option value="weekdays:1,3,5">Mon / Wed / Fri</option><option value="weekly">Weekly</option><option value="biweekly">Every 2 weeks</option><option value="monthly">Monthly</option><option value="every:2">Every 2 days</option><option value="every:3">Every 3 days</option><option value="every:14">Every 14 days</option></select></label>
        {type === 'shopping' && <div className="shopping-edit-group">
          <span className="eyebrow">SHOPPING DETAILS</span>
          <div className="two-col"><label>Quantity<input type="number" min="0" step="0.01" value={quantity} onChange={e => setQuantity(e.target.value)}/></label><label>Unit<input value={unit} onChange={e => setUnit(e.target.value)} placeholder="each, lb, pack…"/></label></div>
          <div className="two-col"><label>Preferred store<input value={preferredStore} onChange={e => setPreferredStore(e.target.value)} placeholder="Walmart"/></label><label>Estimated price<input type="number" min="0" step="0.01" value={estimatedPrice} onChange={e => setEstimatedPrice(e.target.value)}/></label></div>
          <label>Category / aisle<input value={aisleCategory} onChange={e => setAisleCategory(e.target.value)} placeholder="Pantry, household, produce…"/></label>
          <label>Currency<input value={currency} onChange={e=>setCurrency(e.target.value.toUpperCase())} maxLength={3}/></label>
        </div>}
        <button className="primary-button" onClick={saveEdit} disabled={!title.trim()}>Save changes</button>
      </div>
    </Modal>
  </>
}

function extractFirstUrl(value?: string | null) {
  if (!value) return ''
  const match = value.match(/https?:\/\/[^\s<>()"']+/i)
  return match?.[0]?.replace(/[.,;!?]+$/, '') || ''
}

function rewriteSourceUrl(source: string, nextUrl: string) {
  const current = extractFirstUrl(source)
  const cleanNext = nextUrl.trim()
  if (current) {
    const without = source.replace(current, '').replace(/\s+/g, ' ').trim()
    return cleanNext ? `${without} ${cleanNext}`.trim() : without
  }
  return cleanNext ? `${source.trim()} ${cleanNext}`.trim() : source
}

function formatPrice(price: number, currency?: string | null) {
  try { return new Intl.NumberFormat(undefined,{style:'currency',currency:currency||'USD'}).format(price) } catch { return `${currency||'$'} ${price.toFixed(2)}` }
}

function formatRecurrence(rule: string) {
  if (rule === 'weekdays:1,3,5') return 'Mon / Wed / Fri'
  if (rule === 'biweekly') return 'every 2 weeks'
  if (rule.startsWith('every:')) return `every ${rule.split(':')[1]} days`
  return rule
}
