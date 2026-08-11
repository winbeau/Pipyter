import type { TerminalSession } from '../../../packages/protocol/src/pigent'
export type { TerminalSession }
export type ShellConnectionState = 'connecting' | 'connected' | 'disconnected'
export type ShellPane = { id: string; sessionId: string }
export type TerminalEnvelope =
  | { version: 1; type: 'output'; cursor: number; encoding: 'utf-8' | 'base64' | 'binary'; data?: string; size?: number }
  | { version: 1; type: 'replay'; cursor: number; requested_cursor: number; earliest_cursor: number; truncated: boolean }
  | { version: 1; type: 'status'; cursor: number; session: TerminalSession }
  | { version: 1; type: 'exit'; cursor: number; exit_code: number | null }
