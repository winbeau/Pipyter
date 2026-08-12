import { describe, expect, it } from 'vitest'
import { projectFeed } from '../feed'
import type { PigentEvent } from '../types'
import { isToolSurfaceEvent, parseToolSurface } from './parse'

const event = (id: number, type: PigentEvent['type'], payload: Record<string, unknown> = {}): PigentEvent => ({
  version: 1,
  event_id: id,
  session_id: 'session-1',
  type,
  timestamp: `2025-01-01T00:00:${String(id).padStart(2, '0')}Z`,
  payload,
})

describe('tool surface event classification', () => {
  it('does not duplicate the normal delegate tool lifecycle with uncorrelated delegate mirrors', () => {
    const items = projectFeed([
      event(1, 'tool.start', { tool_call_id: 'delegate-call', tool: 'delegate', arguments: { profile: 'review', task: 'Review the patch' } }),
      event(2, 'delegate.start', { profile: 'review' }),
      event(3, 'delegate.update', { profile: 'review', progress: { summary: 'Checking tests' } }),
      event(4, 'tool.update', { tool_call_id: 'delegate-call', tool: 'delegate', update: { summary: 'Checking tests' } }),
      event(5, 'delegate.end', { profile: 'review', result: { status: 'completed', summary: 'Review complete' } }),
      event(6, 'tool.end', { tool_call_id: 'delegate-call', tool: 'delegate', status: 'completed', result: { details: { ok: true, summary: 'Review complete' } } }),
    ], [])

    const tools = items.filter((item) => item.kind === 'tool')
    expect(tools).toHaveLength(1)
    expect(tools[0]?.kind === 'tool' && tools[0].surface.toolCallId).toBe('delegate-call')
    expect(tools[0]?.kind === 'tool' && tools[0].surface.tool).toBe('delegate')
    expect(tools[0]?.kind === 'tool' && tools[0].surface.state).toBe('succeeded')
  })

  it('accepts explicitly correlated delegate events without inventing an identity', () => {
    const correlated = event(1, 'delegate.update', { tool_call_id: 'delegate-call', profile: 'analysis', progress: { summary: 'Working' } })
    expect(isToolSurfaceEvent(correlated)).toBe(true)
    expect(parseToolSurface(correlated)).toMatchObject({ tool: 'delegate', toolCallId: 'delegate-call', state: 'running' })
    expect(isToolSurfaceEvent(event(2, 'delegate.update', { profile: 'analysis' }))).toBe(false)
  })

  it('keeps Tasks tool calls identifiable while leaving tasks.snapshot outside tool surfaces', () => {
    const tasksCall = event(1, 'tool.start', { tool_call_id: 'tasks-call', tool: 'tasks', arguments: { action: 'patch', updates: [] } })
    const surface = parseToolSurface(tasksCall)
    expect(surface.tool).toBe('tasks')
    expect(surface.action).toBe('patch')
    expect(isToolSurfaceEvent(tasksCall)).toBe(true)
    expect(isToolSurfaceEvent(event(2, 'tasks.snapshot', { snapshot: { revision: '2', root: { id: 'root', title: 'Plan', status: 'running' } } }))).toBe(false)
  })
})
