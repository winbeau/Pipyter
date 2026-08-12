import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react'
import { PIGENT_CATALOGS } from '../../../packages/protocol/src/pigent'
import { createPigentApi, parsePigentEvent } from './api'
import { demoEvents, demoSession, demoTasks } from './demo'
import { DEFAULT_PIGENT_MODEL, modelChoice, sameModel, type PigentModelChoice, type PigentModelSelection } from './models'
import type { PigentCapabilities, PigentConnectionState, PigentContext, PigentEvent, PigentInteraction, PigentMode, PigentSession, TasksSnapshot } from './types'

const STORAGE_PREFIX = 'pipyter.pigent.v1'
type Persisted = { pigentOpen?: boolean; pigentMode?: PigentMode; activePigentSessionId?: string; pigentDetailOpen?: boolean }
function storageKey(runtimeKey: string) { return `${STORAGE_PREFIX}:${runtimeKey}` }
function load(runtimeKey: string): Persisted { try { return JSON.parse(localStorage.getItem(storageKey(runtimeKey)) || '{}') as Persisted } catch { return {} } }

export type PigentState = {
  sessions: PigentSession[]
  activeSessionId: string | null
  mode: PigentMode
  pendingMode: PigentMode | null
  model: PigentModelSelection
  pendingModel: PigentModelSelection | null
  settingsRevision: string | null
  status: PigentSession['status'] | 'idle'
  runActive: boolean
  tasksSnapshot: TasksSnapshot | null
  eventsById: Record<number, PigentEvent>
  pendingInteractions: PigentInteraction[]
  context: PigentContext
  lastEventId: number
  open: boolean
  detailOpen: boolean
  connectionState: PigentConnectionState
  capabilities: PigentCapabilities | null
  error: string | null
}

function createInitialState(runtimeKey: string): PigentState {
  const saved = typeof window === 'undefined' ? {} : load(runtimeKey)
  return {
    sessions: [], activeSessionId: saved.activePigentSessionId ?? null, mode: saved.pigentMode ?? 'ask', pendingMode: null,
    model: DEFAULT_PIGENT_MODEL, pendingModel: null, settingsRevision: null,
    status: 'idle', runActive: false, tasksSnapshot: null, eventsById: {}, pendingInteractions: [], context: {},
    lastEventId: 0, open: saved.pigentOpen ?? false, detailOpen: saved.pigentDetailOpen ?? false,
    connectionState: 'connecting', capabilities: null, error: null,
  }
}

type Action =
  | { type: 'sessions'; sessions: PigentSession[]; demo?: boolean }
  | { type: 'active'; session: PigentSession; preserveCursor: boolean }
  | { type: 'pendingMode'; mode: PigentMode | null }
  | { type: 'pendingModel'; model: PigentModelSelection | null }
  | { type: 'model'; model: PigentModelSelection; revision?: string; session?: PigentSession }
  | { type: 'event'; event: PigentEvent }
  | { type: 'connection'; state: PigentConnectionState; error?: string | null }
  | { type: 'capabilities'; capabilities: PigentCapabilities }
  | { type: 'open'; open: boolean }
  | { type: 'detail'; open: boolean }
  | { type: 'context'; context: PigentContext }

