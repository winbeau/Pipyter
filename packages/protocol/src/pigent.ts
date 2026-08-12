/**
 * Pigent v0.2 contracts (Python equivalents: src/pipyter/protocol/pigent.py).
 * Authoritative JSON Schema lives in packages/protocol/schemas/pigent-*.schema.json;
 * the wheel force-includes those schemas.
 *
 * Product surface (docs/plans/pigent-v0.1/):
 *  - exactly ten LLM-visible tools: read view write update bash notebook kernel inspect tasks delegate
 *  - exactly three modes: Ask, Plan, Auto. Pilot is rejected by every new schema;
 *    legacy state maps to auto exactly once.
 *  - Auto executes with the same practical authority as the runtime OS user; no
 *    workspace-only sandbox, denylist, or hidden restricted tier.
 */

export const PIGENT_PROTOCOL_VERSION = '0.2' as const

export const PIGENT_TOOL_NAMES = [
  'read',
  'view',
  'write',
  'update',
  'bash',
  'notebook',
  'kernel',
  'inspect',
  'tasks',
  'delegate',
] as const
export type PigentToolName = (typeof PIGENT_TOOL_NAMES)[number]

export const PIGENT_MODES = ['ask', 'plan', 'auto'] as const
export type PigentMode = (typeof PIGENT_MODES)[number]

/** Legacy pilot values accepted only by the migration loader. */
export type LegacyPigentMode = PigentMode | 'pilot'

export const PIGENT_ERROR_CODES = [
  'invalid_request',
  'invalid_path',
  'permission_denied',
  'not_found',
  'unsupported_media',
  'too_large',
  'revision_conflict',
  'mode_denied',
  'confirmation_required',
  'kernel_unavailable',
  'kernel_busy',
  'execution_timeout',
  'cancelled',
  'internal_error',
  'document_dirty',
  'output_persist_conflict',
  'kernel_dead',
  'model_configuration_required',
  'service_unavailable',
  'payload_missing', 'payload_stale', 'uv_missing', 'uv_incompatible',
  'config_migration_conflict', 'config_migration_invalid_source',
  'kernel_environment_not_found', 'kernel_environment_conflict', 'kernel_environment_busy',
  'kernel_environment_stale', 'kernel_environment_provision_failed', 'kernel_environment_sync_failed',
  'kernel_queue_cancelled', 'operation_not_cancellable', 'interaction_superseded',
] as const
export type PigentErrorCode = (typeof PIGENT_ERROR_CODES)[number]

export const PIGENT_EVENT_TYPES = [
  'session.created',
  'session.updated',
  'mode.changed',
  'assistant.text',
  'assistant.thinking',
  'tool.start',
  'tool.update',
  'tool.end',
  'tasks.snapshot',
  'delegate.start',
  'delegate.update',
  'delegate.end',
  'interaction.required',
  'interaction.resolved',
  'context.updated',
  'kernel.updated',
  'artifact.created',
  'error',
  'aborted',
  'settled',
  'reconnect.cursor',
  'operation.started', 'operation.updated', 'operation.ended', 'kernel.environment.updated',
] as const
export type PigentEventType = (typeof PIGENT_EVENT_TYPES)[number]

export const PIGENT_TASK_STATUSES = ['pending', 'running', 'done', 'blocked', 'failed'] as const
export type PigentTaskStatus = (typeof PIGENT_TASK_STATUSES)[number]

export const PIGENT_SESSION_STATUSES = [
  'active',
  'completed',
  'failed',
  'interrupted',
  'waiting_for_user',
] as const
export type PigentSessionStatus = (typeof PIGENT_SESSION_STATUSES)[number]

export const PIGENT_ARTIFACT_KINDS = ['image', 'table', 'text', 'file'] as const
export type PigentArtifactKind = (typeof PIGENT_ARTIFACT_KINDS)[number]

