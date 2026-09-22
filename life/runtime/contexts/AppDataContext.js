import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext.js';
import { demoActivity, demoEvents, demoItems, demoMembers, demoNotes, demoPlaces, demoProfile, demoSpaces } from '../lib/demo.js';
import { supabase } from '../lib/supabase.js';
import { enqueueMutation, getOfflineQueue, removeMutation } from '../lib/offlineQueue.js';
import { nextRecurrenceDate } from '../lib/recurrence.js';
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
            const [p, pref, i, s, m, pl, e, n, a] = await withTimeout(Promise.all([
                supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
                supabase.from('user_preferences').select('*').eq('user_id', userId).maybeSingle(),
                supabase.from('items').select('*, places(name), shopping_items(quantity,unit,preferred_store,estimated_price,aisle_category)').is('deleted_at', null).order('created_at', { ascending: false }),
                supabase.from('spaces').select('*, space_members!inner(role)').eq('space_members.user_id', userId).order('created_at'),
                supabase.rpc('get_accessible_space_members'),
                supabase.from('places').select('*').order('name'),
                supabase.from('events').select('*').is('deleted_at', null).gte('event_date', new Date().toISOString().slice(0, 10)).order('event_date').order('start_time'),
                supabase.from('notes').select('*').is('deleted_at', null).order('created_at', { ascending: false }).limit(100),
                supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(50),
            ]), 8000, 'Initial data load');
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
            const nextMembers = (m.data || []).map((x) => ({ space_id: x.space_id, user_id: x.user_id, role: x.role, display_name: x.display_name || 'Member', greeting_name: x.greeting_name || null, avatar_url: x.avatar_url || null }));
            const nextPlaces = (pl.data || []);
            const nextEvents = (e.data || []);
            const nextNotes = (n.data || []);
            const nextActivity = (a.data || []);
            setItems(mapped);
            persistLocal(mapped);
            setSpaces(nextSpaces);
            setMembers(nextMembers);
            setPlaces(nextPlaces);
            setEvents(nextEvents);
            setNotes(nextNotes);
            setActivity(nextActivity);
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
    const createInvite = async (spaceId, email) => {
        if (demo)
            return `demo-${crypto.randomUUID()}`;
        if (!supabase)
            throw new Error('Supabase is not configured');
        const { data, error } = await supabase.rpc('create_space_invite', { p_space: spaceId, p_email: email || null, p_role: 'member' });
        if (error)
            throw error;
        return String(data);
    };
    const consumeInvite = async (token) => {
        if (demo)
            return spaces[0]?.id || '';
        if (!supabase)
            throw new Error('Supabase is not configured');
        const { data, error } = await supabase.rpc('consume_space_invite', { p_token: token });
        if (error)
            throw error;
        await refresh();
        return String(data);
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
            return [{ space_id: spaceId, user_id: userId || demoProfile.id, role: 'owner', display_name: profile?.display_name || 'Demo User', greeting_name: profile?.greeting_name || 'Demo', avatar_url: profile?.avatar_url || null }];
        }
        if (!supabase || !navigator.onLine)
            return [];
        const { data, error } = await supabase.rpc('get_space_members', { p_space: spaceId });
        if (error) {
            console.error('Could not load space members', error);
            return [];
        }
        return (data || []).map((row) => ({ ...row, space_id: spaceId }));
    };
    const value = useMemo(() => ({
        profile, preferences, items, spaces, members, places, events, notes, activity, loading, syncState,
        refresh, createItem, updateItem, updateShopping, completeItem, deleteItem, snoozeItem, createSpace, createInvite,
        consumeInvite, updateProfile, updatePreferences, createPlace, createEvent, createNote, getSpaceMembers,
    }), [profile, preferences, items, spaces, members, places, events, notes, activity, loading, syncState, refresh]);
    return _jsx(Ctx.Provider, { value: value, children: children });
}
export function useAppData() {
    const value = useContext(Ctx);
    if (!value)
        throw new Error('useAppData must be used inside AppDataProvider');
    return value;
}
