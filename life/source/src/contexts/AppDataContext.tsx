import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { ActivityEntry, CaptureRecord, Contact, EventItem, InviteResult, LifeItem, Note, ParsedIntent, Place, Profile, ShoppingDetails, ShoppingList, Space, SpaceMember, SpacePermissions, UniversalIntakeAnalysis, UserPreferences } from '../types'
import { useAuth } from './AuthContext'
import { demoActivity, demoEvents, demoItems, demoMembers, demoNotes, demoPlaces, demoProfile, demoSpaces } from '../lib/demo'
import { supabase } from '../lib/supabase'
import { enqueueMutation, getOfflineQueue, removeMutation } from '../lib/offlineQueue'
import { nextRecurrenceDate } from '../lib/recurrence'
import { normalizeSpacePermissions } from '../lib/spacePermissions'

const demoPreferences: UserPreferences = {
  user_id: demoProfile.id,
  morning_brief_enabled: true,
  daily_reset_enabled: true,
  smart_suggestions_enabled: true,
  urgent_reminders_enabled: true,
  upcoming_tasks_enabled: true,
  shared_activity_enabled: true,
  location_reminders_enabled: false,
  routine_reminders_enabled: true,
  default_mood: 'nothing',
  feature_overrides: {},
}

interface AppDataValue {
  profile: Profile | null
  preferences: UserPreferences | null
  items: LifeItem[]
  spaces: Space[]
  members: SpaceMember[]
  places: Place[]
  events: EventItem[]
  notes: Note[]
  activity: ActivityEntry[]
  captures: CaptureRecord[]
  contacts: Contact[]
  shoppingLists: ShoppingList[]
  collaborationAvailable: boolean
  loading: boolean
  syncState: 'synced' | 'syncing' | 'offline' | 'error'
  refresh(): Promise<void>
  createItem(parsed: ParsedIntent, source: string, extra?: Partial<LifeItem>): Promise<LifeItem>
  updateItem(id: string, patch: Partial<LifeItem>): Promise<void>
  updateShopping(id: string, patch: ShoppingDetails): Promise<void>
  completeItem(id: string): Promise<void>
  deleteItem(id: string): Promise<void>
  snoozeItem(id: string, hours?: number): Promise<void>
  createSpace(name: string): Promise<void>
  createInvite(spaceId: string, email?: string, role?: 'member' | 'admin', permissions?: Partial<SpacePermissions>): Promise<InviteResult>
  consumeInvite(token: string): Promise<string>
  updateMemberAccess(spaceId: string, userId: string, permissions: Partial<SpacePermissions>, role?: 'member' | 'admin'): Promise<void>
  createShoppingList(spaceId: string, name: string): Promise<ShoppingList>
  createCapture(input: { kind: CaptureRecord['kind']; title: string; raw_text?: string | null; source_url?: string | null; space_id?: string | null; parsed_kind?: string | null; parsed_data?: Record<string, unknown>; file?: File | null; status?: CaptureRecord['status']; created_item_id?: string | null; created_event_id?: string | null; created_note_id?: string | null; contact_id?: string | null; ai_status?: CaptureRecord['ai_status'] }): Promise<CaptureRecord>
  updateCapture(id: string, patch: Partial<CaptureRecord>): Promise<void>
  analyzeCapture(id: string): Promise<UniversalIntakeAnalysis | null>
  getCaptureSignedUrl(storagePath: string): Promise<string | null>
  createContact(input: Partial<Contact> & { display_name: string }): Promise<Contact>
  updateContact(id: string, patch: Partial<Contact>): Promise<void>
  deleteContact(id: string): Promise<void>
  importCalendarEvents(events: Array<Omit<EventItem,'id'|'user_id'>>, sourceName?: string): Promise<{ imported: number; skipped: number }>
  updateProfile(patch: Partial<Profile>): Promise<void>
  updatePreferences(patch: Partial<UserPreferences>): Promise<void>
  createPlace(place: Partial<Place> & { name: string }): Promise<void>
  createEvent(event: Omit<EventItem, 'id' | 'user_id'>): Promise<EventItem>
  createNote(body: string, spaceId?: string | null): Promise<void>
  getSpaceMembers(spaceId: string): Promise<SpaceMember[]>
}

const Ctx = createContext<AppDataValue | null>(null)
const localKey = (uid: string) => `justglance:local:${uid}`
const profileKey = (uid: string) => `justglance:profile:${uid}`
const snapshotKey = (uid: string) => `justglance:snapshot:${uid}`

function withTimeout<T>(promise: Promise<T>, milliseconds: number, label: string): Promise<T> {
  let timer: number | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = window.setTimeout(() => reject(new Error(`${label} timed out after ${milliseconds}ms`)), milliseconds)
  })
  return Promise.race([promise, timeout]).finally(() => {
    if (timer !== undefined) window.clearTimeout(timer)
  })
}

function writeSnapshotPart(uid: string, patch: Record<string, unknown>) {
  try {
    const existing = JSON.parse(localStorage.getItem(snapshotKey(uid)) || '{}')
    localStorage.setItem(snapshotKey(uid), JSON.stringify({ ...existing, ...patch, saved_at: new Date().toISOString() }))
  } catch {
    // Storage quota/private-mode failures should never block the live app.
  }
}

function stripClientOnly(item: LifeItem) {
  const { place_name: _placeName, shopping: _shopping, ...payload } = item
  return payload
}

