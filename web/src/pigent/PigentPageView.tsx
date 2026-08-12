import { ArrowDown, MessageSquareText } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Composer } from './components/Composer'
import { ContextChips } from './components/ContextChips'
import { DetailPanel } from './components/DetailPanel'
import { FeedItemView } from './components/FeedItems'
import { PigentHeader } from './components/PigentHeader'
import { SessionList } from './components/SessionList'
import { TaskCard } from './components/TaskCard'
import { projectFeed } from './feed'
import { currentTasks, effectiveTools, usePigent } from './store'

export function PigentPageView() {
  const { state, actions } = usePigent()
  const session = state.sessions.find((item) => item.id === state.activeSessionId)
  const events = useMemo(() => Object.values(state.eventsById).sort((a, b) => Number(a.event_id) - Number(b.event_id)), [state.eventsById])
  const items = useMemo(() => projectFeed(events, state.userMessages), [events, state.userMessages])
  const visibleItems = items.slice(-500)
  const tasks = currentTasks(state)
  const scroll = useRef<HTMLDivElement>(null)
  const [following, setFollowing] = useState(true)
  const [newActivity, setNewActivity] = useState(false)
  const [sessionsOpen, setSessionsOpen] = useState(false)
  useEffect(() => { if (following) { scroll.current?.scrollTo({ top: scroll.current.scrollHeight }); setNewActivity(false) } else if (items.length) setNewActivity(true) }, [following, items.length])
  return <div className={`pigent-page${state.detailOpen ? ' has-detail' : ''}${sessionsOpen ? ' has-sessions' : ''}`}>
    {sessionsOpen && <button type="button" className="pigent-session-backdrop" aria-label="关闭 Pigent 会话抽屉" onClick={() => setSessionsOpen(false)} />}
    <SessionList sessions={state.sessions} activeId={state.activeSessionId} runActive={state.runActive} query={state.sessionQuery} onQuery={actions.setSessionQuery} onNew={() => void actions.newSession()} onSelect={(id) => { actions.selectSession(id); setSessionsOpen(false) }} onRename={actions.renameSession} onDelete={actions.deleteSession} hasMore={state.sessionsHasMore} loading={state.sessionsLoading} onLoadMore={() => void actions.loadMoreSessions()} onClose={sessionsOpen ? () => setSessionsOpen(false) : undefined} />
    <main className="pigent-main-column"><PigentHeader session={session} runActive={state.runActive} detailOpen={state.detailOpen} onSessions={() => setSessionsOpen((value) => !value)} onDetail={() => actions.setDetailOpen(!state.detailOpen)} /><div ref={scroll} className="pigent-feed-scroll" onScroll={(event) => { const node = event.currentTarget; setFollowing(node.scrollHeight - node.scrollTop - node.clientHeight < 80) }}><div className="pigent-feed"><div className="pigent-feed-intro"><div><h1>{session?.title || '开始一个 Pigent 会话'}</h1><span className={`pigent-connection is-${state.connectionState}`}>{state.connectionState}</span></div><ContextChips context={{ workspace: session?.workspace_id, ...state.context }} /></div>
      {state.historyHasMore && <button type="button" className="pigent-load-history" disabled={state.historyLoading} onClick={() => void actions.loadEarlier()}>{state.historyLoading ? 'Loading…' : 'Load earlier activity'}</button>}{tasks && <TaskCard snapshot={tasks} />}{visibleItems.length === 0 && <div className="pigent-empty"><MessageSquareText /><p>在下方输入问题或任务。Ask 与 Plan 不会执行修改，Auto 使用当前 Runtime 用户身份执行。</p></div>}{visibleItems.map((item) => <FeedItemView key={item.id} item={item} onRetry={(message) => void actions.retry(message)} onOpenShell={actions.openShell} onResolve={actions.resolveInteraction} artifactUrl={actions.artifactUrl} />)}{state.error && <div className="pigent-inline-error" role="alert">{state.error}</div>}</div></div>
      {newActivity && <button type="button" className="pigent-new-activity" onClick={() => { setFollowing(true); scroll.current?.scrollTo({ top: scroll.current.scrollHeight, behavior: 'smooth' }) }}><ArrowDown />New activity</button>}
      <div className="pigent-composer-wrap"><Composer running={state.runActive} stopping={state.stopping} disabled={state.connectionState === 'disconnected' || !(state.capabilities?.tools.length ?? 0)} mode={state.mode} pendingMode={state.pendingMode} onMode={(mode) => void actions.setMode(mode)} model={state.model} modelChoices={state.modelChoices} pendingModel={state.pendingModel} onModel={(model) => void actions.setModel(model)} onSend={actions.send} onStop={actions.stop} /></div>
    </main>{state.detailOpen && <DetailPanel session={session} context={{ workspace: session?.workspace_id, ...state.context }} mode={state.mode} tools={effectiveTools(state)} />}
  </div>
}
