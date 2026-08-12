import type { PigentEvent, ToolSurfaceAction, ToolSurfaceModel } from '../types'
import { safeRecord, safeText, surfaceState } from './contract'

const TOOL_EVENTS = new Set(['tool.start', 'tool.update', 'tool.end', 'kernel.updated', 'operation.started', 'operation.updated', 'operation.ended'])
const DELEGATE_EVENTS = new Set(['delegate.start', 'delegate.update', 'delegate.end'])

function correlationId(event: PigentEvent): string {
  const payload = safeRecord(event.payload)
  const operation = safeRecord(payload.operation)
  const environment = safeRecord(payload.environment)
  return safeText(payload.tool_call_id, safeText(operation.tool_call_id, safeText(environment.tool_call_id)))
}

function mergeActions(previous: ToolSurfaceAction[], next: ToolSurfaceAction[]): ToolSurfaceAction[] {
  const merged = new Map(previous.map((action) => [`${action.id}:${action.value ?? action.href ?? ''}`, action]))
  for (const action of next) merged.set(`${action.id}:${action.value ?? action.href ?? ''}`, action)
  return [...merged.values()]
}

export function isToolSurfaceEvent(event: PigentEvent): boolean {
  if (TOOL_EVENTS.has(event.type)) return true
  // The host currently emits delegate.* as an auxiliary mirror of the normal
  // tool.* lifecycle, but those events do not carry a tool_call_id. Projecting
  // them would create a second Agent row for the same delegation. Keep support
  // for a future correlated form without guessing across concurrent delegates.
  if (DELEGATE_EVENTS.has(event.type)) return Boolean(correlationId(event))
  return event.type === 'kernel.environment.updated' && Boolean(correlationId(event))
}

export function parseToolSurface(event: PigentEvent): ToolSurfaceModel {
  const payload = safeRecord(event.payload)
  const rawResult = safeRecord(payload.result)
  const details = safeRecord(rawResult.details)
  const result = Object.keys(details).length ? details : rawResult
  const data = safeRecord(result.data)
  const operation = safeRecord(payload.operation)
  const environment = safeRecord(payload.environment)
  const correlated = correlationId(event)
  const operationId = safeText(operation.operation_id)
  const toolCallId = correlated || (operationId ? `operation:${operationId}` : `event-${event.event_id ?? 'cursor'}`)
  const tool = safeText(payload.tool, event.type.startsWith('delegate') ? 'delegate' : event.type.startsWith('operation') ? 'kernel' : event.type.split('.')[0])
  const input = safeRecord(payload.arguments)
  const actions: ToolSurfaceAction[] = []
  const path = safeText(data.path, safeText(input.path, safeText(payload.path)))
  if (path) actions.push({ id: 'open', label: 'Open', value: path }, { id: 'reveal', label: 'Reveal', value: path })
  const copyValue = safeText(data.output, safeText(data.stdout, safeText(payload.output, safeText(result.summary))))
  if (copyValue) actions.push({ id: 'copy', label: 'Copy', value: copyValue })
  const output = Object.keys(result).length
    ? result
    : payload.update !== undefined
      ? payload.update
      : event.type === 'kernel.environment.updated' && Object.keys(environment).length
        ? environment
        : event.type === 'kernel.updated'
          ? payload
          : undefined
  // Artifact actions are projected by ArtifactSurface, which can construct an
  // authorized Runtime URL. Tool result artifacts without an ID/href must not
  // advertise a dead download control.
  return {
    id: `surface:${toolCallId}`,
    toolCallId,
    tool,
    action: safeText(payload.action, safeText(input.action, safeText(data.action, safeText(operation.kind)))) || undefined,
    state: surfaceState(event),
    startedAt: event.timestamp,
    input: payload.arguments,
    output,
    error: safeRecord(result.error ?? operation.error ?? payload.error),
    receipt: safeRecord(payload.receipt ?? operation.receipt ?? result.receipt),
    operation: Object.keys(operation).length ? operation : undefined,
    actions,
    raw: payload,
  }
}

export function mergeToolSurface(previous: ToolSurfaceModel | undefined, event: PigentEvent): ToolSurfaceModel {
  const next = parseToolSurface(event)
  if (!previous) return next
  const startedAt = previous.startedAt ?? next.startedAt
  const terminal = event.type === 'tool.end' || event.type === 'delegate.end' || event.type === 'operation.ended'
  const operationActive = event.type === 'operation.started' || event.type === 'operation.updated'
  const endedAt = terminal ? event.timestamp : operationActive ? undefined : previous.endedAt
  const durationMs = startedAt && endedAt ? Math.max(0, Date.parse(endedAt) - Date.parse(startedAt)) : undefined
  return {
    ...previous,
    ...next,
    startedAt,
    endedAt,
    durationMs,
    action: previous.action ?? next.action,
    input: next.input ?? previous.input,
    output: next.output ?? previous.output,
    operation: next.operation ?? previous.operation,
    error: Object.keys(next.error ?? {}).length ? next.error : previous.error,
    receipt: Object.keys(next.receipt ?? {}).length ? next.receipt : previous.receipt,
    actions: mergeActions(previous.actions, next.actions),
    raw: { ...previous.raw, ...next.raw },
  }
}
