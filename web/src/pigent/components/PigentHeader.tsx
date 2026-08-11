import { ChevronLeft, PanelRight, Orbit } from 'lucide-react'
import type { PigentMode, PigentSession } from '../types'
import { ModeSelector, modeHint } from './ModeSelector'
const statusLabel: Record<string, string> = { completed: 'Completed', failed: 'Failed', interrupted: 'Interrupted', waiting_for_user: 'Waiting for user' }
export function PigentHeader({ session, mode, pendingMode, onMode, runActive = false, detailOpen, onDetail, compact = false, onClose }: { session?: PigentSession; mode: PigentMode; pendingMode?: PigentMode | null; onMode(mode: PigentMode): void; runActive?: boolean; detailOpen?: boolean; onDetail?(): void; compact?: boolean; onClose?(): void }) {
  const stateLabel = runActive ? 'Running' : session?.status === 'active' ? 'Ready' : session ? statusLabel[session.status] || session.status : 'Ready'
  return <header className={`pigent-header${compact ? ' is-compact' : ''}`}>
    <div className="pigent-identity"><Orbit size={compact ? 15 : 18} aria-hidden="true" /><strong>Pigent</strong><span className={`pigent-state-dot ${runActive ? 'is-running' : ''}`}>{stateLabel}</span></div>
    <div className="pigent-header-modes"><ModeSelector compact={compact} mode={mode} pendingMode={pendingMode} onChange={onMode} />{!compact && <span className="pigent-mode-hint">{modeHint(pendingMode ?? mode)}</span>}</div>
    {onDetail && <button type="button" className={detailOpen ? 'is-active' : ''} onClick={onDetail} aria-label="切换 Pigent 详情"><PanelRight size={15} /></button>}
    {onClose && <button type="button" onClick={onClose} aria-label="关闭 Pigent 面板"><ChevronLeft size={16} /></button>}
  </header>
}
