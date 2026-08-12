import { MessageSquareText } from 'lucide-react'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { DesignComposer } from '../design/components/DesignComposer'
import { DesignLiveFeed } from '../design/components/DesignLiveFeedItem'
import { DesignSidebar } from '../design/components/DesignSidebar'
import { TaskCard } from '../pigent/components/TaskCard'
import { projectFeed } from '../pigent/feed'
import { currentTasks, usePigent } from '../pigent/store'

export function DesignPage() {
  const { state, actions } = usePigent()
  const session = state.sessions.find((item) => item.id === state.activeSessionId)
  const items = useMemo(() => projectFeed(Object.values(state.eventsById).sort((left, right) => Number(left.event_id) - Number(right.event_id)), state.userMessages).slice(-500), [state.eventsById, state.userMessages])
  const tasks = currentTasks(state)
  const threadRef = useRef<HTMLDivElement>(null)
  const renderedSessionRef = useRef<string | null | undefined>(undefined)
  const followTailRef = useRef(true)
  const historyRequestRef = useRef(false)
  const historyAnchorRef = useRef<{ sessionId: string; scrollHeight: number; scrollTop: number } | null>(null)
  const disabled = state.connectionState === 'disconnected' || !(state.capabilities?.tools.length ?? 0)

  useLayoutEffect(() => {
    const thread = threadRef.current
    if (!thread) return

    if (renderedSessionRef.current !== state.activeSessionId) {
      renderedSessionRef.current = state.activeSessionId
      followTailRef.current = true
      historyRequestRef.current = false
      historyAnchorRef.current = null
      thread.scrollTop = thread.scrollHeight
      return
    }

    const anchor = historyAnchorRef.current
    if (anchor && anchor.sessionId === state.activeSessionId && !state.historyLoading) {
      thread.scrollTop = anchor.scrollTop + (thread.scrollHeight - anchor.scrollHeight)
      historyAnchorRef.current = null
      historyRequestRef.current = false
      followTailRef.current = false
      return
    }

    if (followTailRef.current) thread.scrollTop = thread.scrollHeight
  }, [items, state.activeSessionId, state.historyLoading, state.runActive, tasks?.revision])

  const handleThreadScroll = () => {
    const thread = threadRef.current
    if (!thread) return
    followTailRef.current = thread.scrollHeight - thread.scrollTop - thread.clientHeight <= 240

    if (thread.scrollTop > 80 || !state.historyHasMore || state.historyLoading || historyRequestRef.current || !state.activeSessionId) return
    historyRequestRef.current = true
    followTailRef.current = false
    historyAnchorRef.current = {
      sessionId: state.activeSessionId,
      scrollHeight: thread.scrollHeight,
      scrollTop: thread.scrollTop,
    }
    void actions.loadEarlier()
  }

  return <div className="design-page">
    <DesignSidebar sessions={state.sessions} activeId={state.activeSessionId} onNew={actions.newSession} onLoadProjectOptions={actions.projectCreationOptions} onNewProject={actions.newProject} onSelect={actions.selectSession} onRename={actions.renameSession} onDelete={actions.deleteSession} />
    <div className="design-page-content">
      <header className="design-page-header"><div><span>PIGENT</span><h1>{session?.title || '新建 Agent 会话'}</h1></div><p>{state.connectionState} · {state.model.model || 'model unavailable'}</p></header>
      <main className="design-page-main">
        <div className="design-thread" ref={threadRef} onScroll={handleThreadScroll}>
          <div className="design-tool-list">
            <DesignLiveFeed items={items} onRetry={(message) => void actions.retry(message)} onOpenShell={actions.openShell} onResolve={actions.resolveInteraction} artifactUrl={actions.artifactUrl} />
            {items.length === 0 && <div className="pigent-empty"><MessageSquareText /><p>在下方输入问题或任务，真实 Agent 活动会显示在这里。</p></div>}
            {state.error && <div className="pigent-inline-error" role="alert">{state.error}</div>}
          </div>
        </div>
        <div className="design-composer-dock">
          {tasks && <div className="design-persistent-tasks"><TaskCard snapshot={tasks} density="compact" /></div>}
          <DesignComposer models={state.modelChoices} model={state.model} pendingModel={state.pendingModel} mode={state.mode} pendingMode={state.pendingMode} running={state.runActive} stopping={state.stopping} disabled={disabled} onRefreshModels={actions.refreshCapabilities} onModel={actions.setModel} onMode={actions.setMode} onSend={actions.send} onStop={actions.stop} />
        </div>
      </main>
    </div>
  </div>
}
