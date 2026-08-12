import { describe, expect, it } from 'vitest'
import { createInitialState, pigentReducer } from './store'
import type { PigentEvent } from './types'

const session = { id: 'pigent_s', account_id: 'a', project_id: 'p', workspace_id: 'w', node_id: 'n', mode: 'ask' as const, approval_preference: 'automatic' as const, status: 'active' as const, created_at: '2025-01-01T00:00:00Z', last_activity_at: '2025-01-01T00:00:00Z' }
const event = (id: number | null, type: PigentEvent['type'], payload: Record<string, unknown> = {}): PigentEvent => ({ version: 1, event_id: id, session_id: session.id, type, timestamp: '2025-01-01T00:00:00Z', payload })

describe('Pigent store reducer', () => {
  it('preserves active run state while waiting for reconnect cursor', () => {
    const active = { ...session, run_id: 'run_active', turn_id: 'turn_active' }
    const state = pigentReducer(createInitialState('test'), { type: 'active', session: active, preserveCursor: false })
    expect(state.runActive).toBe(true)
    expect(state.runId).toBe('run_active')
  })

  it('does not let reconnect cursor consume a business event ID', () => {
    let state = pigentReducer(createInitialState('test'), { type: 'active', session, preserveCursor: false })
    state = pigentReducer(state, { type: 'event', event: event(null, 'reconnect.cursor', { session, after_event_id: 0 }) })
    expect(state.lastEventId).toBe(0)
    state = pigentReducer(state, { type: 'event', event: event(1, 'assistant.text', { text: 'hello' }) })
    expect(state.lastEventId).toBe(1)
  })

  it('deduplicates business events and settles stop state authoritatively', () => {
    let state = pigentReducer(createInitialState('test'), { type: 'active', session, preserveCursor: false })
    state = pigentReducer(state, { type: 'stopping', value: true })
    state = pigentReducer(state, { type: 'event', event: event(1, 'aborted', { run_id: 'run' }) })
    const same = pigentReducer(state, { type: 'event', event: event(1, 'aborted', { run_id: 'run' }) })
    expect(same).toBe(state)
    expect(state.stopping).toBe(false)
    expect(state.status).toBe('interrupted')
  })

  it('tracks optimistic failure and retry states', () => {
    let state = createInitialState('test')
    state = pigentReducer(state, { type: 'user', message: { clientMessageId: 'c', content: 'hello', behavior: 'prompt', state: 'pending', createdAt: 'now' } })
    state = pigentReducer(state, { type: 'userUpdate', id: 'c', changes: { state: 'failed', error: 'offline' } })
    expect(state.userMessages[0]?.state).toBe('failed')
    state = pigentReducer(state, { type: 'userUpdate', id: 'c', changes: { state: 'retrying' } })
    expect(state.userMessages[0]?.state).toBe('retrying')
  })
})
