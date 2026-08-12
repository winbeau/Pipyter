/**
 * Pigent v0.2 contract tests (TypeScript side).
 * Golden JSON fixtures under schemas/fixtures are shared with the Python
 * tests (tests/test_pigent_protocol.py) for cross-language consistency.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  PIGENT_PROTOCOL_VERSION,
  PIGENT_TOOL_NAMES,
  PIGENT_MODES,
  PIGENT_ERROR_CODES,
  PIGENT_EVENT_TYPES,
  PIGENT_TASK_STATUSES,
  PIGENT_SESSION_STATUSES,
  PIGENT_ARTIFACT_KINDS,
  PIGENT_DELEGATE_PROFILES,
  PIGENT_CATALOGS,
  PIGENT_ACTION_FILTERS,
  isPigentMode,
  isPigentTool,
  isPigentEventType,
  isPigentErrorCode,
  isRevision,
  migrateLegacySessionState,
  allowedToolNames,
  allowedActions,
  type PigentEvent,
  type PigentSession,
  type PigentToolResult,
  type PigentToolContext,
} from '../src/pigent.ts'

const here = dirname(fileURLToPath(import.meta.url))
const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(resolve(here, '..', 'schemas', 'fixtures', name), 'utf-8'))

test('frozen constants match the plan', () => {
  assert.equal(PIGENT_PROTOCOL_VERSION, '0.2')
  assert.deepEqual(PIGENT_TOOL_NAMES, [
    'read', 'view', 'write', 'update', 'bash', 'notebook', 'kernel', 'inspect', 'tasks', 'delegate',
  ])
  assert.deepEqual(PIGENT_MODES, ['ask', 'plan', 'auto'])
  assert.ok(!PIGENT_MODES.includes('pilot' as never))
  assert.equal(PIGENT_ERROR_CODES.length, 34)
  assert.equal(PIGENT_EVENT_TYPES.length, 25)
  assert.deepEqual(PIGENT_TASK_STATUSES, ['pending', 'running', 'done', 'blocked', 'failed'])
  assert.deepEqual(PIGENT_SESSION_STATUSES, ['active', 'completed', 'failed', 'interrupted', 'waiting_for_user'])
  assert.deepEqual(PIGENT_ARTIFACT_KINDS, ['image', 'table', 'text', 'file'])
  assert.deepEqual(PIGENT_DELEGATE_PROFILES, ['analysis', 'research', 'review', 'implementation'])
})

test('catalogs: ask/plan/auto projection', () => {
  assert.deepEqual(allowedToolNames('ask'), ['read', 'view', 'notebook', 'kernel', 'inspect', 'delegate'])
  assert.deepEqual(allowedToolNames('plan'), ['read', 'view', 'notebook', 'kernel', 'inspect', 'delegate', 'tasks'])
  assert.deepEqual(allowedToolNames('auto'), PIGENT_TOOL_NAMES)
  assert.equal(PIGENT_CATALOGS.auto.length, 10)
  // Ask/Plan cannot reach execution actions merely because the parent tool exists.
  assert.deepEqual(allowedActions('notebook', 'ask'), ['read_cell'])
  assert.deepEqual(allowedActions('kernel', 'plan'), ['status', 'list_environments', 'operation_status'])
  assert.deepEqual(allowedActions('tasks', 'ask'), [])
  assert.deepEqual(allowedActions('delegate', 'ask'), ['analysis', 'research', 'review'])
  assert.deepEqual(allowedActions('delegate', 'auto'), ['analysis', 'research', 'review', 'implementation'])
  assert.equal(allowedActions('notebook', 'auto').length, 8)
  assert.equal(allowedActions('kernel', 'auto').length, 13)
  assert.equal(allowedActions('inspect', 'auto').length, 5)
  assert.equal(allowedActions('tasks', 'auto').length, 3)
  // No aliases: watch and edit are not in the action graph anywhere.
  assert.ok(!Object.values(PIGENT_ACTION_FILTERS).flatMap((m) => m.auto).includes('watch'))
  assert.ok(!Object.values(PIGENT_ACTION_FILTERS).flatMap((m) => m.auto).includes('edit'))
})

test('unknown values are rejected', () => {
  assert.equal(isPigentMode('pilot'), false)
  assert.equal(isPigentMode('auto'), true)
  assert.equal(isPigentTool('watch'), false)
  assert.equal(isPigentTool('edit'), false)
  assert.equal(isPigentTool('bash'), true)
  assert.equal(isPigentEventType('tool.end'), true)
  assert.equal(isPigentEventType('tool.watch'), false)
  assert.equal(isPigentErrorCode('revision_conflict'), true)
  assert.equal(isPigentErrorCode('anything_else'), false)
  assert.equal(isRevision('sha256:abc'), false)
  assert.equal(isRevision('sha256:' + 'a'.repeat(64)), true)
})

test('legacy pilot state maps to auto exactly once', () => {
  const input = fixture('legacy-pilot-state.json') as Record<string, unknown>
  const { migrated, changed } = migrateLegacySessionState(input)
  assert.equal(changed, true)
  assert.equal(migrated.mode, 'auto')
  assert.equal('requested_mode' in migrated, false, 'legacy requested_mode removed after migration')
  assert.equal('effective_mode' in migrated, false, 'legacy effective_mode removed after migration')
  assert.equal(migrated.session_id, 'pigent_sess_old_01')
  assert.equal(migrated.title, '旧 Pilot 会话')
  // A second pass is a no-op (maps exactly once).
  const again = migrateLegacySessionState(migrated)
  assert.equal(again.changed, false)
  assert.deepEqual(again.migrated, migrated)
  // Unknown legacy mode values are rejected.
  assert.throws(() => migrateLegacySessionState({ mode: 'turbo' } as unknown as Record<string, unknown>))
})

test('golden tool result fixture satisfies the envelope types', () => {
  const golden = fixture('golden-tool-result.json') as {
    success: PigentToolResult
    failure: PigentToolResult
  }
  assert.equal(golden.success.version, 1)
  assert.equal(golden.success.ok, true)
  assert.equal(golden.success.revisions?.before, golden.success.revisions?.after ? golden.success.revisions.before : undefined)
  assert.ok(isRevision(golden.success.revisions!.before))
  assert.ok(isRevision(golden.success.revisions!.after))
  assert.equal(golden.success.artifacts![0].kind, 'image')
  assert.equal(golden.failure.ok, false)
  assert.equal(golden.failure.error?.code, 'revision_conflict')
  assert.equal(golden.failure.error?.retryable, true)
})

test('golden session fixture satisfies PigentSession', () => {
  const golden = fixture('golden-session-state.json') as { session: PigentSession }
  const s = golden.session
  assert.equal(s.mode, 'auto')
  assert.equal('execution_identity' in s, false)
  assert.equal(s.tasks_snapshot?.root.status, 'running')
  assert.equal(s.tasks_snapshot?.root.children?.length, 3)
  const done = s.tasks_snapshot!.root.children!.find((c) => c.id === 'locate')!
  assert.equal(done.status, 'done')
})

test('golden events fixture satisfies PigentEvent and never carries secrets', () => {
  const golden = fixture('golden-events.json') as { events: PigentEvent[] }
  assert.equal(golden.events.length, 5)
  const ids = golden.events.map((e) => e.event_id).filter((id): id is number => id !== null)
  assert.deepEqual(ids, [...ids].sort((a, b) => a - b))
  const interaction = golden.events.find((e) => e.type === 'interaction.required')!
  const payload = interaction.payload as { interaction: { kind: string; choices: string[] } }
  assert.equal(payload.interaction.kind, 'pty_handoff')
  assert.equal(payload.interaction.choices[0], 'open_shell')
  const text = JSON.stringify(golden.events)
  for (const banned of ['password', 'apiKey', 'authorization', 'token=']) {
    assert.ok(!text.toLowerCase().includes(banned), `golden events must not contain ${banned}`)
  }
})

test('golden tool context envelope type checks', () => {
  const context: PigentToolContext = {
    protocol_version: '0.2',
    tool_call_id: 'call_x',
    session_id: 'pigent_s',
    workspace_id: 'workspace_1',
    mode: 'auto',
    active_document: {
      path: 'a.ipynb',
      revision: ('sha256:' + 'b'.repeat(64)) as `sha256:${string}`,
      cell_id: 'cell-1',
    },
  }
  assert.equal(context.mode, 'auto')
  assert.ok(isRevision(context.active_document!.revision))
  // @ts-expect-error pilot is not a valid mode
  const bad: PigentToolContext = { ...context, mode: 'pilot' }
  assert.equal(bad.mode, 'pilot')
})