export const PIGENT_DELEGATE_PROFILES = ['analysis', 'research', 'review', 'implementation'] as const
export type PigentDelegateProfile = (typeof PIGENT_DELEGATE_PROFILES)[number]

export const PIGENT_CAPABILITIES = [
  'filesystem.read',
  'filesystem.write',
  'visual.read',
  'notebook.read',
  'notebook.write',
  'kernel.status',
  'kernel.inspect',
  'kernel.execute',
  'process.execute',
  'process.interactive',
  'network',
  'system.execute',
  'tasks.write',
  'delegate.read',
  'delegate.write',
  'kernel.environment.read', 'kernel.environment.manage',
] as const
export type PigentCapability = (typeof PIGENT_CAPABILITIES)[number]

/** allow: available; deny: contradicts the selected mode; os: Auto + OS identity; interactive: Auto, may pause for direct input. */
export type CapabilityLevel = 'allow' | 'deny' | 'os' | 'interactive'

/** Frozen mode x capability matrix (03-modes-permissions.md). */
export const PIGENT_MODE_MATRIX: Readonly<Record<PigentCapability, Readonly<Record<PigentMode, CapabilityLevel>>>> = {
  'filesystem.read': { ask: 'allow', plan: 'allow', auto: 'os' },
  'visual.read': { ask: 'allow', plan: 'allow', auto: 'os' },
  'notebook.read': { ask: 'allow', plan: 'allow', auto: 'os' },
  'kernel.status': { ask: 'allow', plan: 'allow', auto: 'os' },
  'kernel.inspect': { ask: 'allow', plan: 'allow', auto: 'os' },
  'kernel.environment.read': { ask: 'allow', plan: 'allow', auto: 'allow' },
  'tasks.write': { ask: 'deny', plan: 'allow', auto: 'allow' },
  'delegate.read': { ask: 'allow', plan: 'allow', auto: 'allow' },
  'filesystem.write': { ask: 'deny', plan: 'deny', auto: 'os' },
  'notebook.write': { ask: 'deny', plan: 'deny', auto: 'os' },
  'kernel.execute': { ask: 'deny', plan: 'deny', auto: 'os' },
  'process.execute': { ask: 'deny', plan: 'deny', auto: 'os' },
  'process.interactive': { ask: 'deny', plan: 'deny', auto: 'interactive' },
  network: { ask: 'deny', plan: 'deny', auto: 'os' },
  'system.execute': { ask: 'deny', plan: 'deny', auto: 'interactive' },
  'delegate.write': { ask: 'deny', plan: 'deny', auto: 'allow' },
  'kernel.environment.manage': { ask: 'deny', plan: 'deny', auto: 'os' },
}

/**
 * Projected tool catalogs by mode.
 * Ask: read, view, notebook (read only), kernel (status only), inspect, delegate (non-writing profiles).
 * Plan: Ask + tasks.
 * Auto: exactly ten tools.
 */
export const PIGENT_CATALOGS: Readonly<Record<PigentMode, readonly PigentToolName[]>> = {
  ask: ['read', 'view', 'notebook', 'kernel', 'inspect', 'delegate'],
  plan: ['read', 'view', 'notebook', 'kernel', 'inspect', 'delegate', 'tasks'],
  auto: PIGENT_TOOL_NAMES,
}

/** Per-mode action filters for multi-action tools. */
export const PIGENT_ACTION_FILTERS: Readonly<
  Record<'notebook' | 'kernel' | 'inspect' | 'tasks' | 'delegate', Readonly<Record<PigentMode, readonly string[]>>>
