import type { PigentMode } from '../types'
import { SelectPopover } from './SelectPopover'

const modes: { id: PigentMode; label: string; hint: string }[] = [
  { id: 'ask', label: 'Ask', hint: '只分析回答，不修改或执行' },
  { id: 'plan', label: 'Plan', hint: '分析并生成 Tasks，不执行修改' },
  { id: 'auto', label: 'Auto', hint: '以当前 Runtime 用户身份自主执行' },
]
export const modeHint = (mode: PigentMode) => modes.find((item) => item.id === mode)?.hint ?? ''
export function ModeSelector({ mode, pendingMode, onChange, compact = false }: { mode: PigentMode; pendingMode?: PigentMode | null; onChange(mode: PigentMode): void; compact?: boolean }) {
  return <SelectPopover ariaLabel="Pigent mode" value={pendingMode ?? mode} options={modes.map((item) => ({ value: item.id, label: item.label }))} onChange={onChange} disabled={Boolean(pendingMode)} compact={compact} className={`pigent-mode-selector${pendingMode ? ' is-pending' : ''}`} />
}
