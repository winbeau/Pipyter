import type { PigentMode } from '../types'

const modes: { id: PigentMode; label: string; hint: string }[] = [
  { id: 'ask', label: 'Ask', hint: '只分析回答，不修改或执行' },
  { id: 'plan', label: 'Plan', hint: '分析并生成 Tasks，不执行修改' },
  { id: 'auto', label: 'Auto', hint: '以当前 Runtime 用户身份自主执行' },
]
export const modeHint = (mode: PigentMode) => modes.find((item) => item.id === mode)?.hint ?? ''
export function ModeSelector({ mode, pendingMode, onChange, compact = false }: { mode: PigentMode; pendingMode?: PigentMode | null; onChange(mode: PigentMode): void; compact?: boolean }) {
  return <div className={`pigent-mode-selector${compact ? ' pigent-mode-compact' : ''}`} role="radiogroup" aria-label="Pigent mode">
    {modes.map((item) => <button key={item.id} type="button" role="radio" aria-checked={mode === item.id} title={item.hint} className={`${mode === item.id ? 'is-active' : ''}${pendingMode === item.id ? ' is-pending' : ''}`} onClick={() => onChange(item.id)}>{item.label}{pendingMode === item.id && <span className="sr-only"> pending</span>}</button>)}
  </div>
}
