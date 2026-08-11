import type { PigentEvent, PigentMode, PigentSession, TasksSnapshot } from './types'
import type { PigentCapabilities } from './types'

const jsonHeaders = { 'Content-Type': 'application/json' }

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { headers: jsonHeaders, ...init })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`${response.status} ${response.statusText}${detail ? `: ${detail}` : ''}`)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export const pigentApi = {
  listSessions: (workspaceId?: string) =>
    request<PigentSession[]>(`/api/v1/pigent/sessions${workspaceId ? `?workspace_id=${encodeURIComponent(workspaceId)}` : ''}`),
  createSession: (mode: PigentMode, title?: string) =>
    request<PigentSession>('/api/v1/pigent/sessions', {
      method: 'POST',
      body: JSON.stringify({ mode, approval_preference: 'automatic', title }),
    }),
  getSession: (id: string) => request<PigentSession>(`/api/v1/pigent/sessions/${id}`),
  changeMode: (id: string, mode: PigentMode) =>
    request<PigentSession>(`/api/v1/pigent/sessions/${id}/mode`, { method: 'PUT', body: JSON.stringify({ mode }) }),
  sendMessage: (id: string, content: string, behavior: 'prompt' | 'follow_up' = 'prompt') =>
    request<{ accepted: boolean }>(`/api/v1/pigent/sessions/${id}/messages`, {
      method: 'POST', body: JSON.stringify({ content, behavior }),
    }),
  abort: (id: string) => request<{ accepted: boolean }>(`/api/v1/pigent/sessions/${id}/abort`, { method: 'POST' }),
  tasks: (id: string) => request<TasksSnapshot>(`/api/v1/pigent/sessions/${id}/tasks`),
  capabilities: () => request<PigentCapabilities>('/api/v1/pigent/capabilities'),
}

export function pigentStreamUrl(sessionId: string, afterEventId: number): string {
  const scheme = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${scheme}//${window.location.host}/api/v1/pigent/sessions/${encodeURIComponent(sessionId)}/stream?after_event_id=${afterEventId}`
}

export function parsePigentEvent(value: string): PigentEvent | null {
  try {
    const event = JSON.parse(value) as PigentEvent
    return event?.version === 1 && typeof event.event_id === 'number' ? event : null
  } catch {
    return null
  }
}