> = {
  notebook: {
    ask: ['read_cell'],
    plan: ['read_cell'],
    auto: ['read_cell', 'update_cell', 'insert_cell', 'delete_cell', 'move_cell', 'run_cell', 'add_markdown', 'clear_output'],
  },
  kernel: {
    ask: ['status', 'list_environments', 'operation_status'],
    plan: ['status', 'list_environments', 'operation_status'],
    auto: ['status', 'execute', 'interrupt', 'restart', 'shutdown', 'list_environments', 'operation_status', 'create_temporary', 'create_maintained', 'sync_environment', 'start_environment', 'promote_environment', 'delete_environment'],
  },
  inspect: {
    ask: ['variables', 'variable', 'dataframe', 'figure', 'object'],
    plan: ['variables', 'variable', 'dataframe', 'figure', 'object'],
    auto: ['variables', 'variable', 'dataframe', 'figure', 'object'],
  },
  tasks: {
    ask: [],
    plan: ['get', 'replace', 'patch'],
    auto: ['get', 'replace', 'patch'],
  },
  delegate: {
    ask: ['analysis', 'research', 'review'],
    plan: ['analysis', 'research', 'review'],
    auto: ['analysis', 'research', 'review', 'implementation'],
  },
}

// ---------------------------------------------------------------------------
// Result / error envelopes
// ---------------------------------------------------------------------------

export type Revision = `sha256:${string}`

export interface PigentToolError {
  code: PigentErrorCode
  message: string
  retryable: boolean
  details?: Record<string, unknown>
}

export interface PigentToolResult {
  version: 1
  ok: boolean
  summary: string
  data?: Record<string, unknown>
  artifacts?: ArtifactRef[]
  revisions?: { before: Revision; after: Revision } | null
  error?: PigentToolError
  warnings?: string[]
}

/** Trusted context injected by the Pigent host; the model can never override these fields. */
export interface PigentToolContext {
  protocol_version: typeof PIGENT_PROTOCOL_VERSION
  tool_call_id: string
  session_id: string
  workspace_id: string
  mode: PigentMode
  active_document?: { path: string; revision: Revision; cell_id: string }
  active_kernel_id?: string
}

// ---------------------------------------------------------------------------
// Session / tasks / terminal / artifact / interaction
// ---------------------------------------------------------------------------

export type OperationState = 'queued' | 'running' | 'waiting_for_user' | 'succeeded' | 'failed' | 'cancelled'
export type OperationOutcome = 'success' | 'partial' | 'failed' | 'cancelled' | 'superseded'
export type KernelEnvironmentKind = 'temporary' | 'maintained'
export type KernelEnvironmentStatus = 'provisioning' | 'ready' | 'stale' | 'syncing' | 'error' | 'deleting' | 'missing'

export interface OperationProgress {
  phase: string
  completed: number
  total?: number | null
  message?: string
}

export interface ToolReceipt {
  outcome: OperationOutcome
  summary: string
  identifiers?: Record<string, string>
  at: string
}

export interface OperationEnvelope {
  operation_id: string
  kind: string
  state: OperationState
  progress?: OperationProgress | null
  resource: { type: 'kernel_environment'; id: string }
  created_at: string
  updated_at: string
  session_id?: string | null
  tool_call_id?: string | null
  cancellable: boolean
  receipt?: ToolReceipt | null
  error?: PigentToolError | null
}

export interface KernelEnvironmentSummary {
  id: string
  kind: KernelEnvironmentKind
  name?: string | null
  display_name: string
  status: KernelEnvironmentStatus
  python_request: string
  python_version?: string | null
  interpreter?: string | null
  packages?: string[]
  source?: Record<string, unknown> | null
  lock_revision?: string | null
  revision: string
  created_at: string
  updated_at: string
  last_used_at?: string | null
  expires_at?: string | null
  active_kernel_ids?: string[]
  last_error?: PigentToolError | null
}

export interface ExecutionIdentity {
  username: string
  uid: number | string | null
  home: string
  workspace: string
}

export interface TaskNode {
  id: string
  title: string
  status: PigentTaskStatus
  depends_on?: string[]
  completion_criteria?: string[]
  children?: TaskNode[]
}

export interface TasksSnapshot {
  revision: string
  root: TaskNode
  updated_at?: string
}

