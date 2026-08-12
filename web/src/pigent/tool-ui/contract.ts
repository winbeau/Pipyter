import type { PigentEvent, ToolSurfaceModel } from '../types'

export function surfaceState(event: PigentEvent): ToolSurfaceModel['state'] {
  const payload = safeRecord(event.payload)
  const operation = safeRecord(payload.operation)
  const environment = safeRecord(payload.environment)
  const raw = String(payload.status ?? operation.state ?? environment.status ?? '')
  if (raw === 'cancelled') return 'cancelled'
  if (raw === 'failed' || raw === 'error' || event.type === 'error') return 'failed'
  if (raw === 'waiting_for_user' || raw === 'interaction_required') return 'waiting_for_user'
  if (raw === 'succeeded' || raw === 'completed' || raw === 'ready') return 'succeeded'
  if (raw === 'queued') return 'queued'
  if (raw === 'running' || raw === 'provisioning' || raw === 'syncing' || raw === 'deleting') return 'running'
  if (event.type === 'tool.end' || event.type === 'delegate.end' || event.type === 'operation.ended') return 'succeeded'
  return 'running'
}

export function safeRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

export function safeText(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}