function legacyShoppingDetails(shopping: ShoppingDetails, includeList = true) {
  const row: Record<string, unknown> = {
    quantity: shopping.quantity ?? null,
    unit: shopping.unit ?? null,
    preferred_store: shopping.preferred_store ?? null,
    estimated_price: shopping.estimated_price ?? null,
    aisle_category: shopping.aisle_category ?? null,
  }
  if (includeList && Object.prototype.hasOwnProperty.call(shopping, 'list_id')) row.list_id = shopping.list_id || null
  return row
}

async function upsertShoppingServer(itemId: string, shopping: ShoppingDetails) {
  if (!supabase) return new Error('Supabase is not available')
  const rich = { item_id: itemId, ...shopping }
  let result = await supabase.from('shopping_items').upsert(rich as never, { onConflict: 'item_id' })
  if (!result.error) return null
  const message = String(result.error.message || '')
  if (/source_url|image_url|currency|product_id|product_metadata|schema cache/i.test(message)) {
    const legacy = { item_id: itemId, ...legacyShoppingDetails(shopping, true) }
    result = await supabase.from('shopping_items').upsert(legacy as never, { onConflict: 'item_id' })
    if (!result.error) return null
  }
  if (String(result.error?.message || '').includes('list_id')) {
    const oldest = { item_id: itemId, ...legacyShoppingDetails(shopping, false) }
    result = await supabase.from('shopping_items').upsert(oldest as never, { onConflict: 'item_id' })
    if (!result.error) return null
  }
  return result.error || new Error('Could not save shopping details')
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const { userId, demo } = useAuth()
  return <AppDataStateProvider key={demo ? 'demo' : userId || 'signed-out'} userId={userId} demo={demo}>{children}</AppDataStateProvider>
}

