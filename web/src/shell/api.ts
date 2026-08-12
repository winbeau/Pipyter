import { jsonRequest, websocketUrl } from '../api/client'
import type { TerminalEnvelope, TerminalSession } from './types'

export function createShellApi(apiBase: string) {
  return {
    list: () => jsonRequest<TerminalSession[]>(apiBase, '/api/v1/terminals'),
    create: (cwd = '.', name?: string, executable?: string) => jsonRequest<TerminalSession>(apiBase, '/api/v1/terminals', { method: 'POST', body: JSON.stringify({ cwd, name, executable, cols: 100, rows: 24 }) }),
    close: (id: string) => jsonRequest<void>(apiBase, `/api/v1/terminals/${id}`, { method: 'DELETE' }),
    resize: (id: string, cols: number, rows: number) => jsonRequest<TerminalSession>(apiBase, `/api/v1/terminals/${id}/resize`, { method: 'POST', body: JSON.stringify({ cols, rows }) }),
    streamUrl: (id: string, cursor: number) => websocketUrl(apiBase, `/api/v1/terminals/${encodeURIComponent(id)}/stream?cursor=${cursor}`),
  }
}

export function parseEnvelope(value: string): TerminalEnvelope | null {
  try {
    const parsed = JSON.parse(value) as TerminalEnvelope
    return parsed?.version === 1 ? parsed : null
  } catch {
    return null
  }
}
