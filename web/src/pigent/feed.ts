import type { FeedItem, OptimisticUserMessage, PigentEvent, ToolSurfaceModel } from './types'
import { isToolSurfaceEvent, mergeToolSurface } from './tool-ui/parse'

const TRANSPARENT_EVENTS = new Set(['session.created', 'session.updated', 'mode.changed', 'context.updated', 'tasks.snapshot', 'reconnect.cursor'])

function eventText(event: PigentEvent): string { return String(event.payload?.text ?? '') }

export function coalescePigentEvents(events: readonly PigentEvent[]): PigentEvent[] {
  const result: PigentEvent[] = []
  const assistantIndexes = new Map<string, number>()
  let legacyKey: string | null = null
  let legacyCounter = 0
  for (const event of events) {
    if (event.type === 'assistant.text' || event.type === 'assistant.thinking') {
      const explicitId = typeof event.payload?.message_id === 'string' && event.payload.message_id ? event.payload.message_id : null
      if (explicitId) legacyKey = null
      else if (!legacyKey || !legacyKey.startsWith(`${event.type}:legacy:`)) legacyKey = `${event.type}:legacy:${++legacyCounter}`
      const key = `${event.type}:${explicitId ?? legacyKey}`
      const existingIndex = assistantIndexes.get(key)
      if (existingIndex === undefined) {
        assistantIndexes.set(key, result.length)
        result.push({ ...event, payload: { ...event.payload, text: eventText(event) } })
      } else {
        const existing = result[existingIndex]
        const text = event.payload?.delta === false ? eventText(event) : `${eventText(existing)}${eventText(event)}`
        result[existingIndex] = { ...existing, timestamp: event.timestamp, payload: { ...existing.payload, ...event.payload, text } }
      }
      continue
    }
    if (!TRANSPARENT_EVENTS.has(event.type)) legacyKey = null
    result.push(event)
  }
  return result
}

export function projectFeed(events: readonly PigentEvent[], userMessages: readonly OptimisticUserMessage[]): FeedItem[] {
  const items: FeedItem[] = []
  const optimistic = [...userMessages].sort((left, right) => left.createdAt.localeCompare(right.createdAt))
  let optimisticIndex = 0
  const insertOptimisticBefore = (timestamp: string) => {
    while (optimisticIndex < optimistic.length && optimistic[optimisticIndex]!.createdAt <= timestamp) {
      const message = optimistic[optimisticIndex++]!
      items.push({ kind: 'user', id: `user:${message.clientMessageId}`, message })
    }
  }
  const surfaces = new Map<string, { model: ToolSurfaceModel; index: number }>()
  for (const event of coalescePigentEvents(events)) {
    insertOptimisticBefore(event.timestamp)
    if (TRANSPARENT_EVENTS.has(event.type) || event.type === 'tasks.snapshot') continue
    if (event.type === 'assistant.text' || event.type === 'assistant.thinking') {
      const messageId = String(event.payload?.message_id ?? event.event_id)
      items.push({ kind: 'assistant', id: `assistant:${messageId}:${event.type}`, text: eventText(event), timestamp: event.timestamp, thinking: event.type === 'assistant.thinking' })
      continue
    }
    if (isToolSurfaceEvent(event)) {
      const parsed = mergeToolSurface(undefined, event)
      const existing = surfaces.get(parsed.toolCallId)
      if (existing) {
        const model = mergeToolSurface(existing.model, event)
        surfaces.set(parsed.toolCallId, { model, index: existing.index })
        items[existing.index] = { kind: 'tool', id: model.id, surface: model }
      } else {
        const index = items.length
        surfaces.set(parsed.toolCallId, { model: parsed, index })
        items.push({ kind: 'tool', id: parsed.id, surface: parsed })
      }
      continue
    }
    if (event.type === 'interaction.required' || event.type === 'interaction.resolved') {
      const interactionId = String(event.payload?.interaction_id ?? (event.payload?.interaction as Record<string, unknown> | undefined)?.interaction_id ?? event.event_id)
      const id = `interaction:${interactionId}`
      const existing = items.findIndex((item) => item.id === id)
      let projectedEvent = event
      if (event.type === 'interaction.resolved' && existing >= 0) {
        const previous = items[existing]
        if (previous?.kind === 'interaction') {
          const original = (previous.event.payload?.interaction ?? previous.event.payload) as Record<string, unknown>
          projectedEvent = { ...event, payload: { ...event.payload, interaction: { ...original, state: 'resolved', receipt: event.payload?.receipt }, revision: previous.event.payload?.revision } }
        }
      }
      const projected = { kind: 'interaction' as const, id, event: projectedEvent }
      if (existing >= 0) items[existing] = projected
      else items.push(projected)
    } else if (event.type === 'artifact.created') {
      items.push({ kind: 'artifact', id: `artifact:${event.event_id}`, event })
    } else if (event.type === 'error' || event.type === 'aborted' || event.type === 'settled') {
      items.push({ kind: 'status', id: `status:${event.event_id}`, event })
    }
  }
  while (optimisticIndex < optimistic.length) {
    const message = optimistic[optimisticIndex++]!
    items.push({ kind: 'user', id: `user:${message.clientMessageId}`, message })
  }
  return items
}

export function prependHistory(current: Record<number, PigentEvent>, page: readonly PigentEvent[]): Record<number, PigentEvent> {
  const next = { ...current }
  for (const event of page) if (typeof event.event_id === 'number') next[event.event_id] = event
  return next
}
