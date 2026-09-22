import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext.js';
import { supabase } from '../lib/supabase.js';
const Ctx = createContext(null);
const cacheKey = (uid) => `justglance:organizer:${uid}`;
const demoProjects = [
    {
        id: 'p-demo-1', user_id: '00000000-0000-4000-8000-000000000001', name: 'Launch JustGlance',
        description: 'Turn the life OS into the one place that catches every thought, task, appointment and project.',
        status: 'active', priority: 'high', icon: 'sparkles', color: null, target_date: null,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    },
    {
        id: 'p-demo-2', user_id: '00000000-0000-4000-8000-000000000001', name: 'House projects',
        description: 'Repairs, upgrades, purchases and things to remember around home.', status: 'active', priority: 'normal',
        icon: 'home', color: null, target_date: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    },
];
function notifyNative(reminder) {
    try {
        const handler = window?.webkit?.messageHandlers?.justglanceNative;
        if (handler?.postMessage) {
            handler.postMessage({ type: 'scheduleReminder', id: reminder.id, title: reminder.title, body: reminder.body || 'JustGlance reminder', fireAt: reminder.remind_at });
        }
    }
    catch {
        // Native notification scheduling is best-effort; the reminder still exists in Supabase.
    }
}
function cancelNative(id) {
    try {
        const handler = window?.webkit?.messageHandlers?.justglanceNative;
        if (handler?.postMessage)
            handler.postMessage({ type: 'cancelReminder', id });
    }
    catch {
        // Ignore bridge failures in browsers.
    }
}
export function OrganizerProvider({ children }) {
    const { userId, demo } = useAuth();
    const [projects, setProjects] = useState(demo ? demoProjects : []);
    const [reminders, setReminders] = useState([]);
    const [loading, setLoading] = useState(!demo);
    const [expansionAvailable, setExpansionAvailable] = useState(true);
    const saveCache = useCallback((nextProjects, nextReminders) => {
        if (!userId)
            return;
        try {
            localStorage.setItem(cacheKey(userId), JSON.stringify({ projects: nextProjects, reminders: nextReminders, saved_at: new Date().toISOString() }));
        }
        catch { }
    }, [userId]);
    const refreshOrganizer = useCallback(async () => {
        if (demo || !userId || !supabase) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const [p, r] = await Promise.all([
                supabase.from('projects').select('*').neq('status', 'archived').order('updated_at', { ascending: false }),
                supabase.from('reminders').select('*').is('dismissed_at', null).order('remind_at', { ascending: true }),
            ]);
            if (p.error)
                throw p.error;
            if (r.error)
                throw r.error;
            const nextProjects = (p.data || []);
            const nextReminders = (r.data || []);
            setProjects(nextProjects);
            setReminders(nextReminders);
            saveCache(nextProjects, nextReminders);
            setExpansionAvailable(true);
        }
        catch (error) {
            const message = String(error?.message || '');
            if (/projects|reminders|relation|schema cache/i.test(message))
                setExpansionAvailable(false);
            try {
                const cached = JSON.parse(localStorage.getItem(cacheKey(userId)) || 'null');
                if (cached?.projects)
                    setProjects(cached.projects);
                if (cached?.reminders)
                    setReminders(cached.reminders);
            }
            catch { }
        }
        finally {
            setLoading(false);
        }
    }, [demo, saveCache, userId]);
    useEffect(() => { void refreshOrganizer(); }, [refreshOrganizer]);
    useEffect(() => {
        if (demo || !supabase || !userId || !expansionAvailable)
            return;
        const client = supabase;
        const channel = client.channel(`organizer-${userId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => { void refreshOrganizer(); })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'reminders' }, () => { void refreshOrganizer(); })
            .subscribe();
        return () => { void client.removeChannel(channel); };
    }, [demo, expansionAvailable, refreshOrganizer, userId]);
    const createProject = async (input) => {
        if (!userId)
            throw new Error('Not signed in');
        const now = new Date().toISOString();
        const row = {
            id: crypto.randomUUID(), user_id: userId, space_id: input.space_id || null, name: input.name.trim(),
            description: input.description?.trim() || null, status: 'active', priority: input.priority || 'normal', icon: 'folder', color: null,
            target_date: input.target_date || null, created_at: now, updated_at: now,
        };
        if (!row.name)
            throw new Error('Project name is required');
        const next = [row, ...projects];
        setProjects(next);
        saveCache(next, reminders);
        if (!demo && supabase) {
            const { error } = await supabase.from('projects').insert(row);
            if (error) {
                setExpansionAvailable(false);
                throw error;
            }
        }
        return row;
    };
    const updateProject = async (id, patch) => {
        const next = projects.map(p => p.id === id ? { ...p, ...patch, updated_at: new Date().toISOString() } : p);
        setProjects(next);
        saveCache(next, reminders);
        if (!demo && supabase) {
            const { error } = await supabase.from('projects').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
            if (error)
                throw error;
        }
    };
    const archiveProject = async (id) => updateProject(id, { status: 'archived', archived_at: new Date().toISOString() });
    const createReminder = async (input) => {
        if (!userId)
            throw new Error('Not signed in');
        const row = {
            id: crypto.randomUUID(), user_id: userId, item_id: input.item_id || null, event_id: input.event_id || null,
            title: input.title.trim(), body: input.body?.trim() || null, remind_at: input.remind_at,
            kind: input.kind || 'notification', delivered_at: null, dismissed_at: null, created_at: new Date().toISOString(),
        };
        const next = [...reminders, row].sort((a, b) => a.remind_at.localeCompare(b.remind_at));
        setReminders(next);
        saveCache(projects, next);
        notifyNative(row);
        if (!demo && supabase) {
            const { error } = await supabase.from('reminders').insert(row);
            if (error)
                throw error;
        }
        return row;
    };
    const dismissReminder = async (id) => {
        const next = reminders.filter(r => r.id !== id);
        setReminders(next);
        saveCache(projects, next);
        cancelNative(id);
        if (!demo && supabase) {
            const { error } = await supabase.from('reminders').update({ dismissed_at: new Date().toISOString() }).eq('id', id);
            if (error)
                throw error;
        }
    };
    const deleteReminder = async (id) => {
        const next = reminders.filter(r => r.id !== id);
        setReminders(next);
        saveCache(projects, next);
        cancelNative(id);
        if (!demo && supabase) {
            const { error } = await supabase.from('reminders').delete().eq('id', id);
            if (error)
                throw error;
        }
    };
    const value = useMemo(() => ({ projects, reminders, loading, expansionAvailable, refreshOrganizer, createProject, updateProject, archiveProject, createReminder, dismissReminder, deleteReminder }), [projects, reminders, loading, expansionAvailable, refreshOrganizer]);
    return _jsx(Ctx.Provider, { value: value, children: children });
}
export function useOrganizer() {
    const value = useContext(Ctx);
    if (!value)
        throw new Error('useOrganizer must be used inside OrganizerProvider');
    return value;
}
