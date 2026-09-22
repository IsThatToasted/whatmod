import { addDaysISO, todayISO } from './time.js';
const now = new Date();
const iso = now.toISOString();
export const DEMO_USER_ID = '00000000-0000-4000-8000-000000000001';
export const DEMO_HOME_ID = '00000000-0000-4000-8000-000000000010';
export const demoProfile = {
    id: DEMO_USER_ID, email: 'demo@justglance.local', display_name: 'Demo User', greeting_name: 'Brian', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    wake_time: '07:00', sleep_time: '23:00', work_start: '08:00', work_end: '16:30', theme: 'system', onboarding_complete: true,
};
export const demoSpaces = [
    { id: '00000000-0000-4000-8000-000000000002', owner_id: DEMO_USER_ID, name: 'Personal', icon: 'sparkles', role: 'owner', created_at: iso },
    { id: DEMO_HOME_ID, owner_id: DEMO_USER_ID, name: 'Home', icon: 'home', role: 'owner', created_at: iso },
];
export const demoPlaces = [
    { id: '00000000-0000-4000-8000-000000000020', user_id: DEMO_USER_ID, name: 'Home', category: 'home', radius_meters: 150 },
    { id: '00000000-0000-4000-8000-000000000021', user_id: DEMO_USER_ID, name: 'Walmart', category: 'store', address: 'Walmart', radius_meters: 250 },
];
export const demoItems = [
    { id: 'd1', user_id: DEMO_USER_ID, project_id: 'p-demo-1', title: 'Call dentist', type: 'call', status: 'open', priority: 'high', due_date: todayISO(), due_time: '16:00', estimated_minutes: 5, context_tags: ['call'], created_at: iso, updated_at: iso, snooze_count: 2 },
    { id: 'd2', user_id: DEMO_USER_ID, is_inbox: true, title: 'Return package', type: 'errand', status: 'open', priority: 'normal', due_date: addDaysISO(1), estimated_minutes: 15, context_tags: ['errand'], created_at: iso, updated_at: iso, snooze_count: 1 },
    { id: 'd3', user_id: DEMO_USER_ID, space_id: DEMO_HOME_ID, title: 'Buy milk', type: 'shopping', status: 'open', priority: 'normal', place_name: 'Walmart', estimated_minutes: 10, context_tags: ['shopping'], shopping: { quantity: 1, unit: 'gal', preferred_store: 'Walmart', aisle_category: 'Dairy' }, created_at: iso, updated_at: iso, snooze_count: 0 },
    { id: 'd4', user_id: DEMO_USER_ID, space_id: DEMO_HOME_ID, title: 'Take trash out', type: 'chore', status: 'open', priority: 'normal', due_date: todayISO(), estimated_minutes: 5, recurrence_rule: 'weekly', context_tags: ['home'], created_at: iso, updated_at: iso, snooze_count: 0 },
    { id: 'd5', user_id: DEMO_USER_ID, project_id: 'p-demo-2', title: 'Change air filter', type: 'chore', status: 'open', priority: 'low', due_date: addDaysISO(4), estimated_minutes: 10, recurrence_rule: 'every:90', context_tags: ['home'], created_at: iso, updated_at: iso, snooze_count: 0 },
    { id: 'd6', user_id: DEMO_USER_ID, title: 'Charge headphones', type: 'task', status: 'completed', priority: 'normal', due_date: todayISO(), estimated_minutes: 2, context_tags: ['quick'], created_at: iso, updated_at: iso, completed_at: iso, snooze_count: 0 },
];
export const demoEvents = [
    { id: 'e1', user_id: DEMO_USER_ID, title: 'Dinner with Ashley', event_date: todayISO(), start_time: '19:00', end_time: '20:30', location: 'Downtown' },
];
export const demoNotes = [
    { id: 'n1', user_id: DEMO_USER_ID, title: 'Paint color', body: 'SW Alabaster', created_at: iso },
];
export const demoActivity = [
    { id: 'a1', user_id: DEMO_USER_ID, space_id: DEMO_HOME_ID, action: 'completed', entity_type: 'shopping', entity_title: 'Paper towels', actor_name: 'Ashley', created_at: new Date(now.getTime() - 45 * 60000).toISOString() },
];
export const demoMembers = [
    { space_id: DEMO_HOME_ID, user_id: DEMO_USER_ID, role: 'owner', display_name: 'Brian', greeting_name: 'Brian' },
    { space_id: DEMO_HOME_ID, user_id: '00000000-0000-4000-8000-000000000099', role: 'member', display_name: 'Ashley', greeting_name: 'Ashley' },
];