function interactionFrom(event: PigentEvent): PigentInteraction | null {
  if (event.type !== 'interaction.required') return null
  const value = (event.payload?.interaction ?? event.payload) as unknown
  return value && typeof value === 'object' ? value as PigentInteraction : null
}
function isSessionStatus(value: unknown): value is PigentSession['status'] {
  return value === 'active' || value === 'completed' || value === 'failed' || value === 'interrupted' || value === 'waiting_for_user'
}
function reducer(state: PigentState, action: Action): PigentState {
  switch (action.type) {
    case 'sessions': return { ...state, sessions: action.sessions, connectionState: action.demo ? 'demo' : state.connectionState }
    case 'active': return { ...state, activeSessionId: action.session.id, mode: action.session.mode, pendingMode: null,
      model: modelChoice(action.session.model) ?? state.model, pendingModel: null, status: action.session.status, runActive: false,
      tasksSnapshot: action.session.tasks_snapshot ?? null, eventsById: action.preserveCursor ? state.eventsById : {},
      pendingInteractions: action.preserveCursor ? state.pendingInteractions : [], lastEventId: action.preserveCursor ? state.lastEventId : 0 }
    case 'pendingMode': return { ...state, pendingMode: action.mode }
    case 'pendingModel': return { ...state, pendingModel: action.model }
    case 'model': {
      const sessions = action.session ? state.sessions.map((item) => item.id === action.session?.id ? action.session : item) : state.sessions
      return { ...state, sessions, model: action.model, pendingModel: null, settingsRevision: action.revision ?? state.settingsRevision }
    }
    case 'connection': return { ...state, connectionState: action.state, error: action.error ?? null }
    case 'capabilities': return { ...state, capabilities: action.capabilities,
      model: modelChoice(action.capabilities.model) ?? state.model,
      settingsRevision: action.capabilities.settings_revision ?? state.settingsRevision }
    case 'open': return { ...state, open: action.open }
    case 'detail': return { ...state, detailOpen: action.open }
    case 'context': return { ...state, context: { ...state.context, ...action.context } }
    case 'event': {
      const event = action.event
      if (event.type === 'reconnect.cursor') {
        const session = event.payload?.session as PigentSession | undefined
        const tasks = (event.payload?.tasks as TasksSnapshot | null) ?? state.tasksSnapshot
        const sessions = session ? (state.sessions.some((item) => item.id === session.id)
          ? state.sessions.map((item) => item.id === session.id ? session : item)
          : [session, ...state.sessions]) : state.sessions
        return { ...state, sessions, activeSessionId: session?.id ?? state.activeSessionId,
          mode: session?.mode ?? state.mode, model: modelChoice(session?.model) ?? state.model,
          pendingModel: session?.model && sameModel(session.model, state.pendingModel) ? null : state.pendingModel,
          status: session?.status ?? state.status, runActive: Boolean(event.payload?.run_active), tasksSnapshot: tasks,
          settingsRevision: typeof event.payload?.settings_revision === 'string' ? event.payload.settings_revision : state.settingsRevision,
          lastEventId: Math.max(state.lastEventId, event.event_id) }
      }
      if (event.event_id <= state.lastEventId) return state
      let mode = state.mode, pendingMode = state.pendingMode, model = state.model, pendingModel = state.pendingModel
      let status = state.status, runActive = state.runActive, tasks = state.tasksSnapshot, settingsRevision = state.settingsRevision
      const updatedSession = event.type === 'session.updated' && event.payload?.session
        ? event.payload.session as unknown as PigentSession : null
      if (updatedSession) {
        mode = updatedSession.mode; status = updatedSession.status; tasks = updatedSession.tasks_snapshot ?? tasks
        const updatedModel = modelChoice(updatedSession.model)
        if (updatedModel) { model = updatedModel; if (sameModel(updatedModel, pendingModel)) pendingModel = null }
      }
      if (typeof event.payload?.settings_revision === 'string') settingsRevision = event.payload.settings_revision
      if (typeof event.payload?.run_active === 'boolean') runActive = event.payload.run_active
      if (event.type === 'mode.changed' && typeof event.payload?.mode === 'string') { mode = event.payload.mode as PigentMode; pendingMode = null }
      if (event.type === 'tasks.snapshot') tasks = (event.payload?.snapshot ?? event.payload) as unknown as TasksSnapshot
      if (event.type === 'assistant.text' || event.type === 'assistant.thinking' || event.type === 'tool.start' || event.type === 'tool.update' || event.type === 'tool.end' || event.type === 'delegate.start' || event.type === 'delegate.update' || event.type === 'delegate.end') { status = 'active'; runActive = true }
      if (event.type === 'settled') { status = isSessionStatus(event.payload?.status) ? event.payload.status : 'completed'; runActive = false }
      if (event.type === 'aborted') { status = 'interrupted'; runActive = false }
      if (event.type === 'error') { status = 'failed'; runActive = false }
      if (event.type === 'interaction.required') { status = 'waiting_for_user'; runActive = true }
      if (event.type === 'interaction.resolved') { status = 'active'; runActive = true }
      const interaction = interactionFrom(event)
      const pendingInteractions = interaction ? [...state.pendingInteractions.filter((item) => item.interaction_id !== interaction.interaction_id), interaction] : event.type === 'interaction.resolved' ? state.pendingInteractions.filter((item) => item.interaction_id !== event.payload?.interaction_id) : state.pendingInteractions
      const sessionStatus = status === 'idle' ? undefined : status
      const sessions = state.sessions.map((item) => item.id === event.session_id ? (updatedSession ?? {
        ...item, mode, status: sessionStatus ?? item.status, tasks_snapshot: tasks ?? undefined, last_activity_at: event.timestamp,
      }) : item)
      return { ...state, sessions, mode, pendingMode, model, pendingModel, settingsRevision, status, runActive,
        tasksSnapshot: tasks, eventsById: { ...state.eventsById, [event.event_id]: event }, pendingInteractions, lastEventId: event.event_id }
    }
  }
}

