import { ChevronLeft, LoaderCircle, Menu, PanelRight, Orbit, Square } from 'lucide-react'
import type { PigentSession } from '../types'

const statusLabel: Record<string, string> = { completed: 'Completed', failed: 'Failed', interrupted: 'Interrupted', waiting_for_user: 'Waiting for user' }

export function PigentHeader({ session, runActive = false, stopping = false, detailOpen, onDetail, onStop, compact = false, onClose, onSessions }: {
  session?: PigentSession
  runActive?: boolean
  stopping?: boolean
  detailOpen?: boolean
  onDetail?(): void
  onStop?(): Promise<void> | void
  compact?: boolean
  onClose?(): void
  onSessions?(): void
}) {
  const stateLabel = runActive ? 'Running' : session?.status === 'active' ? 'Ready' : session ? statusLabel[session.status] || session.status : 'Ready'
  return <header className={`pigent-header${compact ? ' is-compact' : ''}`}>
    {onSessions && <button type="button" className="pigent-sessions-toggle" onClick={onSessions} aria-label="打开 Pigent 会话列表"><Menu size={16} /></button>}
    <div className="pigent-identity"><Orbit size={compact ? 15 : 18} aria-hidden="true" /><strong>Pigent</strong><span className={`pigent-state-dot ${runActive ? 'is-running' : ''}`}>{stateLabel}</span></div>
    <div className="pigent-header-spacer" />
    {runActive && onStop && <button type="button" className="pigent-header-stop" onClick={() => void onStop()} disabled={stopping} aria-label={stopping ? '正在停止任务' : '停止任务'}>{stopping ? <LoaderCircle className="spin" /> : <Square />}<span>{stopping ? 'Stopping…' : 'Stop task'}</span></button>}
    {onDetail && <button type="button" className={detailOpen ? 'is-active' : ''} onClick={onDetail} aria-label="切换 Pigent 详情"><PanelRight size={15} /></button>}
    {onClose && <button type="button" onClick={onClose} aria-label="关闭 Pigent 面板"><ChevronLeft size={16} /></button>}
  </header>
}
