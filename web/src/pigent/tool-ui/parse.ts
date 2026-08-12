import type { PigentEvent, ToolSurfaceAction, ToolSurfaceModel } from '../types'
import { safeRecord, safeText, surfaceState } from './contract'

const TOOL_EVENTS = new Set(['tool.start', 'tool.update', 'tool.end', 'delegate.start', 'delegate.update', 'delegate.end', 'kernel.updated', 'operation.started', 'operation.updated', 'operation.ended'])

export function isToolSurfaceEvent(event: PigentEvent): boolean {
  return TOOL_EVENTS.has(event.type)
}

export function parseToolSurface(event: PigentEvent): ToolSurfaceModel {
  const payload = safeRecord(event.payload)
  const result = safeRecord(payload.result)
  const data = safeRecord(result.data)
  const operation = safeRecord(payload.operation)
  const toolCallId = safeText(payload.tool_call_id, safeText(operation.tool_call_id, `event-${event.event_id ?? 'cursor'}`))
  const tool = safeText(payload.tool, event.type.startsWith('delegate') ? 'delegate' : event.type.startsWith('operation') ? 'kernel' : event.type.split('.')[0])
  const actions: ToolSurfaceAction[] = []
  const path = safeText(data.path, safeText(payload.path))
  if (path) actions.push({ id: 'open', label: 'Open', value: path }, { id: 'reveal', label: 'Reveal', value: path })
  const copyValue = safeText(data.output, safeText(data.stdout, safeText(payload.output, safeText(result.summary))))
  if (copyValue) actions.push({ id: 'copy', label: 'Copy', value: copyValue })
  // Artifact actions are projected by ArtifactSurface, which can construct an
  // authorized Runtime URL. Tool result artifacts without an ID/href must not
  // advertise a dead download control.
  actions.push({ id: 'expand', label: 'Expand' })
  return {
    id: `surface:${toolCallId}`,
    toolCallId,
    tool,
    action: safeText(payload.action, safeText(data.action)) || undefined,
    state: surfaceState(event),
    startedAt: event.timestamp,
    input: payload.arguments,
    output: Object.keys(result).length ? result : Object.keys(data).length ? data : payload.update ?? payload.result ?? payload,
    error: safeRecord(result.error ?? payload.error),
    receipt: safeRecord(payload.receipt ?? operation.receipt),
    operation: Object.keys(operation).length ? operation : undefined,
    actions,
    raw: payload,
  }
}

export function mergeToolSurface(previous: ToolSurfaceModel | undefined, event: PigentEvent): ToolSurfaceModel {
  const next = parseToolSurface(event)
  if (!previous) return next
  const startedAt = previous.startedAt ?? next.startedAt
  const endedAt = event.type.endsWith('.end') ? event.timestamp : previous.endedAt
  const durationMs = startedAt && endedAt ? Math.max(0, Date.parse(endedAt) - Date.parse(startedAt)) : undefined
  return {
    ...previous,
    ...next,
    startedAt,
    endedAt,
    durationMs,
    input: next.input ?? previous.input,
    output: next.output ?? previous.output,
    operation: next.operation ?? previous.operation,
    receipt: Object.keys(next.receipt ?? {}).length ? next.receipt : previous.receipt,
    actions: next.actions.length ? next.actions : previous.actions,
  }
}