export interface PigentSession {
  id: string
  account_id: string
  project_id: string
  workspace_id: string
  node_id: string
  mode: PigentMode
  approval_preference: 'automatic' | 'review_all'
  status: PigentSessionStatus
  title?: string
  created_at: string
  last_activity_at: string
  active_document?: { path: string; revision: Revision; cell_id: string }
  active_kernel_id?: string
  model?: { provider: string; model: string }
  tasks_snapshot?: TasksSnapshot
}

export interface TerminalSession {
  id: string
  name: string
  executable: string
  cwd: string
  status: 'running' | 'exited' | 'closed'
  cols: number
  rows: number
  created_at: string
  last_exit_code?: number | null
}

export interface ArtifactRef {
  id: string
  kind: PigentArtifactKind
  mime: string
  size: number
  created_at: string
  hash: Revision
  width?: number
  height?: number
  expires_at?: string
}

export interface PigentInteraction {
  version: 1
  interaction_id: string
  session_id: string
  tool_call_id: string
  kind: 'pty_handoff' | 'review_request' | 'clarification'
  summary: string
  shell_session_id?: string
  command_preview?: string
  choices: ('open_shell' | 'cancel' | 'allow_once' | 'allow_workspace' | 'reject')[]
}

export interface PigentEvent {
  version: 1
  event_id: number | null
  session_id: string
  type: PigentEventType
  timestamp: string
  payload?: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Runtime validation helpers
// ---------------------------------------------------------------------------

export function isPigentMode(value: unknown): value is PigentMode {
  return typeof value === 'string' && (PIGENT_MODES as readonly string[]).includes(value)
}

export function isPigentTool(value: unknown): value is PigentToolName {
  return typeof value === 'string' && (PIGENT_TOOL_NAMES as readonly string[]).includes(value)
}

export function isPigentEventType(value: unknown): value is PigentEventType {
  return typeof value === 'string' && (PIGENT_EVENT_TYPES as readonly string[]).includes(value)
}

export function isPigentErrorCode(value: unknown): value is PigentErrorCode {
  return typeof value === 'string' && (PIGENT_ERROR_CODES as readonly string[]).includes(value)
}

export function isRevision(value: unknown): value is Revision {
  return typeof value === 'string' && /^sha256:[0-9a-f]{64}$/.test(value)
}

export interface LegacySessionState {
  mode?: LegacyPigentMode
  requested_mode?: LegacyPigentMode
  effective_mode?: LegacyPigentMode
  [key: string]: unknown
}

/**
 * Legacy migration: mode/requested_mode/effective_mode == 'pilot' map to 'auto'
 * exactly once; legacy fields are removed after one successful write.
 * New schemas reject 'pilot' anywhere.
 */
export function migrateLegacySessionState(state: LegacySessionState): {
  migrated: Record<string, unknown>
  changed: boolean
} {
  const migrated: Record<string, unknown> = { ...state }
  let changed = false
  const map = (key: string): void => {
    if (key in migrated) {
      const value = migrated[key]
      if (value === 'pilot') {
        migrated[key] = 'auto'
        changed = true
      } else if (value !== 'ask' && value !== 'plan' && value !== 'auto') {
        throw new Error(`invalid legacy mode field ${key}: ${String(value)}`)
      }
    }
  }
  map('mode')
  map('requested_mode')
  map('effective_mode')
  if (changed) {
    delete migrated['requested_mode']
    delete migrated['effective_mode']
  }
  return { migrated, changed }
}

/** Tools advertised to the model in the selected mode. */
export function allowedToolNames(mode: PigentMode): readonly PigentToolName[] {
  return PIGENT_CATALOGS[mode]
}

/** Actions allowed for a multi-action tool in the selected mode. */
export function allowedActions(tool: PigentToolName, mode: PigentMode): readonly string[] {
  const filter = PIGENT_ACTION_FILTERS[tool as keyof typeof PIGENT_ACTION_FILTERS]
  if (!filter) return []
  return filter[mode]
}
