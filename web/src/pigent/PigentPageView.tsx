import { AlertCircle, MessageSquareText, Orbit } from 'lucide-react'
import { useMemo } from 'react'
import { Composer } from './components/Composer'
import { ContextChips } from './components/ContextChips'
import { DetailPanel } from './components/DetailPanel'
import { InteractionCard } from './components/InteractionCard'
import { PigentHeader } from './components/PigentHeader'
import { SessionList } from './components/SessionList'
import { TaskCard } from './components/TaskCard'
import { ToolActivityCard } from './components/ToolActivityCard'
import { coalescePigentEvents } from './feed'
import { currentTasks, effectiveTools, usePigent } from './store'
import type { PigentEvent, PigentInteraction } from './types'

function EventView({ event, onOpenShell, reviewBeforeApply }: { event: PigentEvent; onOpenShell(id?: string): void; reviewBeforeApply: boolean }) {
  if (event.type === 'tasks.snapshot' || event.type === 'session.created' || event.type === 'session.updated' || event.type === 'mode.changed' || event.type === 'context.updated' || event.type === 'reconnect.cursor') return null
  if (event.type === 'interaction.required') return <InteractionCard interaction={(event.payload?.interaction ?? event.payload) as unknown as PigentInteraction} onOpenShell={onOpenShell} />
  if (event.type === 'assistant.text' || event.type === 'assistant.thinking' || event.type === 'settled') {
    const text = String(event.payload?.text ?? event.payload?.summary ?? '')
    if (!text) return null
    return <article className="pigent-assistant-event"><Orbit size={16} /><div><strong>{event.type === 'settled' ? 'Final summary' : 'Pigent'}</strong><p>{text}</p></div></article>
  }
  if (event.type === 'error' || event.type === 'aborted') return <article className="pigent-error-event"><AlertCircle size={16} /><span>{String(event.payload?.message ?? event.type)}</span></article>
  return <ToolActivityCard event={event} reviewBeforeApply={reviewBeforeApply} />
}

export function PigentPageView() {
  const { state, actions } = usePigent()
  const session = state.sessions.find((item) => item.id === state.activeSessionId)
  const events = useMemo(() => coalescePigentEvents(Object.values(state.eventsById).sort((a, b) => a.event_id - b.event_id)).slice(-300), [state.eventsById])
  const tasks = currentTasks(state)
  return <div className={`pigent-page${state.detailOpen ? ' has-detail' : ''}`}>
    <SessionList sessions={state.sessions} activeId={state.activeSessionId} runActive={state.runActive} onSelect={actions.selectSession} />
    <main className="pigent-main-column">
      <PigentHeader session={session} runActive={state.runActive} detailOpen={state.detailOpen} onDetail={() => actions.setDetailOpen(!state.detailOpen)} />
      <div className="pigent-feed-scroll"><div className="pigent-feed">
        <div className="pigent-feed-intro"><div><h1>{session?.title || '开始一个 Pigent 会话'}</h1><span className="pigent-connection">{state.connectionState}</span></div><ContextChips context={{ workspace: session?.workspace_id, ...state.context }} /></div>
        {tasks && <TaskCard snapshot={tasks} />}
        {events.length === 0 && <div className="pigent-empty"><MessageSquareText size={22} /><p>在下方输入问题或任务。Ask 与 Plan 不会执行修改，Auto 使用当前 Runtime 用户身份执行。</p></div>}
        {events.map((event) => <EventView key={event.event_id} event={event} reviewBeforeApply={session?.approval_preference === 'review_all'} onOpenShell={(id) => actions.openShell(id)} />)}
        {state.error && <div className="pigent-inline-error">{state.error}</div>}
      </div></div>
      <div className="pigent-composer-wrap"><Composer running={state.runActive} mode={state.mode} pendingMode={state.pendingMode} onMode={(mode) => void actions.setMode(mode)} model={state.model} pendingModel={state.pendingModel} onModel={(model) => void actions.setModel(model)} onSend={actions.send} /></div>
    </main>
    {state.detailOpen && <DetailPanel session={session} context={{ workspace: session?.workspace_id, ...state.context }} mode={state.mode} tools={effectiveTools(state)} />}
  </div>
}
