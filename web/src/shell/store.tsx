import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react'
import { createShellApi, parseEnvelope } from './api'
import type { ShellConnectionState, ShellPane, TerminalEnvelope, TerminalSession } from './types'

const HEIGHT_KEY = 'pipyter.shell.height'
const liveSessions = (list: TerminalSession[]) => list.filter((item) => item.status !== 'closed')
export type ShellState = { sessions: TerminalSession[]; activeSessionId: string | null; panes: ShellPane[]; outputBuffers: Record<string, string>; connectionState: ShellConnectionState; panelHeight: number; maximized: boolean; panelRequested: boolean; error: string | null }
const initial: ShellState = { sessions: [], activeSessionId: null, panes: [], outputBuffers: {}, connectionState: 'connecting', panelHeight: Math.max(160, Math.min(600, Number(localStorage.getItem(HEIGHT_KEY)) || 220)), maximized: false, panelRequested: false, error: null }
type Action =
 | { type: 'sessions'; sessions: TerminalSession[] }
 | { type: 'select'; id: string }
 | { type: 'append'; id: string; data: string }
 | { type: 'clear'; id: string }
 | { type: 'status'; session: TerminalSession }
 | { type: 'connection'; state: ShellConnectionState; error?: string | null }
 | { type: 'height'; height: number }
 | { type: 'maximize'; value: boolean }
 | { type: 'panes'; panes: ShellPane[] }
 | { type: 'request'; value: boolean }
function reducer(state: ShellState, action: Action): ShellState {
 switch (action.type) {
  case 'sessions': { const ids = new Set(action.sessions.map((item) => item.id)); const active = state.activeSessionId && ids.has(state.activeSessionId) ? state.activeSessionId : action.sessions[0]?.id ?? null; const panes = state.panes.filter((pane) => ids.has(pane.sessionId)); return { ...state, sessions: action.sessions, activeSessionId: active, panes: panes.length ? panes : active ? [{ id: 'pane-main', sessionId: active }] : [] } }
  case 'select': return { ...state, activeSessionId: action.id, panes: state.panes.length ? state.panes.map((pane, index) => index === 0 ? { ...pane, sessionId: action.id } : pane) : [{ id: 'pane-main', sessionId: action.id }] }
  case 'append': return { ...state, outputBuffers: { ...state.outputBuffers, [action.id]: (state.outputBuffers[action.id] ?? '') + action.data } }
  case 'clear': return { ...state, outputBuffers: { ...state.outputBuffers, [action.id]: '' } }
  case 'status': return { ...state, sessions: state.sessions.map((item) => item.id === action.session.id ? action.session : item) }
  case 'connection': return { ...state, connectionState: action.state, error: action.error ?? null }
  case 'height': return { ...state, panelHeight: action.height }
  case 'maximize': return { ...state, maximized: action.value }
  case 'panes': return { ...state, panes: action.panes }
  case 'request': return { ...state, panelRequested: action.value }
 }
}
export type ShellActions = { refresh(): Promise<void>; create(): Promise<TerminalSession>; select(id: string): void; send(id: string, data: string): void; resize(id: string, cols: number, rows: number): void; clear(id?: string): void; close(id: string): Promise<void>; split(): Promise<void>; setHeight(height: number): void; setMaximized(value: boolean): void; requestPanel(id?: string): void; acknowledgePanel(): void }
const Context = createContext<{ state: ShellState; actions: ShellActions } | null>(null)

