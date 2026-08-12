import { jsonRequest, websocketUrl } from '../api/client'
import type { PigentModelSelection } from './models'
import type { PigentCapabilities, PigentContext, PigentEvent, PigentMode, PigentSession, TasksSnapshot } from './types'

export function createPigentApi(apiBase: string) {
  return {
    listSessions: (workspaceId?: string) =>
      jsonRequest<PigentSession[]>(apiBase, `/api/v1/pigent/sessions${workspaceId ? `?workspace_id=${encodeURIComponent(workspaceId)}` : ''}`),
    createSession: (mode: PigentMode, title?: string) =>
      jsonRequest<PigentSession>(apiBase, '/api/v1/pigent/sessions', {
        method: 'POST',
        body: JSON.stringify({ mode, approval_preference: 'automatic', title }),
      }),
    getSession: (id: string) => jsonRequest<PigentSession>(apiBase, `/api/v1/pigent/sessions/${id}`),
    changeMode: (id: string, mode: PigentMode) =>
      jsonRequest<PigentSession>(apiBase, `/api/v1/pigent/sessions/${id}/mode`, { method: 'PUT', body: JSON.stringify({ mode }) }),
    changeModel: (id: string, model: PigentModelSelection, revision?: string) =>
      jsonRequest<{ session: PigentSession; revision: string }>(apiBase, `/api/v1/pigent/sessions/${id}/model`, {
        method: 'PUT', body: JSON.stringify({ ...model, revision }),
      }),
    changeContext: (id: string, context: PigentContext) =>
      jsonRequest<PigentSession>(apiBase, `/api/v1/pigent/sessions/${id}/context`, {
        method: 'PUT',
        body: JSON.stringify({ active_document: context.activeDocument ?? null, active_kernel_id: context.activeKernel ?? null }),
      }),
    sendMessage: (id: string, content: string, behavior: 'prompt' | 'follow_up' = 'prompt') =>
      jsonRequest<{ accepted: boolean }>(apiBase, `/api/v1/pigent/sessions/${id}/messages`, {
        method: 'POST', body: JSON.stringify({ content, behavior }),
      }),
    abort: (id: string) => jsonRequest<{ accepted: boolean }>(apiBase, `/api/v1/pigent/sessions/${id}/abort`, { method: 'POST' }),
    tasks: (id: string) => jsonRequest<TasksSnapshot>(apiBase, `/api/v1/pigent/sessions/${id}/tasks`),
    capabilities: () => jsonRequest<PigentCapabilities>(apiBase, '/api/v1/pigent/capabilities'),
    streamUrl: (sessionId: string, afterEventId: number) =>
      websocketUrl(apiBase, `/api/v1/pigent/sessions/${encodeURIComponent(sessionId)}/stream?after_event_id=${afterEventId}`),
  }
}

export function parsePigentEvent(value: string): PigentEvent | null {
  try {
    const event = JSON.parse(value) as PigentEvent
    return event?.version === 1 && typeof event.event_id === 'number' ? event : null
  } catch {
    return null
  }
}
