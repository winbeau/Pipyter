import { Orbit } from 'lucide-react'
import { useMemo } from 'react'
import { Composer } from './components/Composer'
import { ContextChips } from './components/ContextChips'
import { InteractionCard } from './components/InteractionCard'
import { PigentHeader } from './components/PigentHeader'
import { TaskCard } from './components/TaskCard'
import { ToolActivityCard } from './components/ToolActivityCard'
import { coalescePigentEvents } from './feed'
import { currentTasks, usePigent } from './store'
import type { PigentEvent, PigentInteraction } from './types'

function CompactEvent({ event, reviewBeforeApply, onOpenShell }: { event: PigentEvent; reviewBeforeApply: boolean; onOpenShell(id?: string): void }) {
  if (event.type === 'interaction.required') return <InteractionCard density="compact" interaction={(event.payload?.interaction ?? event.payload) as unknown as PigentInteraction} onOpenShell={onOpenShell} />
  if (event.type === 'assistant.text' || event.type === 'assistant.thinking' || event.type === 'settled') {
    const text = String(event.payload?.text ?? event.payload?.summary ?? '')
    if (!text) return null
    return <article className="pigent-assistant-event is-compact"><Orbit size={14} /><div><strong>{event.type === 'settled' ? 'Final summary' : 'Pigent'}</strong><p>{text}</p></div></article>
  }
  if (['tool.start','tool.update','tool.end','delegate.start','delegate.update','delegate.end','kernel.updated','artifact.created','error','aborted'].includes(event.type)) return <ToolActivityCard density="compact" event={event} reviewBeforeApply={reviewBeforeApply} />
  return null
}

export function PigentWorkspacePanel({ onClose }: { onClose(): void }) {
  const { state, actions } = usePigent(); const session = state.sessions.find((item) => item.id === state.activeSessionId)
  const events = useMemo(() => coalescePigentEvents(Object.values(state.eventsById).sort((a, b) => a.event_id - b.event_id)).slice(-100), [state.eventsById]); const tasks = currentTasks(state)
  return <aside className="ws-pigent-panel">
    <PigentHeader compact session={session} runActive={state.runActive} onClose={onClose} />
    <ContextChips compact context={{ workspace: session?.workspace_id, ...state.context }} />
    <div className="ws-pigent-feed">{tasks && <TaskCard snapshot={tasks} density="compact" />}
      {events.map((event) => <CompactEvent key={event.event_id} event={event} reviewBeforeApply={session?.approval_preference === 'review_all'} onOpenShell={(id) => actions.openShell(id)} />)}
      {!tasks && events.length === 0 && <div className="pigent-empty-compact">Pigent 活动会显示在这里。</div>}
    </div>
    <div className="ws-pigent-composer"><Composer compact running={state.runActive} mode={state.mode} pendingMode={state.pendingMode} onMode={(mode) => void actions.setMode(mode)} model={state.model} pendingModel={state.pendingModel} onModel={(model) => void actions.setModel(model)} onSend={actions.send} /></div>
  </aside>
}
