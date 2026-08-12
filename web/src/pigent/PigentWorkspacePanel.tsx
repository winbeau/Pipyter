import { useMemo } from 'react'
import { Composer } from './components/Composer'
import { ContextChips } from './components/ContextChips'
import { FeedItemView } from './components/FeedItems'
import { PigentHeader } from './components/PigentHeader'
import { TaskCard } from './components/TaskCard'
import { projectFeed } from './feed'
import { currentTasks, usePigent } from './store'

export function PigentWorkspacePanel({ onClose }: { onClose(): void }) {
  const { state, actions } = usePigent()
  const session = state.sessions.find((item) => item.id === state.activeSessionId)
  const items = useMemo(() => projectFeed(Object.values(state.eventsById).sort((a, b) => Number(a.event_id) - Number(b.event_id)), state.userMessages).slice(-150), [state.eventsById, state.userMessages])
  const tasks = currentTasks(state)
  return <aside className="ws-pigent-panel"><PigentHeader compact session={session} runActive={state.runActive} stopping={state.stopping} onStop={actions.stop} onClose={onClose} /><ContextChips compact context={{ workspace: session?.workspace_id, ...state.context }} /><div className="ws-pigent-feed">{tasks && <TaskCard snapshot={tasks} density="compact" />}{items.map((item) => <FeedItemView compact key={item.id} item={item} onRetry={(message) => void actions.retry(message)} onOpenShell={actions.openShell} onResolve={actions.resolveInteraction} artifactUrl={actions.artifactUrl} />)}{!tasks && items.length === 0 && <div className="pigent-empty-compact">Pigent 活动会显示在这里。</div>}</div><div className="ws-pigent-composer"><Composer compact running={state.runActive} stopping={state.stopping} disabled={state.connectionState === 'disconnected' || !(state.capabilities?.tools.length ?? 0)} mode={state.mode} pendingMode={state.pendingMode} onMode={(mode) => void actions.setMode(mode)} model={state.model} modelChoices={state.modelChoices} pendingModel={state.pendingModel} onRefreshModels={actions.refreshCapabilities} onModel={(model) => void actions.setModel(model)} onSend={actions.send} onStop={actions.stop} /></div></aside>
}
