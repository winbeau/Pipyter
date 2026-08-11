import { useMemo } from 'react'
import { Composer } from './components/Composer'
import { ContextChips } from './components/ContextChips'
import { InteractionCard } from './components/InteractionCard'
import { PigentHeader } from './components/PigentHeader'
import { TaskCard } from './components/TaskCard'
import { ToolActivityCard } from './components/ToolActivityCard'
import { currentTasks, usePigent } from './store'
import type { PigentInteraction } from './types'

export function PigentWorkspacePanel({ onClose }: { onClose(): void }) {
  const { state, actions } = usePigent(); const session = state.sessions.find((item) => item.id === state.activeSessionId)
  const events = useMemo(() => Object.values(state.eventsById).sort((a, b) => a.event_id - b.event_id).slice(-100), [state.eventsById]); const tasks = currentTasks(state)
  return <aside className="ws-pigent-panel">
    <PigentHeader compact session={session} mode={state.mode} pendingMode={state.pendingMode} onMode={(mode) => void actions.setMode(mode)} runActive={state.runActive} onClose={onClose} />
    <ContextChips compact context={{ workspace: session?.workspace_id, ...state.context }} />
    <div className="ws-pigent-feed">{tasks && <TaskCard snapshot={tasks} density="compact" />}
      {events.map((event) => event.type === 'interaction.required'
        ? <InteractionCard key={event.event_id} density="compact" interaction={(event.payload?.interaction ?? event.payload) as unknown as PigentInteraction} onOpenShell={(id) => actions.openShell(id)} />
        : ['tool.start','tool.update','tool.end','delegate.start','delegate.update','delegate.end','kernel.updated','artifact.created','error','aborted'].includes(event.type)
          ? <ToolActivityCard key={event.event_id} density="compact" event={event} reviewBeforeApply={session?.approval_preference === 'review_all'} /> : null)}
      {!tasks && events.length === 0 && <div className="pigent-empty-compact">Pigent 活动会显示在这里。</div>}
    </div>
    <div className="ws-pigent-composer"><Composer compact running={state.runActive} onSend={actions.send} /></div>
  </aside>
}
