import { MoreHorizontal, Orbit, Plus, Search, Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { PigentSession } from '../types'

const statusLabel: Record<string, string> = { active: 'Ready', completed: 'Completed', failed: 'Failed', interrupted: 'Interrupted', waiting_for_user: 'Waiting for user' }
export function SessionList({ sessions, activeId, runActive = false, query, onQuery, onNew, onSelect, onRename, onDelete, hasMore = false, loading = false, onLoadMore, onClose }: {
  sessions: PigentSession[]
  activeId: string | null
  runActive?: boolean
  query: string
  onQuery(value: string): void
  onNew(): void
  onSelect(id: string): void
  onRename(id: string, title: string): Promise<void>
  onDelete(id: string): Promise<void>
  hasMore?: boolean
  loading?: boolean
  onLoadMore?(): void
  onClose?(): void
}) {
  const [menu, setMenu] = useState<string | null>(null)
  return <aside className="pigent-session-column"><div className="pigent-workspace-summary"><span>当前 Workspace</span><strong>Pipyter Runtime</strong><small>共享活动会话与事件游标</small>{onClose && <button type="button" className="pigent-session-close" aria-label="关闭 Pigent 会话列表" onClick={onClose}>×</button>}</div><div className="pigent-session-toolbar"><button type="button" className="is-primary" onClick={onNew}><Plus />New session</button><label><Search /><span className="sr-only">Search sessions</span><input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Search" /></label></div><div className="pigent-session-list"><div className="pigent-section-label">最近 Pigent Sessions</div>{sessions.length === 0 && <div className="pigent-empty-compact">没有匹配会话</div>}{sessions.map((session) => { const running = session.id === activeId ? runActive : session.status === 'active'; const popoverId = `pigent-session-menu-${session.id}`; return <div className={`pigent-session-row${session.id === activeId ? ' is-selected' : ''}`} key={session.id}><button type="button" className="pigent-session-select" onClick={() => onSelect(session.id)}><span className="pigent-session-title">{session.title || '未命名会话'}</span><span className="pigent-session-meta"><Orbit />{session.mode.toUpperCase()} · {running ? 'Running' : statusLabel[session.status] || session.status}</span></button><button type="button" className="pigent-session-menu" aria-label={`Manage ${session.title || 'session'}`} aria-expanded={menu === session.id} aria-controls={popoverId} onClick={() => setMenu(menu === session.id ? null : session.id)}><MoreHorizontal /></button>{menu === session.id && <div id={popoverId} className="pigent-session-popover" role="menu"><button type="button" role="menuitem" onClick={() => { const title = window.prompt('Rename session', session.title || ''); if (title?.trim()) void onRename(session.id, title.trim()); setMenu(null) }}>Rename</button><button type="button" role="menuitem" className="is-danger" onClick={() => { if (window.confirm('Delete this session?')) void onDelete(session.id).catch(() => undefined); setMenu(null) }}><Trash2 />Delete</button></div>}</div> })}{hasMore && <button type="button" className="pigent-load-sessions" disabled={loading} onClick={onLoadMore}>{loading ? 'Loading…' : 'Load more sessions'}</button>}</div></aside>
}
