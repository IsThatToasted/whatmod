const KEY = 'justglance:offline-queue:v3'

export interface OfflineMutation {
  id: string
  userId: string
  table: string
  action: 'insert' | 'update' | 'upsert' | 'delete'
  payload: unknown
  createdAt: string
}

function readAll(): OfflineMutation[] {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(value) ? value.filter(entry => entry?.userId && entry?.id) : []
  } catch { return [] }
}

export function getOfflineQueue(userId?: string | null): OfflineMutation[] {
  const all = readAll()
  return userId ? all.filter(mutation => mutation.userId === userId) : all
}

export function enqueueMutation(userId: string | null, mutation: Omit<OfflineMutation, 'id' | 'userId' | 'createdAt'>) {
  if (!userId) throw new Error('Cannot queue a mutation without an authenticated user.')
  const next = [...readAll(), { ...mutation, userId, id: crypto.randomUUID(), createdAt: new Date().toISOString() }]
  localStorage.setItem(KEY, JSON.stringify(next))
  window.dispatchEvent(new Event('justglance:queue'))
}

export function removeMutation(id: string) {
  localStorage.setItem(KEY, JSON.stringify(readAll().filter(mutation => mutation.id !== id)))
  window.dispatchEvent(new Event('justglance:queue'))
}

export function queueSize(userId?: string | null) { return getOfflineQueue(userId).length }