function AppDataStateProvider({ children, userId, demo }: { children: ReactNode; userId: string | null; demo: boolean }) {
  const [profile, setProfile] = useState<Profile | null>(demo ? demoProfile : null)
  const [preferences, setPreferences] = useState<UserPreferences | null>(demo ? demoPreferences : null)
  const [items, setItems] = useState<LifeItem[]>(demo ? demoItems : [])
  const [spaces, setSpaces] = useState<Space[]>(demo ? demoSpaces : [])
  const [members, setMembers] = useState<SpaceMember[]>(demo ? demoMembers : [])
  const [places, setPlaces] = useState<Place[]>(demo ? demoPlaces : [])
  const [events, setEvents] = useState<EventItem[]>(demo ? demoEvents : [])
  const [notes, setNotes] = useState<Note[]>(demo ? demoNotes : [])
  const [activity, setActivity] = useState<ActivityEntry[]>(demo ? demoActivity : [])
  const [captures, setCaptures] = useState<CaptureRecord[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [shoppingLists, setShoppingLists] = useState<ShoppingList[]>([])
  const [collaborationAvailable, setCollaborationAvailable] = useState(demo)
  const [loading, setLoading] = useState(!demo)
  const [syncState, setSyncState] = useState<AppDataValue['syncState']>(navigator.onLine ? 'synced' : 'offline')

  const persistLocal = useCallback((next: LifeItem[]) => {
    if (userId) localStorage.setItem(localKey(userId), JSON.stringify(next))
  }, [userId])

  const refresh = useCallback(async () => {
    if (demo || !supabase || !userId) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const [p, pref, i, s, m, pl, e, n, a, sl, cap, con] = await withTimeout(Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
        supabase.from('user_preferences').select('*').eq('user_id', userId).maybeSingle(),
        (async () => {
          const rich = await supabase.from('items').select('*, places(name), shopping_items(quantity,unit,preferred_store,estimated_price,aisle_category,list_id,source_url,image_url,currency,product_id,product_metadata)').is('deleted_at', null).order('created_at', { ascending: false })
          if (!rich.error) return rich
          const modern = await supabase.from('items').select('*, places(name), shopping_items(quantity,unit,preferred_store,estimated_price,aisle_category,list_id)').is('deleted_at', null).order('created_at', { ascending: false })
          if (!modern.error || !String(modern.error.message || '').includes('list_id')) return modern
          return supabase.from('items').select('*, places(name), shopping_items(quantity,unit,preferred_store,estimated_price,aisle_category)').is('deleted_at', null).order('created_at', { ascending: false })
        })(),
        supabase.from('spaces').select('*, space_members!inner(role)').eq('space_members.user_id', userId).order('created_at'),
        (async () => {
          const modern = await supabase.rpc('get_accessible_space_members_v2')
          return modern.error ? supabase.rpc('get_accessible_space_members') : modern
        })(),
        supabase.from('places').select('*').order('name'),
        supabase.from('events').select('*').is('deleted_at', null).gte('event_date', new Date().toISOString().slice(0, 10)).order('event_date').order('start_time'),
        supabase.from('notes').select('*').is('deleted_at', null).order('created_at', { ascending: false }).limit(100),
        supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('shopping_lists').select('*').is('archived_at', null).order('sort_order').order('created_at'),
        supabase.from('captures').select('*').order('created_at', { ascending: false }).limit(500),
        supabase.from('contacts').select('*').is('deleted_at', null).order('display_name').limit(500),
      ]), 9000, 'Initial data load')

      if (p.data) {
        setProfile(p.data as Profile)
        localStorage.setItem(profileKey(userId), JSON.stringify(p.data))
      }
      if (pref.data) setPreferences(pref.data as UserPreferences)
      if (i.error) throw i.error

      const mapped = (i.data || []).map((row: any) => ({
        ...row,
        place_name: row.places?.name ?? null,
        shopping: row.shopping_items ?? null,
        places: undefined,
        shopping_items: undefined,
      })) as LifeItem[]
      const nextSpaces = (s.data || []).map((x: any) => ({ ...x, role: x.space_members?.[0]?.role })) as Space[]
      const nextMembers = (m.data || []).map((x: any) => ({ space_id: x.space_id, user_id: x.user_id, role: x.role, permissions: x.permissions || null, display_name: x.display_name || 'Member', greeting_name: x.greeting_name || null, avatar_url: x.avatar_url || null })) as SpaceMember[]
      const nextPlaces = (pl.data || []) as Place[]
      const nextEvents = (e.data || []) as EventItem[]
      const nextNotes = (n.data || []) as Note[]
      const nextActivity = (a.data || []) as ActivityEntry[]
      const nextShoppingLists = (sl.data || []) as ShoppingList[]
      const nextCaptures = (cap.data || []) as CaptureRecord[]
      const nextContacts = (con.data || []) as Contact[]
      setCollaborationAvailable(!sl.error && !cap.error)
      setItems(mapped)
      persistLocal(mapped)
      setSpaces(nextSpaces)
      setMembers(nextMembers)
      setPlaces(nextPlaces)
      setEvents(nextEvents)
      setNotes(nextNotes)
      setActivity(nextActivity)
      setShoppingLists(nextShoppingLists)
      setCaptures(nextCaptures)
      setContacts(nextContacts)
      writeSnapshotPart(userId, {
        profile: p.data || null,
        preferences: pref.data || null,
        items: mapped,
        spaces: nextSpaces,
        members: nextMembers,
        places: nextPlaces,
        events: nextEvents,
        notes: nextNotes,
        activity: nextActivity,
        shoppingLists: nextShoppingLists,
        captures: nextCaptures,
        contacts: nextContacts,
      })
      setSyncState('synced')
    } catch {
      try {
        const snapshot = JSON.parse(localStorage.getItem(snapshotKey(userId)) || 'null')
        if (snapshot) {
          if (snapshot.profile) setProfile(snapshot.profile as Profile)
          if (snapshot.preferences) setPreferences(snapshot.preferences as UserPreferences)
          if (snapshot.items) setItems(snapshot.items as LifeItem[])
          if (snapshot.spaces) setSpaces(snapshot.spaces as Space[])
          if (snapshot.members) setMembers(snapshot.members as SpaceMember[])
          if (snapshot.places) setPlaces(snapshot.places as Place[])
          if (snapshot.events) setEvents(snapshot.events as EventItem[])
          if (snapshot.notes) setNotes(snapshot.notes as Note[])
          if (snapshot.activity) setActivity(snapshot.activity as ActivityEntry[])
          if (snapshot.shoppingLists) setShoppingLists(snapshot.shoppingLists as ShoppingList[])
          if (snapshot.captures) setCaptures(snapshot.captures as CaptureRecord[])
          if (snapshot.contacts) setContacts(snapshot.contacts as Contact[])
        } else {
          const cached = localStorage.getItem(localKey(userId))
          if (cached) setItems(JSON.parse(cached))
          const cachedProfile = localStorage.getItem(profileKey(userId))
          if (cachedProfile) setProfile(JSON.parse(cachedProfile))
        }
      } catch {
        // Ignore a corrupt cache and retry the server on the next refresh.
      }
      setSyncState(navigator.onLine ? 'error' : 'offline')
    } finally {
      setLoading(false)
    }
  }, [demo, userId, persistLocal])

  const flushQueue = useCallback(async () => {
    if (!supabase || demo || !navigator.onLine) return
    setSyncState('syncing')
    for (const mutation of getOfflineQueue(userId)) {
      try {
        const query = supabase.from(mutation.table)
        if (mutation.action === 'insert') {
          const { error } = await query.insert(mutation.payload as never)
          if (error) throw error
        }
        if (mutation.action === 'upsert') {
          const payload = mutation.payload as { data: Record<string, unknown>; onConflict?: string }
          const { error } = await query.upsert(payload.data as never, { onConflict: payload.onConflict })
          if (error) throw error
        }
        if (mutation.action === 'update') {
          const payload = mutation.payload as { id: string; idField?: string; patch: Record<string, unknown> }
          const { error } = await query.update(payload.patch as never).eq(payload.idField || 'id', payload.id)
          if (error) throw error
        }
        if (mutation.action === 'delete') {
          const payload = mutation.payload as { id: string }
          const { error } = await query.update({ deleted_at: new Date().toISOString() } as never).eq('id', payload.id)
          if (error) throw error
        }
        removeMutation(mutation.id)
      } catch {
        setSyncState('error')
        return
      }
    }
    await refresh()
  }, [demo, refresh, userId])

  useEffect(() => { refresh() }, [refresh])
  useEffect(() => {
    const onOnline = () => { void flushQueue() }
    const onOffline = () => setSyncState('offline')
    addEventListener('online', onOnline)
    addEventListener('offline', onOffline)
    return () => {
      removeEventListener('online', onOnline)
      removeEventListener('offline', onOffline)
    }
  }, [flushQueue])

  useEffect(() => {
    if (demo || !supabase || !userId) return
    const client = supabase
    const channel = client
      .channel(`life-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, () => { void refresh() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shopping_items' }, () => { void refresh() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'space_members' }, () => { void refresh() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_log' }, () => { void refresh() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => { void refresh() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' }, () => { void refresh() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shopping_lists' }, () => { void refresh() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'captures' }, () => { void refresh() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, () => { void refresh() })
      .subscribe()
    return () => { void client.removeChannel(channel) }
  }, [demo, userId, refresh])

  const createItem = async (parsed: ParsedIntent, source: string, extra: Partial<LifeItem> = {}) => {
    if (!userId) throw new Error('Not signed in')
    const item: LifeItem = {
      id: crypto.randomUUID(),
      user_id: userId,
      title: parsed.title,
      type: parsed.type,
      status: 'open',
      priority: parsed.priority,
      due_date: parsed.dueDate,
      due_time: parsed.dueTime,
      estimated_minutes: parsed.estimatedMinutes,
      context_tags: parsed.tags,
      source_text: source,
      parser_result: parsed,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      snooze_count: 0,
      ...extra,
    }
    setItems(current => {
      const next = [item, ...current]
      persistLocal(next)
      writeSnapshotPart(userId, { items: next })
      return next
    })

    if (!demo && supabase) {
      const payload = stripClientOnly(item)
      if (!navigator.onLine) {
        enqueueMutation(userId, { table: 'items', action: 'upsert', payload: { data: payload as Record<string, unknown>, onConflict: 'id' } })
        if (item.type === 'shopping' && item.shopping) enqueueMutation(userId, { table: 'shopping_items', action: 'upsert', payload: { data: { item_id: item.id, ...item.shopping }, onConflict: 'item_id' } })
      } else {
        const { error } = await supabase.from('items').insert(payload as never)
        if (error) {
          enqueueMutation(userId, { table: 'items', action: 'upsert', payload: { data: payload as Record<string, unknown>, onConflict: 'id' } })
          if (item.type === 'shopping' && item.shopping) {
            enqueueMutation(userId, { table: 'shopping_items', action: 'upsert', payload: { data: { item_id: item.id, ...item.shopping }, onConflict: 'item_id' } })
          }
          setSyncState('error')
        } else if (item.type === 'shopping' && item.shopping) {
          const shoppingData = { item_id: item.id, ...item.shopping }
          const shoppingError = await upsertShoppingServer(item.id, item.shopping)
          if (shoppingError) {
            enqueueMutation(userId, { table: 'shopping_items', action: 'upsert', payload: { data: shoppingData, onConflict: 'item_id' } })
            setSyncState('error')
          }
        }
      }
    }
    return item
  }

  const updateItem = async (id: string, patch: Partial<LifeItem>) => {
    const updated = { ...patch, updated_at: new Date().toISOString() }
    setItems(current => {
      const next = current.map(item => item.id === id ? { ...item, ...updated } : item)
      persistLocal(next)
      if (userId) writeSnapshotPart(userId, { items: next })
      return next
    })
    const serverPatch: Record<string, unknown> = { ...updated }
    delete serverPatch.place_name
    delete serverPatch.shopping
    if (!demo && supabase) {
      if (!navigator.onLine) enqueueMutation(userId, { table: 'items', action: 'update', payload: { id, patch: serverPatch } })
      else {
        const { error } = await supabase.from('items').update(serverPatch as never).eq('id', id)
        if (error) {
          enqueueMutation(userId, { table: 'items', action: 'update', payload: { id, patch: serverPatch } })
          setSyncState('error')
        }
      }
    }
  }

  const updateShopping = async (id: string, patch: ShoppingDetails) => {
    const normalized: ShoppingDetails = {
      quantity: patch.quantity ?? null,
      unit: patch.unit?.trim() || null,
      preferred_store: patch.preferred_store?.trim() || null,
      estimated_price: patch.estimated_price ?? null,
      aisle_category: patch.aisle_category?.trim() || null,
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'list_id')) normalized.list_id = patch.list_id || null
    if (Object.prototype.hasOwnProperty.call(patch, 'source_url')) normalized.source_url = patch.source_url?.trim() || null
    if (Object.prototype.hasOwnProperty.call(patch, 'image_url')) normalized.image_url = patch.image_url?.trim() || null
    if (Object.prototype.hasOwnProperty.call(patch, 'currency')) normalized.currency = patch.currency?.trim().toUpperCase() || null
    if (Object.prototype.hasOwnProperty.call(patch, 'product_id')) normalized.product_id = patch.product_id?.trim() || null
    if (Object.prototype.hasOwnProperty.call(patch, 'product_metadata')) normalized.product_metadata = patch.product_metadata || {}
    setItems(current => {
      const next = current.map(item => item.id === id ? { ...item, shopping: { ...(item.shopping || {}), ...normalized } } : item)
      persistLocal(next)
      if (userId) writeSnapshotPart(userId, { items: next })
      return next
    })
    if (!demo && supabase) {
      const data = { item_id: id, ...normalized }
      if (!navigator.onLine) enqueueMutation(userId, { table: 'shopping_items', action: 'upsert', payload: { data, onConflict: 'item_id' } })
      else {
        const error = await upsertShoppingServer(id, normalized)
        if (error) {
          enqueueMutation(userId, { table: 'shopping_items', action: 'upsert', payload: { data, onConflict: 'item_id' } })
          setSyncState('error')
        }
      }
    }
  }

  const completeItem = async (id: string) => {
    const item = items.find(candidate => candidate.id === id)
    if (!item) return
    await updateItem(id, { status: 'completed', completed_at: new Date().toISOString() })
    const nextDate = nextRecurrenceDate(item.recurrence_rule, item.due_date)
    if (!nextDate) return
    const parsed: ParsedIntent = item.parser_result || {
      type: item.type,
      title: item.title,
      context: item.place_name,
      dueDate: nextDate,
      dueTime: item.due_time,
      priority: item.priority,
      space: null,
      estimatedMinutes: item.estimated_minutes,
      tags: item.context_tags,
      confidence: 1,
    }
    await createItem({ ...parsed, dueDate: nextDate }, item.source_text || item.title, {
      space_id: item.space_id,
      description: item.description,
      due_date: nextDate,
      due_time: item.due_time,
      estimated_minutes: item.estimated_minutes,
      place_id: item.place_id,
      place_name: item.place_name,
      assigned_to: item.assigned_to,
      recurrence_rule: item.recurrence_rule,
      context_tags: item.context_tags,
      shopping: item.shopping,
    })
  }

  const deleteItem = async (id: string) => {
    setItems(current => {
      const next = current.filter(item => item.id !== id)
      persistLocal(next)
      if (userId) writeSnapshotPart(userId, { items: next })
      return next
    })
    if (!demo && supabase) {
      if (!navigator.onLine) enqueueMutation(userId, { table: 'items', action: 'delete', payload: { id } })
      else {
        const { error } = await supabase.from('items').update({ deleted_at: new Date().toISOString() } as never).eq('id', id)
        if (error) {
          enqueueMutation(userId, { table: 'items', action: 'delete', payload: { id } })
          setSyncState('error')
        }
      }
    }
  }

  const snoozeItem = (id: string, hours = 24) => {
    const item = items.find(candidate => candidate.id === id)
    return updateItem(id, {
      snoozed_until: new Date(Date.now() + hours * 3600000).toISOString(),
      snooze_count: (item?.snooze_count || 0) + 1,
    })
  }

  const createSpace = async (name: string) => {
    if (!userId) return
    if (demo) {
      setSpaces(current => [...current, { id: crypto.randomUUID(), owner_id: userId, name, icon: 'home', role: 'owner', created_at: new Date().toISOString() }])
      return
    }
    if (!navigator.onLine) throw new Error('Connect to the internet to create a shared space.')
    if (supabase) {
      const { error } = await supabase.rpc('create_space_with_owner', { p_name: name, p_icon: 'home' })
      if (error) throw error
      await refresh()
    }
  }

  const createInvite = async (spaceId: string, email?: string, role: 'member' | 'admin' = 'member', permissions: Partial<SpacePermissions> = {}) => {
    const expires = new Date(Date.now() + 7 * 86400000).toISOString()
    if (demo) throw new Error('This is demo mode, so it cannot create a real shareable invite. Sign in to the Supabase-backed app first.')
    if (!supabase) throw new Error('Supabase is not configured')
    if (!navigator.onLine) throw new Error('Connect to the internet to create an invite link.')
    const normalized = normalizeSpacePermissions(permissions)
    const modern = await supabase.rpc('create_space_invite_v2', {
      p_space: spaceId,
      p_email: email?.trim() || null,
      p_role: role,
      p_permissions: normalized,
    })
    if (!modern.error && modern.data) {
      const value = modern.data as any
      return { token: String(value.token), space_id: String(value.space_id || spaceId), expires_at: String(value.expires_at || expires) }
    }
    // Migration-safe fallback: older databases can still create a basic member invite.
    const missingModernRpc = modern.error && ['PGRST202','42883'].includes(String((modern.error as any).code || ''))
    if (!missingModernRpc) throw modern.error
    if (role !== 'member') throw new Error('Run migration 003 before inviting admins or using category permissions.')
    const legacy = await supabase.rpc('create_space_invite', { p_space: spaceId, p_email: email?.trim() || null, p_role: 'member' })
    if (legacy.error) throw legacy.error
    return { token: String(legacy.data), space_id: spaceId, expires_at: expires }
  }

  const consumeInvite = async (token: string) => {
    if (demo) return spaces[0]?.id || ''
    if (!supabase) throw new Error('Supabase is not configured')
    let result = await supabase.rpc('consume_space_invite_v2', { p_token: token })
    if (result.error && ['PGRST202','42883'].includes(String((result.error as any).code || ''))) {
      result = await supabase.rpc('consume_space_invite', { p_token: token })
    }
    if (result.error) throw result.error
    await refresh()
    return String(result.data)
  }

  const updateMemberAccess = async (spaceId: string, memberUserId: string, permissions: Partial<SpacePermissions>, role?: 'member' | 'admin') => {
    if (demo) {
      setMembers(current => current.map(member => member.space_id === spaceId && member.user_id === memberUserId ? { ...member, permissions: normalizeSpacePermissions(permissions), role: role || member.role } : member))
      return
    }
    if (!supabase) throw new Error('Supabase is not configured')
    const { error } = await supabase.rpc('update_space_member_access', { p_space: spaceId, p_user: memberUserId, p_permissions: normalizeSpacePermissions(permissions), p_role: role || null })
    if (error) throw error
    await refresh()
  }

  const createShoppingList = async (spaceId: string, name: string): Promise<ShoppingList> => {
    if (!userId) throw new Error('Not signed in')
    const row: ShoppingList = { id: crypto.randomUUID(), space_id: spaceId, created_by: userId, name: name.trim(), icon: 'basket', sort_order: shoppingLists.filter(list => list.space_id === spaceId).length, created_at: new Date().toISOString() }
    if (!row.name) throw new Error('List name is required')
    if (demo) { setShoppingLists(current => [...current, row]); return row }
    if (!supabase) throw new Error('Supabase is not configured')
    const { error } = await supabase.from('shopping_lists').insert(row as never)
    if (error) throw new Error(error.message.includes('shopping_lists') ? 'Run migration 003 to enable named shared shopping lists.' : error.message)
    setShoppingLists(current => [...current, row])
    return row
  }

  const createCapture = async (input: { kind: CaptureRecord['kind']; title: string; raw_text?: string | null; source_url?: string | null; space_id?: string | null; parsed_kind?: string | null; parsed_data?: Record<string, unknown>; file?: File | null; status?: CaptureRecord['status']; created_item_id?: string | null; created_event_id?: string | null; created_note_id?: string | null; contact_id?: string | null; ai_status?: CaptureRecord['ai_status'] }): Promise<CaptureRecord> => {
    if (!userId) throw new Error('Not signed in')
    let storagePath: string | null = null
    if (input.file && !demo) {
      if (!supabase) throw new Error('Supabase is not configured')
      if (!navigator.onLine) throw new Error('Connect to the internet to upload a file or image.')
      const safe = input.file.name.replace(/[^a-z0-9._-]+/gi,'-').slice(-120) || 'capture'
      storagePath = `${userId}/${new Date().toISOString().slice(0,7)}/${crypto.randomUUID()}-${safe}`
      const upload = await supabase.storage.from('justglance-captures').upload(storagePath, input.file, { upsert: false, contentType: input.file.type || undefined })
      if (upload.error) throw new Error(upload.error.message.includes('Bucket') ? 'Run migration 003 to enable file and image capture.' : upload.error.message)
    }
    const row: CaptureRecord = {
      id: crypto.randomUUID(), user_id: userId, space_id: input.space_id || null, kind: input.kind,
      title: (input.title.trim() || input.file?.name || 'Capture').slice(0,500), raw_text: input.raw_text || null, source_url: input.source_url || null,
      mime_type: input.file?.type || null, file_name: input.file?.name || null, storage_path: storagePath,
      parsed_kind: input.parsed_kind || null, parsed_data: input.parsed_data || {}, status: input.status || 'inbox',
      created_item_id: input.created_item_id || null, created_event_id: input.created_event_id || null, created_note_id: input.created_note_id || null,
      contact_id: input.contact_id || null, ai_status: input.ai_status || 'not_requested', ai_summary: null, ai_entities: {}, ai_suggestions: {},
      created_at: new Date().toISOString(),
    }
    if (demo) { setCaptures(current => [row, ...current]); return row }
    if (!supabase) throw new Error('Supabase is not configured')
    let insertResult = await supabase.from('captures').insert(row as never)
    if (insertResult.error && /ai_status|ai_summary|ai_entities|ai_suggestions|contact_id|schema cache/i.test(String(insertResult.error.message || ''))) {
      const { contact_id: _contact, ai_status: _aiStatus, ai_summary: _aiSummary, ai_entities: _aiEntities, ai_suggestions: _aiSuggestions, ...legacyRow } = row
      insertResult = await supabase.from('captures').insert(legacyRow as never)
    }
    if (insertResult.error) {
      if (storagePath) await supabase.storage.from('justglance-captures').remove([storagePath])
      throw new Error(insertResult.error.message.includes('captures') ? 'Run migration 003 to enable Smart Intake.' : insertResult.error.message)
    }
    setCaptures(current => [row, ...current])
    return row
  }

  const updateCapture = async (id: string, patch: Partial<CaptureRecord>) => {
    const updated = { ...patch, updated_at: new Date().toISOString() }
    setCaptures(current => current.map(capture => capture.id === id ? { ...capture, ...updated } : capture))
    if (!demo && supabase) {
      const serverPatch = { ...updated } as Record<string, unknown>
      delete serverPatch.id; delete serverPatch.user_id
      const { error } = await supabase.from('captures').update(serverPatch as never).eq('id', id)
      if (error) throw error
    }
  }

  const createContact = async (input: Partial<Contact> & { display_name: string }): Promise<Contact> => {
    if (!userId) throw new Error('Not signed in')
    const name = input.display_name.trim()
    if (!name) throw new Error('Contact name is required')
    const now = new Date().toISOString()
    const row: Contact = {
      id: input.id || crypto.randomUUID(), user_id: userId, display_name: name,
      first_name: input.first_name?.trim() || null, last_name: input.last_name?.trim() || null,
      nickname: input.nickname?.trim() || null, relationship: input.relationship?.trim() || null,
      company: input.company?.trim() || null, job_title: input.job_title?.trim() || null,
      email_personal: input.email_personal?.trim() || null, email_work: input.email_work?.trim() || null,
      phone_mobile: input.phone_mobile?.trim() || null, phone_home: input.phone_home?.trim() || null, phone_work: input.phone_work?.trim() || null,
      address_home: input.address_home?.trim() || null, address_business: input.address_business?.trim() || null,
      birthday: input.birthday || null, notes: input.notes?.trim() || null, tags: input.tags || [], avatar_url: input.avatar_url || null,
      linked_profile_id: input.linked_profile_id || null, created_at: input.created_at || now, updated_at: now, deleted_at: null,
    }
    setContacts(current => {
      const next = [...current.filter(contact => contact.id !== row.id), row].sort((a,b) => a.display_name.localeCompare(b.display_name))
      writeSnapshotPart(userId, { contacts: next })
      return next
    })
    if (!demo && supabase) {
      const { error } = await supabase.from('contacts').insert(row as never)
      if (error) {
        setContacts(current => current.filter(contact => contact.id !== row.id))
        throw new Error(String(error.message || '').includes('contacts') ? 'Run migration 005 to enable Contacts.' : error.message)
      }
    }
    return row
  }

  const updateContact = async (id: string, patch: Partial<Contact>) => {
    const clean = { ...patch, updated_at: new Date().toISOString() }
    delete (clean as any).id; delete (clean as any).user_id
    setContacts(current => {
      const next = current.map(contact => contact.id === id ? { ...contact, ...clean } : contact).sort((a,b) => a.display_name.localeCompare(b.display_name))
      if (userId) writeSnapshotPart(userId, { contacts: next })
      return next
    })
    if (!demo && supabase) {
      const { error } = await supabase.from('contacts').update(clean as never).eq('id', id)
      if (error) throw error
    }
  }

  const deleteContact = async (id: string) => {
    const deletedAt = new Date().toISOString()
    setContacts(current => current.filter(contact => contact.id !== id))
    if (!demo && supabase) {
      const { error } = await supabase.from('contacts').update({ deleted_at: deletedAt } as never).eq('id', id)
      if (error) throw error
    }
  }

  const analyzeCapture = async (id: string): Promise<UniversalIntakeAnalysis | null> => {
    if (demo || !supabase || !navigator.onLine) return null
    setCaptures(current => current.map(capture => capture.id === id ? { ...capture, ai_status: 'processing' } : capture))
    const { data, error } = await supabase.functions.invoke('smart-intake', { body: { capture_id: id } })
    if (error) {
      setCaptures(current => current.map(capture => capture.id === id ? { ...capture, ai_status: 'error', ai_summary: error.message } : capture))
      return null
    }
    const analysis = (data as any)?.analysis as UniversalIntakeAnalysis | undefined
    if (!analysis) return null
    setCaptures(current => current.map(capture => capture.id === id ? {
      ...capture, title: analysis.title || capture.title, parsed_kind: analysis.kind,
      ai_status: 'analyzed', ai_summary: analysis.summary || null,
      ai_entities: { person: analysis.person, phone: analysis.phone, email: analysis.email, location: analysis.location, url: analysis.url, contact: analysis.contact, shopping: analysis.shopping },
      ai_suggestions: { action: analysis.suggested_action, due_date: analysis.due_date, due_time: analysis.due_time, tags: analysis.tags, confidence: analysis.confidence },
      parsed_data: { ...(capture.parsed_data || {}), ai: analysis },
    } : capture))
    return analysis
  }

  const getCaptureSignedUrl = async (storagePath: string) => {
    if (!supabase || !storagePath || !navigator.onLine) return null
    const { data, error } = await supabase.storage.from('justglance-captures').createSignedUrl(storagePath, 3600)
    return error ? null : data?.signedUrl || null
  }

  const importCalendarEvents = async (incoming: Array<Omit<EventItem,'id'|'user_id'>>, sourceName = 'Calendar file') => {
    if (!userId) throw new Error('Not signed in')
    if (!incoming.length) return { imported: 0, skipped: 0 }
    let imported = 0, skipped = 0
    if (demo) {
      const rows = incoming.map(event => ({ id: crypto.randomUUID(), user_id: userId, ...event })) as EventItem[]
      setEvents(current => [...current, ...rows])
      return { imported: rows.length, skipped: 0 }
    }
    if (!supabase || !navigator.onLine) throw new Error('Connect to the internet to import calendar events.')
    for (const event of incoming) {
      if (event.external_id && events.some(existing => existing.provider === event.provider && existing.external_id === event.external_id)) { skipped++; continue }
      const row: EventItem = { id: crypto.randomUUID(), user_id: userId, ...event }
      const { error } = await supabase.from('events').insert(row as never)
      if (error) {
        if ((error as any).code === '23505') { skipped++; continue }
        throw error
      }
      imported++
    }
    const importRow = { id: crypto.randomUUID(), user_id: userId, provider: incoming[0]?.provider || 'ics', source_name: sourceName, imported_count: imported, skipped_count: skipped, metadata: { total: incoming.length } }
    await supabase.from('calendar_imports').insert(importRow as never)
    await refresh()
    return { imported, skipped }
  }

  const updateProfile = async (patch: Partial<Profile>) => {
    if (!userId) return
    const base: Profile = profile || {
      id: userId,
      email: null,
      display_name: String(patch.display_name || patch.greeting_name || 'User'),
      greeting_name: String(patch.greeting_name || 'User'),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      wake_time: '07:00',
      sleep_time: '23:00',
      theme: 'system',
      onboarding_complete: false,
    }
    const next = { ...base, ...patch }
    setProfile(next)
    localStorage.setItem(profileKey(userId), JSON.stringify(next))
    writeSnapshotPart(userId, { profile: next })
    if (!demo && supabase) {
      if (!navigator.onLine) enqueueMutation(userId, { table: 'profiles', action: 'update', payload: { id: userId, patch } })
      else {
        const { error } = await supabase.from('profiles').upsert(next as never, { onConflict: 'id' })
        if (error) {
          enqueueMutation(userId, { table: 'profiles', action: 'update', payload: { id: userId, patch } })
          setSyncState('error')
        }
      }
    }
  }

  const updatePreferences = async (patch: Partial<UserPreferences>) => {
    if (!userId) return
    const base: UserPreferences = preferences || { ...demoPreferences, user_id: userId }
    const next = { ...base, ...patch, user_id: userId }
    setPreferences(next)
    writeSnapshotPart(userId, { preferences: next })
    if (!demo && supabase) {
      if (!navigator.onLine) enqueueMutation(userId, { table: 'user_preferences', action: 'update', payload: { id: userId, idField: 'user_id', patch } })
      else {
        const { error } = await supabase.from('user_preferences').upsert(next as never, { onConflict: 'user_id' })
        if (error) {
          enqueueMutation(userId, { table: 'user_preferences', action: 'update', payload: { id: userId, idField: 'user_id', patch } })
          setSyncState('error')
        }
      }
    }
  }

  const createPlace = async (place: Partial<Place> & { name: string }) => {
    if (!userId) return
    const row = { id: crypto.randomUUID(), user_id: userId, category: 'other', radius_meters: 200, ...place }
    setPlaces(current => {
      const next = [...current, row as Place]
      writeSnapshotPart(userId, { places: next })
      return next
    })
    if (!demo && supabase) {
      if (!navigator.onLine) enqueueMutation(userId, { table: 'places', action: 'upsert', payload: { data: row as Record<string, unknown>, onConflict: 'id' } })
      else {
        const { error } = await supabase.from('places').insert(row as never)
        if (error) {
          enqueueMutation(userId, { table: 'places', action: 'upsert', payload: { data: row as Record<string, unknown>, onConflict: 'id' } })
          setSyncState('error')
        }
      }
    }
  }

  const createEvent = async (event: Omit<EventItem, 'id' | 'user_id'>): Promise<EventItem> => {
    if (!userId) throw new Error('Not signed in')
    const row: EventItem = { id: crypto.randomUUID(), user_id: userId, ...event }
    setEvents(current => {
      const next = [...current, row].sort((a, b) => `${a.event_date}${a.start_time}`.localeCompare(`${b.event_date}${b.start_time}`))
      writeSnapshotPart(userId, { events: next })
      return next
    })
    if (!demo && supabase) {
      if (!navigator.onLine) enqueueMutation(userId, { table: 'events', action: 'upsert', payload: { data: row as unknown as Record<string, unknown>, onConflict: 'id' } })
      else {
        const { error } = await supabase.from('events').insert(row as never)
        if (error) {
          enqueueMutation(userId, { table: 'events', action: 'upsert', payload: { data: row as unknown as Record<string, unknown>, onConflict: 'id' } })
          setSyncState('error')
        }
      }
    }
    return row
  }

  const createNote = async (body: string, spaceId?: string | null) => {
    if (!userId || !body.trim()) return
    const clean = body.trim()
    const row: Note = {
      id: crypto.randomUUID(),
      user_id: userId,
      space_id: spaceId || null,
      title: clean.length > 64 ? `${clean.slice(0, 61)}…` : clean,
      body: clean,
      tags: [],
      created_at: new Date().toISOString(),
    }
    setNotes(current => {
      const next = [row, ...current]
      writeSnapshotPart(userId, { notes: next })
      return next
    })
    if (!demo && supabase) {
      if (!navigator.onLine) enqueueMutation(userId, { table: 'notes', action: 'upsert', payload: { data: row as unknown as Record<string, unknown>, onConflict: 'id' } })
      else {
        const { error } = await supabase.from('notes').insert(row as never)
        if (error) {
          enqueueMutation(userId, { table: 'notes', action: 'upsert', payload: { data: row as unknown as Record<string, unknown>, onConflict: 'id' } })
          setSyncState('error')
        }
      }
    }
  }

  const getSpaceMembers = async (spaceId: string): Promise<SpaceMember[]> => {
    if (demo) {
      return [{ space_id: spaceId, user_id: userId || demoProfile.id, role: 'owner', permissions: normalizeSpacePermissions(), display_name: profile?.display_name || 'Demo User', greeting_name: profile?.greeting_name || 'Demo', avatar_url: profile?.avatar_url || null }]
    }
    if (!supabase || !navigator.onLine) return []
    let result = await supabase.rpc('get_space_members_v2', { p_space: spaceId })
    if (result.error && ['PGRST202','42883'].includes(String((result.error as any).code || ''))) result = await supabase.rpc('get_space_members', { p_space: spaceId })
    if (result.error) {
      console.error('Could not load space members', result.error)
      return []
    }
    return (result.data || []).map((row: any) => ({ ...row, permissions: row.permissions || null, space_id: spaceId })) as SpaceMember[]
  }

  const value = useMemo(() => ({
    profile, preferences, items, spaces, members, places, events, notes, activity, captures, contacts, shoppingLists, collaborationAvailable, loading, syncState,
    refresh, createItem, updateItem, updateShopping, completeItem, deleteItem, snoozeItem, createSpace, createInvite,
    consumeInvite, updateMemberAccess, createShoppingList, createCapture, updateCapture, analyzeCapture, getCaptureSignedUrl, createContact, updateContact, deleteContact, importCalendarEvents, updateProfile, updatePreferences, createPlace, createEvent, createNote, getSpaceMembers,
  }), [profile, preferences, items, spaces, members, places, events, notes, activity, captures, contacts, shoppingLists, collaborationAvailable, loading, syncState, refresh])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAppData() {
  const value = useContext(Ctx)
  if (!value) throw new Error('useAppData must be used inside AppDataProvider')
  return value
}
