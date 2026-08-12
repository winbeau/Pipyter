import type { PigentEvent } from './types'

const TRANSPARENT_EVENTS = new Set([
  'session.created',
  'session.updated',
  'mode.changed',
  'context.updated',
  'tasks.snapshot',
  'reconnect.cursor',
])

function eventText(event: PigentEvent): string {
  return String(event.payload?.text ?? '')
}

export function coalescePigentEvents(events: readonly PigentEvent[]): PigentEvent[] {
  const result: PigentEvent[] = []
  const assistantIndexes = new Map<string, number>()
  let legacyKey: string | null = null
  let legacyCounter = 0

  for (const event of events) {
    if (event.type === 'assistant.text' || event.type === 'assistant.thinking') {
      const explicitId = typeof event.payload?.message_id === 'string' && event.payload.message_id
        ? event.payload.message_id
        : null
      if (explicitId) {
        legacyKey = null
      } else if (!legacyKey || !legacyKey.startsWith(`${event.type}:legacy:`)) {
        legacyKey = `${event.type}:legacy:${++legacyCounter}`
      }
      const key = `${event.type}:${explicitId ?? legacyKey}`
      const existingIndex = assistantIndexes.get(key)
      if (existingIndex === undefined) {
        assistantIndexes.set(key, result.length)
        result.push({ ...event, payload: { ...event.payload, text: eventText(event) } })
      } else {
        const existing = result[existingIndex]
        const text = event.payload?.delta === false
          ? eventText(event)
          : `${eventText(existing)}${eventText(event)}`
        result[existingIndex] = {
          ...existing,
          payload: { ...existing.payload, ...event.payload, text },
        }
      }
      continue
    }

    if (!TRANSPARENT_EVENTS.has(event.type)) legacyKey = null
    result.push(event)
  }

  return result
}
