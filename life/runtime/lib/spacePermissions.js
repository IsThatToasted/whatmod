export const DEFAULT_SPACE_PERMISSIONS = {
    view_shopping: true,
    edit_shopping: true,
    view_tasks: true,
    edit_tasks: true,
    view_calendar: true,
    edit_calendar: true,
    view_notes: true,
    edit_notes: true,
    view_projects: true,
    edit_projects: true,
    invite_members: false,
};
export function normalizeSpacePermissions(input) {
    return { ...DEFAULT_SPACE_PERMISSIONS, ...(input || {}) };
}
export const SPACE_PERMISSION_GROUPS = [
    { key: 'shopping', label: 'Shopping lists', view: 'view_shopping', edit: 'edit_shopping' },
    { key: 'tasks', label: 'Tasks & chores', view: 'view_tasks', edit: 'edit_tasks' },
    { key: 'calendar', label: 'Appointments', view: 'view_calendar', edit: 'edit_calendar' },
    { key: 'notes', label: 'Thoughts & files', view: 'view_notes', edit: 'edit_notes' },
    { key: 'projects', label: 'Projects', view: 'view_projects', edit: 'edit_projects' },
];
