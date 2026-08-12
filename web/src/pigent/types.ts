import type { PigentModelChoice, PigentModelSelection } from './models'

export type {
  ArtifactRef,
  ExecutionIdentity,
  PigentEvent,
  PigentInteraction,
  PigentMode,
  PigentSession,
  PigentSessionStatus,
  PigentTaskStatus,
  PigentToolName,
  TaskNode,
  TasksSnapshot,
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
  model?: PigentModelSelection
  models?: PigentModelChoice[]
  settings_revision?: string
  host?: Record<string, unknown>
}

export type PigentConnectionState = 'connecting' | 'connected' | 'disconnected' | 'demo'
