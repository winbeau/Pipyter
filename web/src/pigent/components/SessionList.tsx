import { Orbit } from 'lucide-react'
import type { PigentSession } from '../types'
const statusLabel: Record<string, string> = { active: 'Ready', completed: 'Completed', failed: 'Failed', interrupted: 'Interrupted', waiting_for_user: 'Waiting for user' }
export function SessionList({ sessions, activeId, runActive = false, onSelect }: { sessions: PigentSession[]; activeId: string | null; runActive?: boolean; onSelect(id: string): void }) {
  return <aside className="pigent-session-column">
    <div className="pigent-workspace-summary"><span>当前 Workspace</span><strong>Pipyter Runtime</strong><small>共享活动会话与事件游标</small></div>
    <div className="pigent-session-list"><div className="pigent-section-label">最近 Pigent Sessions</div>
      {sessions.length === 0 && <div className="pigent-empty-compact">发送消息以创建会话</div>}
      {sessions.map((session) => { const running = session.id === activeId ? runActive : session.status === 'active'; return <button type="button" key={session.id} className={`${session.id === activeId ? 'is-selected ' : ''}${running ? 'is-running' : ''}`} onClick={() => onSelect(session.id)}>
        <span className="pigent-session-title">{session.title || '未命名会话'}</span><span className="pigent-session-meta"><Orbit size={10} />{session.mode.toUpperCase()} · {running ? 'Running' : statusLabel[session.status] || session.status}</span>
      </button> })}
    </div>
  </aside>
}
