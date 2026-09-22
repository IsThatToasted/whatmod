import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext.js';
import { demoActivity, demoEvents, demoItems, demoMembers, demoNotes, demoPlaces, demoProfile, demoSpaces } from '../lib/demo.js';
import { supabase } from '../lib/supabase.js';
import { enqueueMutation, getOfflineQueue, removeMutation } from '../lib/offlineQueue.js';
import { nextRecurrenceDate } from '../lib/recurrence.js';
import { normalizeSpacePermissions } from '../lib/spacePermissions.js';
const demoPreferences = {
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
};
const Ctx = createContext(null);
const localKey = (uid) => `justglance:local:${uid}`;
const profileKey = (uid) => `justglance:profile:${uid}`;
const snapshotKey = (uid) => `justglance:snapshot:${uid}`;
function withTimeout(promise, milliseconds, label) {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = window.setTimeout(() => reject(new Error(`${label} timed out after ${milliseconds}ms`)), milliseconds);
    });
    return Promise.race([promise, timeout]).finally(() => {
        if (timer !== undefined)
            window.clearTimeout(timer);
    });
}
function writeSnapshotPart(uid, patch) {
    try {
        const existing = JSON.parse(localStorage.getItem(snapshotKey(uid)) || '{}');
        localStorage.setItem(snapshotKey(uid), JSON.stringify({ ...existing, ...patch, saved_at: new Date().toISOString() }));
    }
    catch {
        // Storage quota/private-mode failures should never block the live app.
    }
}
function stripClientOnly(item) {
    const { place_name: _placeName, shopping: _shopping, ...payload } = item;
    return payload;
}
export function AppDataProvider({ children }) {
    const { userId, demo } = useAuth();
    return _jsx(AppDataStateProvider, { userId: userId, demo: demo, children: children }, demo ? 'demo' : userId || 'signed-out');
}
function AppDataStateProvider({ children, userId, demo }) {
    const [profile, setProfile] = useState(demo ? demoProfile : null);
    const [preferences, setPreferences] = useState(demo ? demoPreferences : null);
    const [items, setItems] = useState(demo ? demoItems : []);
    const [spaces, setSpaces] = useState(demo ? demoSpaces : []);
    const [members, setMembers] = useState(demo ? demoMembers : []);
    const [places, setPlaces] = useState(demo ? demoPlaces : []);
    const [events, setEvents] = useState(demo ? demoEvents : []);
    const [notes, setNotes] = useState(demo ? demoNotes : []);
    const [activity, setActivity] = useState(demo ? demoActivity : []);
    const [captures, setCaptures] = useState([]);
    const [shoppingLists, setShoppingLists] = useState([]);
    const [collaborationAvailable, setCollaborationAvailable] = useState(demo);
    const [loading, setLoading] = useState(!demo);
    const [syncState, setSyncState] = useState(navigator.onLine ? 'synced' : 'offline');
    const persistLocal = useCallback((next) => {
        if (userId)
            localStorage.setItem(localKey(userId), JSON.stringify(next));
    }, [userId]);
    const refresh = useCallback(async () => {
        if (demo || !supabase || !userId) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const [p, pref, i, s, m, pl, e, n, a, sl, cap] = await withTimeout(Promise.all([
                supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
                supabase.from('user_preferences').select('*').eq('user_id', userId).maybeSingle(),
                (async () => {
                    const modern = await supabase.from('items').select('*, places(name), shopping_items(quantity,unit,preferred_store,estimated_price,aisle_category,list_id)').is('deleted_at', null).order('created_at', { ascending: false });
                    if (!modern.error || !String(modern.error.message || '').includes('list_id'))
                        return modern;
                    return supabase.from('items').select('*, places(name), shopping_items(quantity,unit,preferred_store,estimated_price,aisle_category)').is('deleted_at', null).order('created_at', { ascending: false });
                })(),
                supabase.from('spaces').select('*, space_members!inner(role)').eq('space_members.user_id', userId).order('created_at'),
                (async () => {
                    const modern = await supabase.rpc('get_accessible_space_members_v2');
                    return modern.error ? supabase.rpc('get_accessible_space_members') : modern;
                })(),
                supabase.from('places').select('*').order('name'),
                supabase.from('events').select('*').is('deleted_at', null).gte('event_date', new Date().toISOString().slice(0, 10)).order('event_date').order('start_time'),
                supabase.from('notes').select('*').is('deleted_at', null).order('created_at', { ascending: false }).limit(100),
                supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(50),
                supabase.from('shopping_lists').select('*').is('archived_at', null).order('sort_order').order('created_at'),
                supabase.from('captures').select('*').eq('status', 'inbox').order('created_at', { ascending: false }).limit(100),
            ]), 9000, 'Initial data load');
            if (p.data) {
                setProfile(p.data);
                localStorage.setItem(profileKey(userId), JSON.stringify(p.data));
            }
            if (pref.data)
                setPreferences(pref.data);
            if (i.error)
                throw i.error;
            const mapped = (i.data || []).map((row) => ({
                ...row,
                place_name: row.places?.name ?? null,
                shopping: row.shopping_items ?? null,
                places: undefined,
                shopping_items: undefined,
            }));
            const nextSpaces = (s.data || []).map((x) => ({ ...x, role: x.space_members?.[0]?.role }));
            const nextMembers = (m.data || []).map((x) => ({ space_id: x.space_id, user_id: x.user_id, role: x.role, permissions: x.permissions || null, display_name: x.display_name || 'Member', greeting_name: x.greeting_name || null, avatar_url: x.avatar_url || null }));
            const nextPlaces = (pl.data || []);
            const nextEvents = (e.data || []);
            const nextNotes = (n.data || []);
            const nextActivity = (a.data || []);
            const nextShoppingLists = (sl.data || []);
            const nextCaptures = (cap.data || []);
            setCollaborationAvailable(!sl.error && !cap.error);
            setItems(mapped);
            persistLocal(mapped);
            setSpaces(nextSpaces);
            setMembers(nextMembers);
            setPlaces(nextPlaces);
            setEvents(nextEvents);
            setNotes(nextNotes);
            setActivity(nextActivity);
            setShoppingLists(nextShoppingLists);
            setCaptures(nextCaptures);
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
            });
            setSyncState('synced');
        }
        catch {
            try {
                const snapshot = JSON.parse(localStorage.getItem(snapshotKey(userId)) || 'null');
                if (snapshot) {
                    if (snapshot.profile)
                        setProfile(snapshot.profile);
                    if (snapshot.preferences)
                        setPreferences(snapshot.preferences);
                    if (snapshot.items)
                        setItems(snapshot.items);
                    if (snapshot.spaces)
                        setSpaces(snapshot.spaces);
                    if (snapshot.members)
                        setMembers(snapshot.members);
                    if (snapshot.places)
                        setPlaces(snapshot.places);
                    if (snapshot.events)
                        setEvents(snapshot.events);
                    if (snapshot.notes)
                        setNotes(snapshot.notes);
                    if (snapshot.activity)
                        setActivity(snapshot.activity);
                    if (snapshot.shoppingLists)
                        setShoppingLists(snapshot.shoppingLists);
                    if (snapshot.captures)
                        setCaptures(snapshot.captures);
                }
                else {
                    const cached = localStorage.getItem(localKey(userId));
                    if (cached)
                        setItems(JSON.parse(cached));
                    const cachedProfile = localStorage.getItem(profileKey(userId));
                    if (cachedProfile)
                        setProfile(JSON.parse(cachedProfile));
                }
            }
            catch {
                // Ignore a corrupt cache and retry the server on the next refresh.
            }
            setSyncState(navigator.onLine ? 'error' : 'offline');
        }
        finally {
            setLoading(false);
        }
    }, [demo, userId, persistLocal]);
    const flushQueue = useCallback(async () => {
        if (!supabase || demo || !navigator.onLine)
            return;
        setSyncState('syncing');
        for (const mutation of getOfflineQueue(userId)) {
            try {
                const query = supabase.from(mutation.table);
                if (mutation.action === 'insert') {
                    const { error } = await query.insert(mutation.payload);
                    if (error)
                        throw error;
                }
                if (mutation.action === 'upsert') {
                    const payload = mutation.payload;
                    const { error } = await query.upsert(payload.data, { onConflict: payload.onConflict });
                    if (error)
                        throw error;
                }
                if (mutation.action === 'update') {
                    const payload = mutation.payload;
                    const { error } = await query.update(payload.patch).eq(payload.idField || 'id', payload.id);
                    if (error)
                        throw error;
                }
                if (mutation.action === 'delete') {
                    const payload = mutation.payload;
                    const { error } = await query.update({ deleted_at: new Date().toISOString() }).eq('id', payload.id);
                    if (error)
                        throw error;
                }
                removeMutation(mutation.id);
            }
            catch {
                setSyncState('error');
                return;
            }
        }
        await refresh();
    }, [demo, refresh, userId]);
    useEffect(() => { refresh(); }, [refresh]);
    useEffect(() => {
        const onOnline = () => { void flushQueue(); };
        const onOffline = () => setSyncState('offline');
        addEventListener('online', onOnline);
        addEventListener('offline', onOffline);
        return () => {
            removeEventListener('online', onOnline);
            removeEventListener('offline', onOffline);
        };
    }, [flushQueue]);
    useEffect(() => {
        if (demo || !supabase || !userId)
            return;
        const client = supabase;
        const channel = client
            .channel(`life-${userId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, () => { void refresh(); })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'shopping_items' }, () => { void refresh(); })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'space_members' }, () => { void refresh(); })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_log' }, () => { void refresh(); })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => { void refresh(); })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' }, () => { void refresh(); })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'shopping_lists' }, () => { void refresh(); })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'captures' }, () => { void refresh(); })
            .subscribe();
        return () => { void client.removeChannel(channel); };
    }, [demo, userId, refresh]);
    const createItem = async (parsed, source, extra = {}) => {
        if (!userId)
            throw new Error('Not signed in');
        const item = {
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
        };
        setItems(current => {
            const next = [item, ...current];
            persistLocal(next);
            writeSnapshotPart(userId, { items: next });
            return next;
        });
        if (!demo && supabase) {
            const payload = stripClientOnly(item);
            if (!navigator.onLine) {
                enqueueMutation(userId, { table: 'items', action: 'upsert', payload: { data: payload, onConflict: 'id' } });
                if (item.type === 'shopping' && item.shopping)
                    enqueueMutation(userId, { table: 'shopping_items', action: 'upsert', payload: { data: { item_id: item.id, ...item.shopping }, onConflict: 'item_id' } });
            }
            else {
                const { error } = await supabase.from('items').insert(payload);
                if (error) {
                    enqueueMutation(userId, { table: 'items', action: 'upsert', payload: { data: payload, onConflict: 'id' } });
                    if (item.type === 'shopping' && item.shopping) {
                        enqueueMutation(userId, { table: 'shopping_items', action: 'upsert', payload: { data: { item_id: item.id, ...item.shopping }, onConflict: 'item_id' } });
                    }
                    setSyncState('error');
                }
                else if (item.type === 'shopping' && item.shopping) {
                    const shoppingData = { item_id: item.id, ...item.shopping };
                    const { error: shoppingError } = await supabase.from('shopping_items').upsert(shoppingData, { onConflict: 'item_id' });
                    if (shoppingError) {
                        enqueueMutation(userId, { table: 'shopping_items', action: 'upsert', payload: { data: shoppingData, onConflict: 'item_id' } });
                        setSyncState('error');
                    }
                }
            }
        }
        return item;
    };
    const updateItem = async (id, patch) => {
        const updated = { ...patch, updated_at: new Date().toISOString() };
        setItems(current => {
            const next = current.map(item => item.id === id ? { ...item, ...updated } : item);
            persistLocal(next);
            if (userId)
                writeSnapshotPart(userId, { items: next });
            return next;
        });
        const serverPatch = { ...updated };
        delete serverPatch.place_name;
        delete serverPatch.shopping;
        if (!demo && supabase) {
            if (!navigator.onLine)
                enqueueMutation(userId, { table: 'items', action: 'update', payload: { id, patch: serverPatch } });
            else {
                const { error } = await supabase.from('items').update(serverPatch).eq('id', id);
                if (error) {
                    enqueueMutation(userId, { table: 'items', action: 'update', payload: { id, patch: serverPatch } });
                    setSyncState('error');
                }
            }
        }
    };
    const updateShopping = async (id, patch) => {
        const normalized = {
            quantity: patch.quantity ?? null,
            unit: patch.unit?.trim() || null,
            preferred_store: patch.preferred_store?.trim() || null,
            estimated_price: patch.estimated_price ?? null,
            aisle_category: patch.aisle_category?.trim() || null,
        };
        if (Object.prototype.hasOwnProperty.call(patch, 'list_id'))
            normalized.list_id = patch.list_id || null;
        setItems(current => {
            const next = current.map(item => item.id === id ? { ...item, shopping: { ...(item.shopping || {}), ...normalized } } : item);
            persistLocal(next);
            if (userId)
                writeSnapshotPart(userId, { items: next });
            return next;
        });
        if (!demo && supabase) {
            const data = { item_id: id, ...normalized };
            if (!navigator.onLine)
                enqueueMutation(userId, { table: 'shopping_items', action: 'upsert', payload: { data, onConflict: 'item_id' } });
            else {
                const { error } = await supabase.from('shopping_items').upsert(data, { onConflict: 'item_id' });
                if (error) {
                    enqueueMutation(userId, { table: 'shopping_items', action: 'upsert', payload: { data, onConflict: 'item_id' } });
                    setSyncState('error');
                }
            }
        }
    };
    const completeItem = async (id) => {
        const item = items.find(candidate => candidate.id === id);
        if (!item)
            return;
        await updateItem(id, { status: 'completed', completed_at: new Date().toISOString() });
        const nextDate = nextRecurrenceDate(item.recurrence_rule, item.due_date);
        if (!nextDate)
            return;
        const parsed = item.parser_result || {
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
        };
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
        });
    };
    const deleteItem = async (id) => {
        setItems(current => {
            const next = current.filter(item => item.id !== id);
            persistLocal(next);
            if (userId)
                writeSnapshotPart(userId, { items: next });
            return next;
        });
        if (!demo && supabase) {
            if (!navigator.onLine)
                enqueueMutation(userId, { table: 'items', action: 'delete', payload: { id } });
            else {
                const { error } = await supabase.from('items').update({ deleted_at: new Date().toISOString() }).eq('id', id);
                if (error) {
                    enqueueMutation(userId, { table: 'items', action: 'delete', payload: { id } });
                    setSyncState('error');
                }
            }
        }
    };
    const snoozeItem = (id, hours = 24) => {
        const item = items.find(candidate => candidate.id === id);
        return updateItem(id, {
            snoozed_until: new Date(Date.now() + hours * 3600000).toISOString(),
            snooze_count: (item?.snooze_count || 0) + 1,
        });
    };
    const createSpace = async (name) => {
        if (!userId)
            return;
        if (demo) {
            setSpaces(current => [...current, { id: crypto.randomUUID(), owner_id: userId, name, icon: 'home', role: 'owner', created_at: new Date().toISOString() }]);
            return;
        }
        if (!navigator.onLine)
            throw new Error('Connect to the internet to create a shared space.');
        if (supabase) {
            const { error } = await supabase.rpc('create_space_with_owner', { p_name: name, p_icon: 'home' });
            if (error)
                throw error;
            await refresh();
        }
    };
    const createInvite = async (spaceId, email, role = 'member', permissions = {}) => {
        const expires = new Date(Date.now() + 7 * 86400000).toISOString();
        if (demo)
            throw new Error('This is demo mode, so it cannot create a real shareable invite. Sign in to the Supabase-backed app first.');
        if (!supabase)
            throw new Error('Supabase is not configured');
        if (!navigator.onLine)
            throw new Error('Connect to the internet to create an invite link.');
        const normalized = normalizeSpacePermissions(permissions);
        const modern = await supabase.rpc('create_space_invite_v2', {
            p_space: spaceId,
            p_email: email?.trim() || null,
            p_role: role,
            p_permissions: normalized,
        });
        if (!modern.error && modern.data) {
            const value = modern.data;
            return { token: String(value.token), space_id: String(value.space_id || spaceId), expires_at: String(value.expires_at || expires) };
        }
        // Migration-safe fallback: older databases can still create a basic member invite.
        const missingModernRpc = modern.error && ['PGRST202', '42883'].includes(String(modern.error.code || ''));
        if (!missingModernRpc)
            throw modern.error;
        if (role !== 'member')
            throw new Error('Run migration 003 before inviting admins or using category permissions.');
        const legacy = await supabase.rpc('create_space_invite', { p_space: spaceId, p_email: email?.trim() || null, p_role: 'member' });
        if (legacy.error)
            throw legacy.error;
        return { token: String(legacy.data), space_id: spaceId, expires_at: expires };
    };
    const consumeInvite = async (token) => {
        if (demo)
            return spaces[0]?.id || '';
        if (!supabase)
            throw new Error('Supabase is not configured');
        let result = await supabase.rpc('consume_space_invite_v2', { p_token: token });
        if (result.error && ['PGRST202', '42883'].includes(String(result.error.code || ''))) {
            result = await supabase.rpc('consume_space_invite', { p_token: token });
        }
        if (result.error)
            throw result.error;
        await refresh();
        return String(result.data);
    };
    const updateMemberAccess = async (spaceId, memberUserId, permissions, role) => {
        if (demo) {
            setMembers(current => current.map(member => member.space_id === spaceId && member.user_id === memberUserId ? { ...member, permissions: normalizeSpacePermissions(permissions), role: role || member.role } : member));
            return;
        }
        if (!supabase)
            throw new Error('Supabase is not configured');
        const { error } = await supabase.rpc('update_space_member_access', { p_space: spaceId, p_user: memberUserId, p_permissions: normalizeSpacePermissions(permissions), p_role: role || null });
        if (error)
            throw error;
        await refresh();
    };
    const createShoppingList = async (spaceId, name) => {
        if (!userId)
            throw new Error('Not signed in');
        const row = { id: crypto.randomUUID(), space_id: spaceId, created_by: userId, name: name.trim(), icon: 'basket', sort_order: shoppingLists.filter(list => list.space_id === spaceId).length, created_at: new Date().toISOString() };
        if (!row.name)
            throw new Error('List name is required');
        if (demo) {
            setShoppingLists(current => [...current, row]);
            return row;
        }
        if (!supabase)
            throw new Error('Supabase is not configured');
        const { error } = await supabase.from('shopping_lists').insert(row);
        if (error)
            throw new Error(error.message.includes('shopping_lists') ? 'Run migration 003 to enable named shared shopping lists.' : error.message);
        setShoppingLists(current => [...current, row]);
        return row;
    };
    const createCapture = async (input) => {
        if (!userId)
            throw new Error('Not signed in');
        let storagePath = null;
        if (input.file && !demo) {
            if (!supabase)
                throw new Error('Supabase is not configured');
            if (!navigator.onLine)
                throw new Error('Connect to the internet to upload a file or image.');
            const safe = input.file.name.replace(/[^a-z0-9._-]+/gi, '-').slice(-120) || 'capture';
            storagePath = `${userId}/${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}-${safe}`;
            const upload = await supabase.storage.from('justglance-captures').upload(storagePath, input.file, { upsert: false, contentType: input.file.type || undefined });
            if (upload.error)
                throw new Error(upload.error.message.includes('Bucket') ? 'Run migration 003 to enable file and image capture.' : upload.error.message);
        }
        const row = {
            id: crypto.randomUUID(), user_id: userId, space_id: input.space_id || null, kind: input.kind,
            title: (input.title.trim() || input.file?.name || 'Capture').slice(0, 500), raw_text: input.raw_text || null, source_url: input.source_url || null,
            mime_type: input.file?.type || null, file_name: input.file?.name || null, storage_path: storagePath,
            parsed_kind: input.parsed_kind || null, parsed_data: input.parsed_data || {}, status: input.status || 'inbox',
            created_item_id: input.created_item_id || null, created_event_id: input.created_event_id || null, created_note_id: input.created_note_id || null,
            created_at: new Date().toISOString(),
        };
        if (demo) {
            setCaptures(current => [row, ...current]);
            return row;
        }
        if (!supabase)
            throw new Error('Supabase is not configured');
        const { error } = await supabase.from('captures').insert(row);
        if (error) {
            if (storagePath)
                await supabase.storage.from('justglance-captures').remove([storagePath]);
            throw new Error(error.message.includes('captures') ? 'Run migration 003 to enable Smart Intake.' : error.message);
        }
        setCaptures(current => [row, ...current]);
        return row;
    };
    const updateCapture = async (id, patch) => {
        const updated = { ...patch, updated_at: new Date().toISOString() };
        setCaptures(current => current.map(capture => capture.id === id ? { ...capture, ...updated } : capture).filter(capture => capture.status === 'inbox'));
        if (!demo && supabase) {
            const serverPatch = { ...updated };
            delete serverPatch.id;
            delete serverPatch.user_id;
            const { error } = await supabase.from('captures').update(serverPatch).eq('id', id);
            if (error)
                throw error;
        }
    };
    const importCalendarEvents = async (incoming, sourceName = 'Calendar file') => {
        if (!userId)
            throw new Error('Not signed in');
        if (!incoming.length)
            return { imported: 0, skipped: 0 };
        let imported = 0, skipped = 0;
        if (demo) {
            const rows = incoming.map(event => ({ id: crypto.randomUUID(), user_id: userId, ...event }));
            setEvents(current => [...current, ...rows]);
            return { imported: rows.length, skipped: 0 };
        }
        if (!supabase || !navigator.onLine)
            throw new Error('Connect to the internet to import calendar events.');
        for (const event of incoming) {
            if (event.external_id && events.some(existing => existing.provider === event.provider && existing.external_id === event.external_id)) {
                skipped++;
                continue;
            }
            const row = { id: crypto.randomUUID(), user_id: userId, ...event };
            const { error } = await supabase.from('events').insert(row);
            if (error) {
                if (error.code === '23505') {
                    skipped++;
                    continue;
                }
                throw error;
            }
            imported++;
        }
        const importRow = { id: crypto.randomUUID(), user_id: userId, provider: incoming[0]?.provider || 'ics', source_name: sourceName, imported_count: imported, skipped_count: skipped, metadata: { total: incoming.length } };
        await supabase.from('calendar_imports').insert(importRow);
        await refresh();
        return { imported, skipped };
    };
    const updateProfile = async (patch) => {
        if (!userId)
            return;
        const base = profile || {
            id: userId,
            email: null,
            display_name: String(patch.display_name || patch.greeting_name || 'User'),
            greeting_name: String(patch.greeting_name || 'User'),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            wake_time: '07:00',
            sleep_time: '23:00',
            theme: 'system',
            onboarding_complete: false,
        };
        const next = { ...base, ...patch };
        setProfile(next);
        localStorage.setItem(profileKey(userId), JSON.stringify(next));
        writeSnapshotPart(userId, { profile: next });
        if (!demo && supabase) {
            if (!navigator.onLine)
                enqueueMutation(userId, { table: 'profiles', action: 'update', payload: { id: userId, patch } });
            else {
                const { error } = await supabase.from('profiles').upsert(next, { onConflict: 'id' });
                if (error) {
                    enqueueMutation(userId, { table: 'profiles', action: 'update', payload: { id: userId, patch } });
                    setSyncState('error');
                }
            }
        }
    };
    const updatePreferences = async (patch) => {
        if (!userId)
            return;
        const base = preferences || { ...demoPreferences, user_id: userId };
        const next = { ...base, ...patch, user_id: userId };
        setPreferences(next);
        writeSnapshotPart(userId, { preferences: next });
        if (!demo && supabase) {
            if (!navigator.onLine)
                enqueueMutation(userId, { table: 'user_preferences', action: 'update', payload: { id: userId, idField: 'user_id', patch } });
            else {
                const { error } = await supabase.from('user_preferences').upsert(next, { onConflict: 'user_id' });
                if (error) {
                    enqueueMutation(userId, { table: 'user_preferences', action: 'update', payload: { id: userId, idField: 'user_id', patch } });
                    setSyncState('error');
                }
            }
        }
    };
    const createPlace = async (place) => {
        if (!userId)
            return;
        const row = { id: crypto.randomUUID(), user_id: userId, category: 'other', radius_meters: 200, ...place };
        setPlaces(current => {
            const next = [...current, row];
            writeSnapshotPart(userId, { places: next });
            return next;
        });
        if (!demo && supabase) {
            if (!navigator.onLine)
                enqueueMutation(userId, { table: 'places', action: 'upsert', payload: { data: row, onConflict: 'id' } });
            else {
                const { error } = await supabase.from('places').insert(row);
                if (error) {
                    enqueueMutation(userId, { table: 'places', action: 'upsert', payload: { data: row, onConflict: 'id' } });
                    setSyncState('error');
                }
            }
        }
    };
    const createEvent = async (event) => {
        if (!userId)
            throw new Error('Not signed in');
        const row = { id: crypto.randomUUID(), user_id: userId, ...event };
        setEvents(current => {
            const next = [...current, row].sort((a, b) => `${a.event_date}${a.start_time}`.localeCompare(`${b.event_date}${b.start_time}`));
            writeSnapshotPart(userId, { events: next });
            return next;
        });
        if (!demo && supabase) {
            if (!navigator.onLine)
                enqueueMutation(userId, { table: 'events', action: 'upsert', payload: { data: row, onConflict: 'id' } });
            else {
                const { error } = await supabase.from('events').insert(row);
                if (error) {
                    enqueueMutation(userId, { table: 'events', action: 'upsert', payload: { data: row, onConflict: 'id' } });
                    setSyncState('error');
                }
            }
        }
        return row;
    };
    const createNote = async (body, spaceId) => {
        if (!userId || !body.trim())
            return;
        const clean = body.trim();
        const row = {
            id: crypto.randomUUID(),
            user_id: userId,
            space_id: spaceId || null,
            title: clean.length > 64 ? `${clean.slice(0, 61)}…` : clean,
            body: clean,
            tags: [],
            created_at: new Date().toISOString(),
        };
        setNotes(current => {
            const next = [row, ...current];
            writeSnapshotPart(userId, { notes: next });
            return next;
        });
        if (!demo && supabase) {
            if (!navigator.onLine)
                enqueueMutation(userId, { table: 'notes', action: 'upsert', payload: { data: row, onConflict: 'id' } });
            else {
                const { error } = await supabase.from('notes').insert(row);
                if (error) {
                    enqueueMutation(userId, { table: 'notes', action: 'upsert', payload: { data: row, onConflict: 'id' } });
                    setSyncState('error');
                }
            }
        }
    };
    const getSpaceMembers = async (spaceId) => {
        if (demo) {
            return [{ space_id: spaceId, user_id: userId || demoProfile.id, role: 'owner', permissions: normalizeSpacePermissions(), display_name: profile?.display_name || 'Demo User', greeting_name: profile?.greeting_name || 'Demo', avatar_url: profile?.avatar_url || null }];
        }
        if (!supabase || !navigator.onLine)
            return [];
        let result = await supabase.rpc('get_space_members_v2', { p_space: spaceId });
        if (result.error && ['PGRST202', '42883'].includes(String(result.error.code || '')))
            result = await supabase.rpc('get_space_members', { p_space: spaceId });
        if (result.error) {
            console.error('Could not load space members', result.error);
            return [];
        }
        return (result.data || []).map((row) => ({ ...row, permissions: row.permissions || null, space_id: spaceId }));
    };
    const value = useMemo(() => ({
        profile, preferences, items, spaces, members, places, events, notes, activity, captures, shoppingLists, collaborationAvailable, loading, syncState,
        refresh, createItem, updateItem, updateShopping, completeItem, deleteItem, snoozeItem, createSpace, createInvite,
        consumeInvite, updateMemberAccess, createShoppingList, createCapture, updateCapture, importCalendarEvents, updateProfile, updatePreferences, createPlace, createEvent, createNote, getSpaceMembers,
    }), [profile, preferences, items, spaces, members, places, events, notes, activity, captures, shoppingLists, collaborationAvailable, loading, syncState, refresh]);
    return _jsx(Ctx.Provider, { value: value, children: children });
}
export function useAppData() {
    const value = useContext(Ctx);
    if (!value)
        throw new Error('useAppData must be used inside AppDataProvider');
    return value;
}