export type PigentActions = {
  selectSession(id: string): void
  ensureSession(title?: string): Promise<PigentSession>
  setMode(mode: PigentMode): Promise<void>
  setModel(model: PigentModelChoice): Promise<void>
  send(content: string): Promise<void>
  setOpen(open: boolean): void
  setDetailOpen(open: boolean): void
  setContext(context: PigentContext): void
  openShell(sessionId?: string): void
  refresh(): Promise<void>
}
const Context = createContext<{ state: PigentState; actions: PigentActions } | null>(null)

export function PigentProvider({ children, apiBase = '', runtimeKey = 'local:current', allowDemo = true }: { children: ReactNode; apiBase?: string; runtimeKey?: string; allowDemo?: boolean }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => createInitialState(runtimeKey))
  const api = useMemo(() => createPigentApi(apiBase), [apiBase])
  const stateRef = useRef(state); stateRef.current = state
  const socketRef = useRef<WebSocket | null>(null)

  const connect = useCallback((session: PigentSession, preserveCursor: boolean) => {
    socketRef.current?.close()
    dispatch({ type: 'active', session, preserveCursor })
    if (session.id === demoSession.id) return
    const after = preserveCursor ? stateRef.current.lastEventId : 0
    dispatch({ type: 'connection', state: 'connecting' })
    const socket = new WebSocket(api.streamUrl(session.id, after)); socketRef.current = socket
    socket.onopen = () => dispatch({ type: 'connection', state: 'connected' })
    socket.onmessage = (message) => { const event = parsePigentEvent(String(message.data)); if (event) dispatch({ type: 'event', event }) }
    socket.onerror = () => dispatch({ type: 'connection', state: 'disconnected', error: 'Pigent event stream disconnected' })
    socket.onclose = () => { if (socketRef.current === socket) dispatch({ type: 'connection', state: 'disconnected' }) }
  }, [api])

  const refresh = useCallback(async () => {
    try {
      const [sessions, capabilities] = await Promise.all([api.listSessions(), api.capabilities()])
      dispatch({ type: 'sessions', sessions }); dispatch({ type: 'capabilities', capabilities })
      const selected = sessions.find((item) => item.id === stateRef.current.activeSessionId) ?? [...sessions].sort((a, b) => b.last_activity_at.localeCompare(a.last_activity_at))[0]
      if (selected) connect(selected, selected.id === stateRef.current.activeSessionId && Object.keys(stateRef.current.eventsById).length > 0)
      else dispatch({ type: 'connection', state: 'connected' })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (allowDemo) {
        dispatch({ type: 'sessions', sessions: [demoSession], demo: true })
        dispatch({ type: 'active', session: demoSession, preserveCursor: false })
        for (const event of demoEvents) dispatch({ type: 'event', event })
        dispatch({ type: 'connection', state: 'demo', error: message })
      } else {
        dispatch({ type: 'sessions', sessions: [] })
        dispatch({ type: 'connection', state: 'disconnected', error: message })
      }
    }
  }, [allowDemo, api, connect])

  useEffect(() => { void refresh(); return () => socketRef.current?.close() }, [refresh])
  useEffect(() => {
    const payload: Persisted = { pigentOpen: state.open, pigentMode: state.mode, activePigentSessionId: state.activeSessionId ?? undefined, pigentDetailOpen: state.detailOpen }
    localStorage.setItem(storageKey(runtimeKey), JSON.stringify(payload))
  }, [runtimeKey, state.open, state.mode, state.activeSessionId, state.detailOpen])

  const ensureSession = useCallback(async (title?: string) => {
    const current = stateRef.current.sessions.find((item) => item.id === stateRef.current.activeSessionId)
    if (current && current.id !== demoSession.id) return current
    let session = await api.createSession(stateRef.current.mode, title)
    dispatch({ type: 'sessions', sessions: [session, ...stateRef.current.sessions.filter((item) => item.id !== demoSession.id)] })
    connect(session, false)
    if (stateRef.current.context.activeDocument || stateRef.current.context.activeKernel) {
      session = await api.changeContext(session.id, stateRef.current.context)
    }
    return session
  }, [api, connect])

  const actions = useMemo<PigentActions>(() => ({
    selectSession: (id) => { const session = stateRef.current.sessions.find((item) => item.id === id); if (session) connect(session, id === stateRef.current.activeSessionId) },
    ensureSession,
    setMode: async (mode) => {
      if (mode === stateRef.current.mode && !stateRef.current.pendingMode) return
      dispatch({ type: 'pendingMode', mode })
      try { const session = await ensureSession(); await api.changeMode(session.id, mode) }
      catch (error) { dispatch({ type: 'pendingMode', mode: null }); dispatch({ type: 'connection', state: stateRef.current.connectionState, error: error instanceof Error ? error.message : String(error) }) }
    },
    setModel: async (model) => {
      if (sameModel(model, stateRef.current.model) && !stateRef.current.pendingModel) return
      if (stateRef.current.runActive) return
      dispatch({ type: 'pendingModel', model })
      try {
        const session = await ensureSession()
        const result = await api.changeModel(session.id, model, stateRef.current.settingsRevision ?? undefined)
        dispatch({ type: 'model', model, revision: result.revision, session: result.session })
      } catch (error) {
        dispatch({ type: 'pendingModel', model: null })
        dispatch({ type: 'connection', state: stateRef.current.connectionState, error: error instanceof Error ? error.message : String(error) })
      }
    },
    send: async (content) => { const session = await ensureSession(content.slice(0, 48)); await api.sendMessage(session.id, content, stateRef.current.runActive ? 'follow_up' : 'prompt') },
    setOpen: (open) => dispatch({ type: 'open', open }),
    setDetailOpen: (open) => dispatch({ type: 'detail', open }),
    setContext: (context) => {
      const merged = { ...stateRef.current.context, ...context }
      dispatch({ type: 'context', context })
      const session = stateRef.current.sessions.find((item) => item.id === stateRef.current.activeSessionId)
      if (session && session.id !== demoSession.id) {
        void api.changeContext(session.id, merged).catch((error) => dispatch({ type: 'connection', state: stateRef.current.connectionState, error: error instanceof Error ? error.message : String(error) }))
      }
    },
    openShell: (sessionId) => {
      window.dispatchEvent(new CustomEvent('pipyter:open-shell', { detail: { sessionId } }))
      if (window.location.hash !== '#/workspace') window.location.hash = '#/workspace'
    },
    refresh,
  }), [api, connect, ensureSession, refresh])
  return <Context.Provider value={{ state, actions }}>{children}</Context.Provider>
}
export function usePigent() { const value = useContext(Context); if (!value) throw new Error('usePigent must be used within PigentProvider'); return value }
export const effectiveTools = (state: PigentState): readonly string[] => state.capabilities?.modes[state.mode] ?? PIGENT_CATALOGS[state.mode]
export const currentTasks = (state: PigentState) => state.tasksSnapshot ?? (state.connectionState === 'demo' ? demoTasks : null)
