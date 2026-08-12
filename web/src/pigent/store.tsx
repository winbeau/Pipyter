import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react'
import { PIGENT_CATALOGS } from '../../../packages/protocol/src/pigent'
import { createPigentApi, parsePigentEvent } from './api'
import { demoEvents, demoSession, demoTasks } from './demo'
import { prependHistory } from './feed'
import { DEFAULT_PIGENT_MODEL, modelChoice, sameModel, type PigentModelChoice, type PigentModelSelection } from './models'
import type { OptimisticUserMessage, PigentCapabilities, PigentConnectionState, PigentContext, PigentEvent, PigentInteraction, PigentMode, PigentSession, TasksSnapshot } from './types'

const STORAGE_PREFIX = 'pipyter.pigent.v2'
type Persisted = { pigentOpen?: boolean; pigentMode?: PigentMode; activePigentSessionId?: string; pigentDetailOpen?: boolean }
function storageKey(runtimeKey: string) { return `${STORAGE_PREFIX}:${runtimeKey}` }
function load(runtimeKey: string): Persisted { try { return JSON.parse(localStorage.getItem(storageKey(runtimeKey)) || '{}') as Persisted } catch { return {} } }
function clientId(prefix: string) { return `${prefix}_${crypto.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(16).slice(2)}`}` }

export type PigentState = {
  sessions: PigentSession[]
  activeSessionId: string | null
  mode: PigentMode
  pendingMode: PigentMode | null
  model: PigentModelSelection
  modelChoices: PigentModelChoice[]
  pendingModel: PigentModelSelection | null
  settingsRevision: string | null
  status: PigentSession['status'] | 'idle'
  runActive: boolean
  runId: string | null
  turnId: string | null
  stopping: boolean
  tasksSnapshot: TasksSnapshot | null
  eventsById: Record<number, PigentEvent>
  userMessages: OptimisticUserMessage[]
  pendingInteractions: PigentInteraction[]
  resolvedInteractions: Record<string, Record<string, unknown>>
  resolvingInteractionId: string | null
  context: PigentContext
  lastEventId: number
  historyHasMore: boolean
  historyLoading: boolean
  open: boolean
  detailOpen: boolean
  connectionState: PigentConnectionState
  capabilities: PigentCapabilities | null
  error: string | null
  sessionQuery: string
  sessionsHasMore: boolean
  sessionsLoading: boolean
}

export function createInitialState(runtimeKey: string): PigentState {
  const saved = typeof window === 'undefined' ? {} : load(runtimeKey)
  return { sessions: [], activeSessionId: saved.activePigentSessionId ?? null, mode: saved.pigentMode ?? 'ask', pendingMode: null,
    model: DEFAULT_PIGENT_MODEL, modelChoices: [], pendingModel: null, settingsRevision: null, status: 'idle', runActive: false,
    runId: null, turnId: null, stopping: false, tasksSnapshot: null, eventsById: {}, userMessages: [], pendingInteractions: [],
    resolvedInteractions: {}, resolvingInteractionId: null, context: {}, lastEventId: 0, historyHasMore: false, historyLoading: false,
    open: saved.pigentOpen ?? false, detailOpen: saved.pigentDetailOpen ?? false, connectionState: 'connecting', capabilities: null,
    error: null, sessionQuery: '', sessionsHasMore: false, sessionsLoading: false }
}

type Action =
  | { type: 'sessions'; sessions: PigentSession[]; demo?: boolean; append?: boolean; hasMore?: boolean }
  | { type: 'active'; session: PigentSession; preserveCursor: boolean }
  | { type: 'pendingMode'; mode: PigentMode | null }
  | { type: 'pendingModel'; model: PigentModelSelection | null }
  | { type: 'model'; model: PigentModelSelection; revision?: string; session?: PigentSession }
  | { type: 'event'; event: PigentEvent }
  | { type: 'eventsPrepend'; events: PigentEvent[]; hasMore: boolean }
  | { type: 'historyLoading'; loading: boolean }
  | { type: 'user'; message: OptimisticUserMessage }
  | { type: 'userUpdate'; id: string; changes: Partial<OptimisticUserMessage> }
  | { type: 'runAccepted'; runId: string; turnId: string }
  | { type: 'clearActive' }
  | { type: 'stopping'; value: boolean }
  | { type: 'interactionPending'; id: string | null }
  | { type: 'interactionResolved'; id: string; receipt: Record<string, unknown> }
  | { type: 'connection'; state: PigentConnectionState; error?: string | null }
  | { type: 'capabilities'; capabilities: PigentCapabilities }
  | { type: 'open'; open: boolean }
  | { type: 'detail'; open: boolean }
  | { type: 'context'; context: PigentContext }
  | { type: 'query'; value: string }
  | { type: 'sessionsLoading'; loading: boolean }

function interactionFrom(event: PigentEvent): PigentInteraction | null {
  if (event.type !== 'interaction.required') return null
  const value = (event.payload?.interaction ?? event.payload) as unknown
  return value && typeof value === 'object' ? value as PigentInteraction : null
}
function isSessionStatus(value: unknown): value is PigentSession['status'] { return value === 'active' || value === 'completed' || value === 'failed' || value === 'interrupted' || value === 'waiting_for_user' }

export function pigentReducer(state: PigentState, action: Action): PigentState {
  switch (action.type) {
    case 'sessions': return { ...state, sessions: action.append ? [...state.sessions, ...action.sessions.filter((item) => !state.sessions.some((existing) => existing.id === item.id))] : action.sessions, sessionsHasMore: action.hasMore ?? state.sessionsHasMore, sessionsLoading: false, connectionState: action.demo ? 'demo' : state.connectionState }
    case 'active': { const activeRun = action.session.status === 'active' || action.session.status === 'waiting_for_user'; return { ...state, activeSessionId: action.session.id, mode: action.session.mode, pendingMode: null,
      model: modelChoice(action.session.model, state.modelChoices) ?? state.model, pendingModel: null, status: action.session.status,
      runActive: activeRun, runId: (action.session as PigentSession & { run_id?: string }).run_id ?? null,
      turnId: (action.session as PigentSession & { turn_id?: string }).turn_id ?? null, stopping: false,
      tasksSnapshot: action.session.tasks_snapshot ?? null, eventsById: action.preserveCursor ? state.eventsById : {},
      userMessages: action.preserveCursor ? state.userMessages : [], pendingInteractions: action.preserveCursor ? state.pendingInteractions : [],
      resolvedInteractions: action.preserveCursor ? state.resolvedInteractions : {}, lastEventId: action.preserveCursor ? state.lastEventId : 0,
      historyHasMore: true } }
    case 'pendingMode': return { ...state, pendingMode: action.mode }
    case 'pendingModel': return { ...state, pendingModel: action.model }
    case 'model': return { ...state, sessions: action.session ? state.sessions.map((item) => item.id === action.session?.id ? action.session : item) : state.sessions,
      model: action.model, pendingModel: null, settingsRevision: action.revision ?? state.settingsRevision }
    case 'connection': return { ...state, connectionState: action.state, error: action.error ?? null }
    case 'capabilities': { const choices = action.capabilities.models ?? []; return { ...state, capabilities: action.capabilities, modelChoices: choices,
      model: modelChoice(action.capabilities.model, choices) ?? state.model, settingsRevision: action.capabilities.settings_revision ?? state.settingsRevision } }
    case 'open': return { ...state, open: action.open }
    case 'detail': return { ...state, detailOpen: action.open }
    case 'context': return { ...state, context: { ...state.context, ...action.context } }
    case 'query': return { ...state, sessionQuery: action.value }
    case 'sessionsLoading': return { ...state, sessionsLoading: action.loading }
    case 'historyLoading': return { ...state, historyLoading: action.loading }
    case 'eventsPrepend': return { ...state, eventsById: prependHistory(state.eventsById, action.events), historyHasMore: action.hasMore, historyLoading: false }
    case 'user': return { ...state, userMessages: [...state.userMessages, action.message] }
    case 'userUpdate': return { ...state, userMessages: state.userMessages.map((item) => item.clientMessageId === action.id ? { ...item, ...action.changes } : item) }
    case 'runAccepted': return { ...state, runActive: true, status: 'active', runId: action.runId, turnId: action.turnId }
    case 'clearActive': return { ...state, activeSessionId: null, status: 'idle', runActive: false, runId: null, turnId: null, stopping: false, tasksSnapshot: null, eventsById: {}, userMessages: [], pendingInteractions: [], resolvedInteractions: {}, lastEventId: 0, historyHasMore: false }
    case 'stopping': return { ...state, stopping: action.value }
    case 'interactionPending': return { ...state, resolvingInteractionId: action.id }
    case 'interactionResolved': return { ...state, resolvingInteractionId: null,
      resolvedInteractions: { ...state.resolvedInteractions, [action.id]: action.receipt },
      pendingInteractions: state.pendingInteractions.filter((item) => item.interaction_id !== action.id) }
    case 'event': {
      const event = action.event
      if (event.type === 'reconnect.cursor') {
        const session = event.payload?.session as PigentSession | undefined
        const tasks = (event.payload?.tasks as TasksSnapshot | null) ?? state.tasksSnapshot
        const sessions = session ? (state.sessions.some((item) => item.id === session.id) ? state.sessions.map((item) => item.id === session.id ? session : item) : [session, ...state.sessions]) : state.sessions
        return { ...state, sessions, activeSessionId: session?.id ?? state.activeSessionId, mode: session?.mode ?? state.mode,
          model: modelChoice(session?.model, state.modelChoices) ?? state.model, status: session?.status ?? state.status,
          runActive: Boolean(event.payload?.run_active), tasksSnapshot: tasks,
          runId: typeof event.payload?.run_id === 'string' ? event.payload.run_id : state.runId,
          turnId: typeof event.payload?.turn_id === 'string' ? event.payload.turn_id : state.turnId,
          settingsRevision: typeof event.payload?.settings_revision === 'string' ? event.payload.settings_revision : state.settingsRevision }
      }
      if (typeof event.event_id !== 'number' || event.event_id <= state.lastEventId) return state
      let mode = state.mode, pendingMode = state.pendingMode, model = state.model, pendingModel = state.pendingModel
      let status = state.status, runActive = state.runActive, tasks = state.tasksSnapshot, settingsRevision = state.settingsRevision
      let stopping = state.stopping
      const updatedSession = event.type === 'session.updated' && event.payload?.session ? event.payload.session as unknown as PigentSession : null
      if (updatedSession) { mode = updatedSession.mode; status = updatedSession.status; tasks = updatedSession.tasks_snapshot ?? tasks; const next = modelChoice(updatedSession.model, state.modelChoices); if (next) { model = next; if (sameModel(next, pendingModel)) pendingModel = null } }
      if (typeof event.payload?.settings_revision === 'string') settingsRevision = event.payload.settings_revision
      if (typeof event.payload?.run_active === 'boolean') runActive = event.payload.run_active
      if (event.type === 'mode.changed' && typeof event.payload?.mode === 'string') { mode = event.payload.mode as PigentMode; pendingMode = null }
      if (event.type === 'tasks.snapshot') tasks = (event.payload?.snapshot ?? event.payload) as unknown as TasksSnapshot
      if (['assistant.text','assistant.thinking','tool.start','tool.update','tool.end','delegate.start','delegate.update','delegate.end','operation.started','operation.updated'].includes(event.type)) { status = 'active'; runActive = true }
      const terminal = event.type === 'settled' || event.type === 'aborted' || event.type === 'error'
      if (event.type === 'settled') { status = isSessionStatus(event.payload?.status) ? event.payload.status : 'completed'; runActive = false; stopping = false }
      if (event.type === 'aborted') { status = 'interrupted'; runActive = false; stopping = false }
      if (event.type === 'error') { status = 'failed'; runActive = false; stopping = false }
      if (event.type === 'interaction.required') { status = 'waiting_for_user'; runActive = true }
      if (event.type === 'interaction.resolved') { status = 'active'; runActive = true }
      const interaction = interactionFrom(event)
      const pendingInteractions = interaction ? [...state.pendingInteractions.filter((item) => item.interaction_id !== interaction.interaction_id), interaction] : event.type === 'interaction.resolved' ? state.pendingInteractions.filter((item) => item.interaction_id !== event.payload?.interaction_id) : state.pendingInteractions
      const sessions = state.sessions.map((item) => item.id === event.session_id ? (updatedSession ?? { ...item, mode, status: status === 'idle' ? item.status : status, tasks_snapshot: tasks ?? undefined, last_activity_at: event.timestamp }) : item)
      const eventRunId = typeof event.payload?.run_id === 'string' ? event.payload.run_id : state.runId
      const userMessages = state.userMessages.map((item) => item.runId && item.runId === eventRunId ? { ...item, state: terminal ? 'settled' as const : item.state === 'accepted' ? 'running' as const : item.state } : item)
      return { ...state, sessions, mode, pendingMode, model, pendingModel, settingsRevision, status, runActive, stopping, tasksSnapshot: tasks,
        eventsById: { ...state.eventsById, [event.event_id]: event }, pendingInteractions, userMessages, lastEventId: event.event_id,
        runId: typeof event.payload?.run_id === 'string' ? event.payload.run_id : state.runId,
        turnId: typeof event.payload?.turn_id === 'string' ? event.payload.turn_id : state.turnId }
    }
  }
}

export type PigentActions = {
  selectSession(id: string): void
  ensureSession(title?: string): Promise<PigentSession>
  newSession(): Promise<void>
  renameSession(id: string, title: string): Promise<void>
  deleteSession(id: string): Promise<void>
  setSessionQuery(value: string): void
  loadMoreSessions(): Promise<void>
  loadEarlier(): Promise<void>
  setMode(mode: PigentMode): Promise<void>
  setModel(model: PigentModelChoice): Promise<void>
  send(content: string, retryId?: string): Promise<void>
  retry(message: OptimisticUserMessage): Promise<void>
  stop(): Promise<void>
  resolveInteraction(interactionId: string, revision: number, actionId: string): Promise<void>
  setOpen(open: boolean): void
  setDetailOpen(open: boolean): void
  setContext(context: PigentContext): void
  openShell(sessionId?: string): void
  artifactUrl(id: string, download?: boolean): string
  refresh(): Promise<void>
}
const Context = createContext<{ state: PigentState; actions: PigentActions } | null>(null)

export function PigentProvider({ children, apiBase = '', runtimeKey = 'local:current', allowDemo = false }: { children: ReactNode; apiBase?: string; runtimeKey?: string; allowDemo?: boolean }) {
  const [state, dispatch] = useReducer(pigentReducer, undefined, () => createInitialState(runtimeKey))
  const api = useMemo(() => createPigentApi(apiBase), [apiBase]); const stateRef = useRef(state); stateRef.current = state
  const socketRef = useRef<WebSocket | null>(null); const reconnectTimer = useRef<number | null>(null); const reconnectAttempts = useRef(0)
  const searchSequence = useRef(0); const decisionIds = useRef<Record<string, string>>({}); const activeSessionRef = useRef<PigentSession | null>(null)
  const connect = useCallback((session: PigentSession, preserveCursor: boolean) => {
    socketRef.current?.close(); if (reconnectTimer.current) window.clearTimeout(reconnectTimer.current)
    activeSessionRef.current = session; dispatch({ type: 'active', session, preserveCursor }); if (session.id === demoSession.id) return
    const after = preserveCursor ? stateRef.current.lastEventId : 0; dispatch({ type: 'connection', state: 'connecting' })
    const socket = new WebSocket(api.streamUrl(session.id, after)); socketRef.current = socket
    socket.onopen = () => { reconnectAttempts.current = 0; dispatch({ type: 'connection', state: 'connected' }) }
    socket.onmessage = (message) => { const event = parsePigentEvent(String(message.data)); if (event) dispatch({ type: 'event', event }) }
    socket.onerror = () => dispatch({ type: 'connection', state: 'disconnected', error: 'Pigent event stream disconnected' })
    socket.onclose = () => { if (socketRef.current !== socket) return; dispatch({ type: 'connection', state: 'disconnected' }); const delay = Math.min(10000, 500 * 2 ** reconnectAttempts.current++); reconnectTimer.current = window.setTimeout(() => connect(session, true), delay) }
  }, [api])
  const refresh = useCallback(async () => {
    try { const [sessions, capabilities] = await Promise.all([api.listSessions({ workspaceId: stateRef.current.context.workspace, query: stateRef.current.sessionQuery, limit: 50 }), api.capabilities()]); dispatch({ type: 'sessions', sessions, hasMore: sessions.length === 50 }); dispatch({ type: 'capabilities', capabilities }); const selected = sessions.find((item) => item.id === stateRef.current.activeSessionId) ?? sessions[0]; if (selected) connect(selected, selected.id === stateRef.current.activeSessionId && Object.keys(stateRef.current.eventsById).length > 0); else { dispatch({ type: 'clearActive' }); dispatch({ type: 'connection', state: 'connected' }) } }
    catch (error) { const message = error instanceof Error ? error.message : String(error); if (allowDemo) { activeSessionRef.current = demoSession; dispatch({ type: 'sessions', sessions: [demoSession], demo: true }); dispatch({ type: 'active', session: demoSession, preserveCursor: false }); for (const event of demoEvents) dispatch({ type: 'event', event }); dispatch({ type: 'connection', state: 'demo', error: message }) } else { dispatch({ type: 'sessions', sessions: [] }); dispatch({ type: 'connection', state: 'disconnected', error: message }) } }
  }, [allowDemo, api, connect])
  useEffect(() => { void refresh(); return () => { socketRef.current?.close(); if (reconnectTimer.current) window.clearTimeout(reconnectTimer.current) } }, [refresh])
  useEffect(() => { const payload: Persisted = { pigentOpen: state.open, pigentMode: state.mode, activePigentSessionId: state.activeSessionId ?? undefined, pigentDetailOpen: state.detailOpen }; localStorage.setItem(storageKey(runtimeKey), JSON.stringify(payload)) }, [runtimeKey, state.open, state.mode, state.activeSessionId, state.detailOpen])
  const ensureSession = useCallback(async (title?: string) => { const current = activeSessionRef.current ?? stateRef.current.sessions.find((item) => item.id === stateRef.current.activeSessionId); if (current && current.id !== demoSession.id) return current; let session = await api.createSession(stateRef.current.mode, title); dispatch({ type: 'sessions', sessions: [session, ...stateRef.current.sessions.filter((item) => item.id !== demoSession.id)] }); connect(session, false); if (stateRef.current.context.activeDocument || stateRef.current.context.activeKernel) session = await api.changeContext(session.id, stateRef.current.context); activeSessionRef.current = session; return session }, [api, connect])
  const send = useCallback(async (content: string, retryId?: string) => { const behavior = stateRef.current.runActive ? 'follow_up' : 'prompt'; const id = retryId ?? clientId('msg_client'); if (!retryId) dispatch({ type: 'user', message: { clientMessageId: id, content, behavior, state: 'pending', createdAt: new Date().toISOString() } }); else dispatch({ type: 'userUpdate', id, changes: { state: 'retrying', error: undefined } }); try { const session = await ensureSession(content.slice(0, 48)); const accepted = await api.sendMessage(session.id, id, content, behavior); dispatch({ type: 'userUpdate', id, changes: { state: 'accepted', runId: accepted.run_id, turnId: accepted.turn_id } }); dispatch({ type: 'runAccepted', runId: accepted.run_id, turnId: accepted.turn_id }) } catch (error) { dispatch({ type: 'userUpdate', id, changes: { state: 'failed', error: error instanceof Error ? error.message : String(error) } }); throw error } }, [api, ensureSession])
  const actions = useMemo<PigentActions>(() => ({
    selectSession: (id) => { const session = stateRef.current.sessions.find((item) => item.id === id); if (session) connect(session, id === stateRef.current.activeSessionId) },
    ensureSession, newSession: async () => { const session = await api.createSession(stateRef.current.mode); dispatch({ type: 'sessions', sessions: [session, ...stateRef.current.sessions] }); connect(session, false) },
    renameSession: async (id, title) => { const session = await api.renameSession(id, title); dispatch({ type: 'sessions', sessions: stateRef.current.sessions.map((item) => item.id === id ? session : item) }) },
    deleteSession: async (id) => { try { await api.deleteSession(id); const sessions = stateRef.current.sessions.filter((item) => item.id !== id); dispatch({ type: 'sessions', sessions }); if (id === stateRef.current.activeSessionId) { if (sessions[0]) connect(sessions[0], false); else { socketRef.current?.close(); socketRef.current = null; activeSessionRef.current = null; dispatch({ type: 'clearActive' }) } } } catch (error) { dispatch({ type: 'connection', state: stateRef.current.connectionState, error: error instanceof Error ? error.message : String(error) }); throw error } },
    setSessionQuery: (value) => { dispatch({ type: 'query', value }); const sequence = ++searchSequence.current; void api.listSessions({ workspaceId: stateRef.current.context.workspace, query: value, limit: 50 }).then((sessions) => { if (sequence === searchSequence.current) dispatch({ type: 'sessions', sessions, hasMore: sessions.length === 50 }) }).catch((error) => { if (sequence === searchSequence.current) dispatch({ type: 'connection', state: stateRef.current.connectionState, error: error instanceof Error ? error.message : String(error) }) }) },
    loadMoreSessions: async () => { if (stateRef.current.sessionsLoading || !stateRef.current.sessionsHasMore) return; const before = stateRef.current.sessions.at(-1)?.last_activity_at; if (!before) return; dispatch({ type: 'sessionsLoading', loading: true }); try { const sessions = await api.listSessions({ workspaceId: stateRef.current.context.workspace, query: stateRef.current.sessionQuery, before, limit: 50 }); dispatch({ type: 'sessions', sessions, append: true, hasMore: sessions.length === 50 }) } catch (error) { dispatch({ type: 'sessionsLoading', loading: false }); dispatch({ type: 'connection', state: stateRef.current.connectionState, error: error instanceof Error ? error.message : String(error) }) } },
    loadEarlier: async () => { if (stateRef.current.historyLoading || !stateRef.current.activeSessionId) return; const ids = Object.keys(stateRef.current.eventsById).map(Number); dispatch({ type: 'historyLoading', loading: true }); try { const page = await api.history(stateRef.current.activeSessionId, ids.length ? Math.min(...ids) : undefined, 100); dispatch({ type: 'eventsPrepend', events: page.events, hasMore: page.has_more }) } catch { dispatch({ type: 'historyLoading', loading: false }) } },
    setMode: async (mode) => { if (mode === stateRef.current.mode && !stateRef.current.pendingMode) return; dispatch({ type: 'pendingMode', mode }); try { const session = await ensureSession(); await api.changeMode(session.id, mode) } catch (error) { dispatch({ type: 'pendingMode', mode: null }); throw error } },
    setModel: async (model) => { if (sameModel(model, stateRef.current.model) || stateRef.current.runActive || model.configured === false) return; dispatch({ type: 'pendingModel', model }); try { const session = await ensureSession(); const result = await api.changeModel(session.id, model, stateRef.current.settingsRevision ?? undefined); dispatch({ type: 'model', model, revision: result.revision, session: result.session }) } catch (error) { dispatch({ type: 'pendingModel', model: null }); throw error } },
    send, retry: (message) => send(message.content, message.clientMessageId), stop: async () => { const session = stateRef.current.sessions.find((item) => item.id === stateRef.current.activeSessionId); if (!session || stateRef.current.stopping) return; dispatch({ type: 'stopping', value: true }); try { const result = await api.abort(session.id, stateRef.current.runId ?? undefined); if (result.already_settled) dispatch({ type: 'stopping', value: false }) } catch (error) { dispatch({ type: 'stopping', value: false }); throw error } },
    resolveInteraction: async (interactionId, revision, actionId) => { dispatch({ type: 'interactionPending', id: interactionId }); const decisionId = decisionIds.current[interactionId] ??= clientId('decision'); try { const result = await api.resolveInteraction(interactionId, revision, decisionId, actionId); delete decisionIds.current[interactionId]; dispatch({ type: 'interactionResolved', id: interactionId, receipt: result.receipt }) } catch (error) { dispatch({ type: 'interactionPending', id: null }); throw error } },
    setOpen: (open) => dispatch({ type: 'open', open }), setDetailOpen: (open) => dispatch({ type: 'detail', open }), setContext: (context) => { const merged = { ...stateRef.current.context, ...context }; dispatch({ type: 'context', context }); const session = activeSessionRef.current ?? stateRef.current.sessions.find((item) => item.id === stateRef.current.activeSessionId); if (session && session.id !== demoSession.id) void api.changeContext(session.id, merged) },
    openShell: (sessionId) => { window.dispatchEvent(new CustomEvent('pipyter:open-shell', { detail: { sessionId } })); if (window.location.hash !== '#/workspace') window.location.hash = '#/workspace' }, artifactUrl: api.artifactUrl, refresh,
  }), [api, connect, ensureSession, refresh, send])
  return <Context.Provider value={{ state, actions }}>{children}</Context.Provider>
}
export function usePigent() { const value = useContext(Context); if (!value) throw new Error('usePigent must be used within PigentProvider'); return value }
export const effectiveTools = (state: PigentState): readonly string[] => state.capabilities?.modes[state.mode] ?? PIGENT_CATALOGS[state.mode]
export const currentTasks = (state: PigentState) => state.tasksSnapshot ?? (state.connectionState === 'demo' ? demoTasks : null)
