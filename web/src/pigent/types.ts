import type { PigentModelChoice, PigentModelSelection } from './models'

export type {
  ArtifactRef,
  ExecutionIdentity,
  KernelEnvironmentSummary,
  OperationEnvelope,
  PigentEvent,
  PigentInteraction,
  PigentMode,
  PigentSession,
  PigentSessionStatus,
  PigentTaskStatus,
  PigentToolError,
  PigentToolName,
  TaskNode,
  TasksSnapshot,
  ToolReceipt,
} from '../../../packages/protocol/src/pigent'

export type PigentContext = {
  workspace?: string
  activeDocument?: string
  activeCell?: string
  activeKernel?: string
  figure?: string
}

export type PigentCapabilities = {
  protocol_version: string
  tools: string[]
  modes: Record<'ask' | 'plan' | 'auto', string[]>
  action_filters?: Record<string, Record<'ask' | 'plan' | 'auto', string[]>>
  capabilities?: string[]
  event_types?: string[]
  model?: PigentModelSelection
  models?: PigentModelChoice[]
  settings_revision?: string
  host?: Record<string, unknown>
}

export type PigentConnectionState = 'connecting' | 'connected' | 'disconnected' | 'demo'

export type OptimisticUserMessage = {
  clientMessageId: string
  content: string
  behavior: 'prompt' | 'follow_up'
  state: 'pending' | 'accepted' | 'running' | 'settled' | 'failed' | 'retrying'
  createdAt: string
  runId?: string
  turnId?: string
  error?: string
}

export type SurfaceState = 'queued' | 'running' | 'waiting_for_user' | 'succeeded' | 'failed' | 'cancelled'

export type ToolSurfaceAction = {
  id: 'copy' | 'download' | 'open' | 'reveal'
  label: string
  href?: string
  value?: string
}

export type ToolSurfaceModel = {
  id: string
  toolCallId: string
  tool: string
  action?: string
  state: SurfaceState
  startedAt?: string
  endedAt?: string
  durationMs?: number
  input?: unknown
  output?: unknown
  error?: Record<string, unknown>
  receipt?: Record<string, unknown>
  operation?: Record<string, unknown>
  actions: ToolSurfaceAction[]
  raw: Record<string, unknown>
}

export type FeedItem =
  | { kind: 'user'; id: string; message: OptimisticUserMessage }
  | { kind: 'assistant'; id: string; text: string; timestamp: string; thinking: boolean }
  | { kind: 'tool'; id: string; surface: ToolSurfaceModel }
  | { kind: 'interaction'; id: string; event: import('../../../packages/protocol/src/pigent').PigentEvent }
  | { kind: 'artifact'; id: string; event: import('../../../packages/protocol/src/pigent').PigentEvent }
  | { kind: 'status'; id: string; event: import('../../../packages/protocol/src/pigent').PigentEvent }
