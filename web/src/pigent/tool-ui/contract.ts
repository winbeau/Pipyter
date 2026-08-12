import type { PigentEvent, ToolSurfaceModel } from '../types'

export function surfaceState(event: PigentEvent): ToolSurfaceModel['state'] {
  const raw = String(event.payload?.status ?? '')
  if (raw === 'cancelled') return 'cancelled'
  if (raw === 'failed' || event.type === 'error') return 'failed'
  if (raw === 'waiting_for_user' || raw === 'interaction_required') return 'waiting_for_user'
  if (raw === 'succeeded' || raw === 'completed' || event.type.endsWith('.end')) return 'succeeded'
  if (raw === 'queued') return 'queued'
  return 'running'
}

export function safeRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

export function safeText(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}
