import { describe, expect, it } from 'vitest'
import { coalescePigentEvents, prependHistory, projectFeed } from './feed'
import type { OptimisticUserMessage, PigentEvent } from './types'

const event = (id: number, type: PigentEvent['type'], payload: Record<string, unknown> = {}): PigentEvent => ({ version: 1, event_id: id, session_id: 's', type, timestamp: `2025-01-01T00:00:${String(id).padStart(2, '0')}Z`, payload })

describe('Pigent feed projection', () => {
  it('coalesces streamed assistant deltas without duplicating message IDs', () => {
    const result = coalescePigentEvents([event(1, 'assistant.text', { message_id: 'm', text: 'Hel', delta: true }), event(2, 'assistant.text', { message_id: 'm', text: 'lo', delta: true })])
    expect(result).toHaveLength(1)
    expect(result[0]?.payload?.text).toBe('Hello')
  })

  it('reconciles optimistic user message and tool lifecycle into stable surfaces', () => {
    const user: OptimisticUserMessage = { clientMessageId: 'client-1', content: 'hello', behavior: 'prompt', state: 'accepted', createdAt: '2025-01-01T00:00:00Z', runId: 'run-1', turnId: 'turn-1' }
    const items = projectFeed([
      event(1, 'tool.start', { tool_call_id: 'call-1', tool: 'bash', arguments: { command: 'echo ok' } }),
      event(2, 'tool.end', { tool_call_id: 'call-1', tool: 'bash', status: 'completed', result: { summary: 'done', data: { stdout: 'ok', exit_code: 0 } } }),
    ], [user])
    expect(items[0]?.kind).toBe('user')
    expect(items.filter((item) => item.kind === 'tool')).toHaveLength(1)
    const tool = items.find((item) => item.kind === 'tool')
    expect(tool?.kind === 'tool' && tool.surface.state).toBe('succeeded')
    expect(tool?.kind === 'tool' && tool.surface.toolCallId).toBe('call-1')
  })

  it('preserves Notebook action and path while unwrapping tool result details', () => {
    const items = projectFeed([
      event(1, 'tool.start', { tool_call_id: 'notebook-1', tool: 'notebook', arguments: { action: 'run_cell', path: 'analysis.ipynb', cell_id: 'cell-1' } }),
      event(2, 'tool.end', { tool_call_id: 'notebook-1', tool: 'notebook', status: 'completed', result: { content: [{ type: 'text', text: 'done' }], details: { version: 1, ok: true, summary: 'Ran cell cell-1', data: { cell_id: 'cell-1', execution_count: 4 } } } }),
    ], [])
    const item = items.find((candidate) => candidate.kind === 'tool')
    expect(item?.kind === 'tool' && item.surface.action).toBe('run_cell')
    expect(item?.kind === 'tool' && item.surface.input).toEqual({ action: 'run_cell', path: 'analysis.ipynb', cell_id: 'cell-1' })
    expect(item?.kind === 'tool' && item.surface.output).toMatchObject({ summary: 'Ran cell cell-1', data: { execution_count: 4 } })
    expect(item?.kind === 'tool' && item.surface.actions.map((action) => action.value)).toContain('analysis.ipynb')
  })

  it('merges correlated Kernel operation events and follows their nested state', () => {
    const operation = (state: string, phase: string) => ({
      operation_id: 'op-1', tool_call_id: 'kernel-1', kind: 'kernel_environment.provision', state,
      progress: { phase, completed: state === 'succeeded' ? 1 : 0, total: 1 },
      receipt: state === 'succeeded' ? { outcome: 'success', summary: 'Environment ready' } : null,
    })
    const items = projectFeed([
      event(1, 'tool.start', { tool_call_id: 'kernel-1', tool: 'kernel', arguments: { action: 'create_temporary', python: '3.12' } }),
      event(2, 'tool.end', { tool_call_id: 'kernel-1', tool: 'kernel', status: 'completed', result: { details: { ok: true, summary: 'Operation accepted', data: { operation_id: 'op-1' } } } }),
      event(3, 'operation.started', { operation: operation('running', 'create_venv') }),
      event(4, 'operation.updated', { operation: operation('running', 'install_packages') }),
      event(5, 'operation.ended', { operation: operation('succeeded', 'complete') }),
    ], [])
    const tools = items.filter((item) => item.kind === 'tool')
    expect(tools).toHaveLength(1)
    const item = tools[0]
    expect(item?.kind === 'tool' && item.surface.toolCallId).toBe('kernel-1')
    expect(item?.kind === 'tool' && item.surface.action).toBe('create_temporary')
    expect(item?.kind === 'tool' && item.surface.state).toBe('succeeded')
    expect(item?.kind === 'tool' && item.surface.operation).toMatchObject({ operation_id: 'op-1', progress: { phase: 'complete' } })
    expect(item?.kind === 'tool' && item.surface.receipt).toMatchObject({ summary: 'Environment ready' })
    expect(item?.kind === 'tool' && item.surface.endedAt).toBe(event(5, 'operation.ended').timestamp)
  })

  it('merges only correlated Kernel environment updates into a tool surface', () => {
    const correlated = projectFeed([
      event(1, 'tool.start', { tool_call_id: 'kernel-2', tool: 'kernel', arguments: { action: 'sync_environment', environment_id: 'env-1' } }),
      event(2, 'kernel.environment.updated', { tool_call_id: 'kernel-2', environment: { id: 'env-1', status: 'syncing' } }),
    ], [])
    expect(correlated.filter((item) => item.kind === 'tool')).toHaveLength(1)
    const item = correlated.find((candidate) => candidate.kind === 'tool')
    expect(item?.kind === 'tool' && item.surface.state).toBe('running')
    expect(projectFeed([event(3, 'kernel.environment.updated', { environment: { id: 'env-2', status: 'ready' } })], [])).toHaveLength(0)
  })

  it('replaces an interaction request with its resolved receipt surface', () => {
    const required = event(1, 'interaction.required', { interaction: { version: 1, interaction_id: 'i1', session_id: 's', kind: 'review_request', summary: 'Approve?', choices: ['allow_once'] }, revision: 1 })
    const resolved = event(2, 'interaction.resolved', { interaction_id: 'i1', receipt: { outcome: 'success', summary: 'Approved' } })
    const items = projectFeed([required, resolved], [])
    expect(items.filter((item) => item.kind === 'interaction')).toHaveLength(1)
    const item = items.find((candidate) => candidate.kind === 'interaction')
    expect(item?.id).toBe('interaction:i1')
    expect(item?.kind === 'interaction' && (item.event.payload?.interaction as { summary?: string }).summary).toBe('Approve?')
    expect(item?.kind === 'interaction' && item.event.payload?.receipt).toEqual({ outcome: 'success', summary: 'Approved' })
  })

  it('safely projects partial and unknown payloads', () => {
    const items = projectFeed([event(1, 'tool.update', { tool_call_id: 'x', tool: 'future', update: { partial: true, unknown: { nested: true } } })], [])
    expect(items).toHaveLength(1)
    expect(items[0]?.kind).toBe('tool')
  })

  it('prepends history by business IDs', () => {
    expect(Object.keys(prependHistory({ 3: event(3, 'settled') }, [event(1, 'assistant.text'), event(2, 'assistant.text')])).map(Number)).toEqual([1, 2, 3])
  })

  it('projects 3000 events and 500 surfaces deterministically', () => {
    const events: PigentEvent[] = []
    for (let index = 0; index < 500; index++) {
      events.push(event(index * 6 + 1, 'tool.start', { tool_call_id: `call-${index}`, tool: 'read' }))
      for (let delta = 0; delta < 4; delta++) events.push(event(index * 6 + 2 + delta, 'tool.update', { tool_call_id: `call-${index}`, tool: 'read', update: { delta } }))
      events.push(event(index * 6 + 6, 'tool.end', { tool_call_id: `call-${index}`, tool: 'read', status: 'completed' }))
    }
    const started = performance.now()
    const items = projectFeed(events, [])
    expect(items).toHaveLength(500)
    expect(performance.now() - started).toBeLessThan(1000)
  })
})
