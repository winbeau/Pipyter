import type { TerminalEnvelope, TerminalSession } from './types'
async function request<T>(path: string, init?: RequestInit): Promise<T> { const response = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...init }); if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${await response.text().catch(() => '')}`); if (response.status === 204) return undefined as T; return response.json() as Promise<T> }
export const shellApi = {
  list: () => request<TerminalSession[]>('/api/v1/terminals'),
  create: (cwd = '.', name?: string, executable?: string) => request<TerminalSession>('/api/v1/terminals', { method: 'POST', body: JSON.stringify({ cwd, name, executable, cols: 100, rows: 24 }) }),
  close: (id: string) => request<void>(`/api/v1/terminals/${id}`, { method: 'DELETE' }),
  resize: (id: string, cols: number, rows: number) => request<TerminalSession>(`/api/v1/terminals/${id}/resize`, { method: 'POST', body: JSON.stringify({ cols, rows }) }),
}
export function shellStreamUrl(id: string, cursor: number) { const scheme = location.protocol === 'https:' ? 'wss:' : 'ws:'; return `${scheme}//${location.host}/api/v1/terminals/${encodeURIComponent(id)}/stream?cursor=${cursor}` }
export function parseEnvelope(value: string): TerminalEnvelope | null { try { const parsed = JSON.parse(value) as TerminalEnvelope; return parsed?.version === 1 ? parsed : null } catch { return null } }
