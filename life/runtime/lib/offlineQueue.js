const KEY = 'justglance:offline-queue:v3';
function readAll() {
    try {
        const value = JSON.parse(localStorage.getItem(KEY) || '[]');
        return Array.isArray(value) ? value.filter(entry => entry?.userId && entry?.id) : [];
    }
    catch {
        return [];
    }
}
export function getOfflineQueue(userId) {
    const all = readAll();
    return userId ? all.filter(mutation => mutation.userId === userId) : all;
}
export function enqueueMutation(userId, mutation) {
    if (!userId)
        throw new Error('Cannot queue a mutation without an authenticated user.');
    const next = [...readAll(), { ...mutation, userId, id: crypto.randomUUID(), createdAt: new Date().toISOString() }];
    localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new Event('justglance:queue'));
}
export function removeMutation(id) {
    localStorage.setItem(KEY, JSON.stringify(readAll().filter(mutation => mutation.id !== id)));
    window.dispatchEvent(new Event('justglance:queue'));
}
export function queueSize(userId) { return getOfflineQueue(userId).length; }
