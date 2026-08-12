import { apiUrl, jsonRequest, websocketUrl } from '../api/client'
import type { PigentModelSelection } from './models'
import type { PigentCapabilities, PigentContext, PigentEvent, PigentMode, PigentSession, TasksSnapshot } from './types'

export type MessageAccepted = { accepted: true; client_message_id: string; run_id: string; turn_id: string }
export type HistoryPage = { events: PigentEvent[]; has_more: boolean; before_event_id: number | null }

export function createPigentApi(apiBase: string) {
  return {
    listSessions: (options: { workspaceId?: string; query?: string; before?: string; limit?: number } = {}) => {
      const query = new URLSearchParams()
      if (options.workspaceId) query.set('workspace_id', options.workspaceId)
      if (options.query) query.set('query', options.query)
      if (options.before) query.set('before', options.before)
      if (options.limit) query.set('limit', String(options.limit))
      return jsonRequest<PigentSession[]>(apiBase, `/api/v1/pigent/sessions${query.size ? `?${query}` : ''}`)
    },
    createSession: (mode: PigentMode, title?: string) =>
      jsonRequest<PigentSession>(apiBase, '/api/v1/pigent/sessions', {
        method: 'POST', body: JSON.stringify({ mode, approval_preference: 'automatic', title }),
      }),
    getSession: (id: string) => jsonRequest<PigentSession>(apiBase, `/api/v1/pigent/sessions/${id}`),
    renameSession: (id: string, title: string) => jsonRequest<PigentSession>(apiBase, `/api/v1/pigent/sessions/${id}`, {
      method: 'PATCH', body: JSON.stringify({ title }),
    }),
    deleteSession: (id: string) => jsonRequest<void>(apiBase, `/api/v1/pigent/sessions/${id}`, { method: 'DELETE' }),
    history: (id: string, beforeEventId?: number, limit = 100) =>
      jsonRequest<HistoryPage>(apiBase, `/api/v1/pigent/sessions/${id}/events?limit=${limit}${beforeEventId ? `&before_event_id=${beforeEventId}` : ''}`),
    changeMode: (id: string, mode: PigentMode) =>
      jsonRequest<PigentSession>(apiBase, `/api/v1/pigent/sessions/${id}/mode`, { method: 'PUT', body: JSON.stringify({ mode }) }),
    changeModel: (id: string, model: PigentModelSelection, revision?: string) =>
      jsonRequest<{ session: PigentSession; revision: string }>(apiBase, `/api/v1/pigent/sessions/${id}/model`, {
        method: 'PUT', body: JSON.stringify({ ...model, revision }),
      }),
    changeContext: (id: string, context: PigentContext) =>
      jsonRequest<PigentSession>(apiBase, `/api/v1/pigent/sessions/${id}/context`, {
        method: 'PUT', body: JSON.stringify({ active_document: context.activeDocument ?? null, active_kernel_id: context.activeKernel ?? null }),
      }),
    sendMessage: (id: string, clientMessageId: string, content: string, behavior: 'prompt' | 'follow_up' = 'prompt') =>
      jsonRequest<MessageAccepted>(apiBase, `/api/v1/pigent/sessions/${id}/messages`, {
        method: 'POST', body: JSON.stringify({ client_message_id: clientMessageId, content, behavior }),
      }),
    abort: (id: string, runId?: string) => jsonRequest<{ accepted: boolean; already_settled: boolean }>(apiBase, `/api/v1/pigent/sessions/${id}/abort`, {
      method: 'POST', body: JSON.stringify({ run_id: runId ?? null, reason: 'user_stop' }),
    }),
    resolveInteraction: (interactionId: string, revision: number, decisionId: string, actionId: string, payload: Record<string, unknown> = {}) =>
      jsonRequest<{ receipt: Record<string, unknown> }>(apiBase, `/api/v1/pigent/interactions/${interactionId}`, {
        method: 'POST', body: JSON.stringify({ revision, decision_id: decisionId, action_id: actionId, payload }),
      }),
    tasks: (id: string) => jsonRequest<TasksSnapshot>(apiBase, `/api/v1/pigent/sessions/${id}/tasks`),
    capabilities: () => jsonRequest<PigentCapabilities>(apiBase, '/api/v1/pigent/capabilities'),
    streamUrl: (sessionId: string, afterEventId: number) =>
      websocketUrl(apiBase, `/api/v1/pigent/sessions/${encodeURIComponent(sessionId)}/stream?after_event_id=${afterEventId}`),
    artifactUrl: (artifactId: string, download = false) => apiUrl(apiBase, `/api/v1/pigent/artifacts/${encodeURIComponent(artifactId)}${download ? '?download=true' : ''}`),
  }
}

export function parsePigentEvent(value: string): PigentEvent | null {
  try {
    const event = JSON.parse(value) as PigentEvent
    const validId = typeof event.event_id === 'number' || (event.type === 'reconnect.cursor' && event.event_id === null)
    return event?.version === 1 && validId ? event : null
  } catch {
    return null
  }
}