export function ShellProvider({ children, apiBase = '' }: { children: ReactNode; apiBase?: string }) {
 const [state, dispatch] = useReducer(reducer, initial); const stateRef = useRef(state); stateRef.current = state
 const api = useMemo(() => createShellApi(apiBase), [apiBase])
 const sockets = useRef(new Map<string, WebSocket>()); const cursors = useRef(new Map<string, number>()); const binaryCursor = useRef(new Map<string, number>())
 const connect = useCallback((session: TerminalSession) => {
  const existing = sockets.current.get(session.id); if (existing && existing.readyState <= WebSocket.OPEN) return
  const socket = new WebSocket(api.streamUrl(session.id, cursors.current.get(session.id) ?? 0)); socket.binaryType = 'arraybuffer'; sockets.current.set(session.id, socket)
  socket.onopen = () => dispatch({ type: 'connection', state: 'connected' })
  socket.onmessage = (message) => {
   if (message.data instanceof ArrayBuffer) { dispatch({ type: 'append', id: session.id, data: new TextDecoder().decode(message.data) }); const cursor = binaryCursor.current.get(session.id); if (cursor) cursors.current.set(session.id, cursor); return }
   const envelope = parseEnvelope(String(message.data)); if (!envelope) return
   if (envelope.type === 'output') { if (envelope.encoding === 'binary') binaryCursor.current.set(session.id, envelope.cursor); else { const data = envelope.encoding === 'base64' ? atob(envelope.data ?? '') : envelope.data ?? ''; dispatch({ type: 'append', id: session.id, data }); cursors.current.set(session.id, envelope.cursor) } }
   else if (envelope.type === 'status') { dispatch({ type: 'status', session: envelope.session }); cursors.current.set(session.id, envelope.cursor) }
   else if (envelope.type === 'exit') { cursors.current.set(session.id, envelope.cursor); void api.list().then((sessions) => dispatch({ type: 'sessions', sessions: liveSessions(sessions) })) }
  }
  socket.onclose = () => { sockets.current.delete(session.id); if ([...sockets.current.values()].every((item) => item.readyState !== WebSocket.OPEN)) dispatch({ type: 'connection', state: 'disconnected' }) }
  socket.onerror = () => dispatch({ type: 'connection', state: 'disconnected', error: 'Shell stream disconnected' })
 }, [api])
 const refresh = useCallback(async () => { try { const sessions = liveSessions(await api.list()); dispatch({ type: 'sessions', sessions }); sessions.forEach(connect); dispatch({ type: 'connection', state: sessions.length ? 'connecting' : 'connected' }) } catch (error) { dispatch({ type: 'connection', state: 'disconnected', error: error instanceof Error ? error.message : String(error) }) } }, [api, connect])
 useEffect(() => { void refresh(); const open = (event: Event) => { const id = (event as CustomEvent<{ sessionId?: string }>).detail?.sessionId; dispatch({ type: 'request', value: true }); if (id) { void api.list().then((sessions) => { sessions = liveSessions(sessions); dispatch({ type: 'sessions', sessions }); const session = sessions.find((item) => item.id === id); if (session) { connect(session); dispatch({ type: 'select', id }) } }) } }; window.addEventListener('pipyter:open-shell', open); return () => { window.removeEventListener('pipyter:open-shell', open); sockets.current.forEach((socket) => socket.close()) } }, [api, connect, refresh])
 const create = useCallback(async () => { const session = await api.create('.'); dispatch({ type: 'sessions', sessions: [...stateRef.current.sessions, session] }); dispatch({ type: 'select', id: session.id }); connect(session); dispatch({ type: 'request', value: true }); return session }, [api, connect])
 const actions = useMemo<ShellActions>(() => ({ refresh, create, select: (id) => { dispatch({ type: 'select', id }); const session = stateRef.current.sessions.find((item) => item.id === id); if (session) connect(session) }, send: (id, data) => { const socket = sockets.current.get(id); if (socket?.readyState === WebSocket.OPEN) socket.send(data) }, resize: (id, cols, rows) => { const socket = sockets.current.get(id); if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ version: 1, type: 'resize', cols, rows })); else void api.resize(id, cols, rows) }, clear: (id) => { const selected = id ?? stateRef.current.activeSessionId; if (selected) dispatch({ type: 'clear', id: selected }) }, close: async (id) => { const session = stateRef.current.sessions.find((item) => item.id === id); if (session?.status === 'running' && !window.confirm(`关闭正在运行的 Shell “${session.name}”？`)) return; sockets.current.get(id)?.close(); await api.close(id); dispatch({ type: 'sessions', sessions: stateRef.current.sessions.filter((item) => item.id !== id) }) }, split: async () => { if (stateRef.current.panes.length >= 2) return; let other = stateRef.current.sessions.find((item) => item.id !== stateRef.current.activeSessionId); if (!other) other = await create(); dispatch({ type: 'panes', panes: [...stateRef.current.panes, { id: `pane-${Date.now()}`, sessionId: other.id }] }) }, setHeight: (height) => { const value = Math.max(160, Math.min(650, height)); localStorage.setItem(HEIGHT_KEY, String(value)); dispatch({ type: 'height', height: value }) }, setMaximized: (value) => dispatch({ type: 'maximize', value }), requestPanel: (id) => { dispatch({ type: 'request', value: true }); if (id) dispatch({ type: 'select', id }) }, acknowledgePanel: () => dispatch({ type: 'request', value: false }) }), [api, connect, create, refresh])
 return <Context.Provider value={{ state, actions }}>{children}</Context.Provider>
}
export function useShell() { const value = useContext(Context); if (!value) throw new Error('useShell must be used within ShellProvider'); return value }
