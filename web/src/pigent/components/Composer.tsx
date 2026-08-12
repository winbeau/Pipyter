import { ArrowUp, Square } from 'lucide-react'
import { useState } from 'react'
import type { PigentMode } from '../types'
import type { PigentModelChoice, PigentModelSelection } from '../models'
import { ModeSelector } from './ModeSelector'
import { ModelSelector } from './ModelSelector'

export function Composer({ onSend, running = false, compact = false, mode, pendingMode, onMode, model, pendingModel, onModel }: {
  onSend(content: string): Promise<void> | void
  running?: boolean
  compact?: boolean
  mode: PigentMode
  pendingMode?: PigentMode | null
  onMode(mode: PigentMode): void
  model: PigentModelSelection
  pendingModel?: PigentModelSelection | null
  onModel(model: PigentModelChoice): void
}) {
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    const content = value.trim()
    if (!content || busy) return
    setBusy(true)
    try { await onSend(content); setValue('') } finally { setBusy(false) }
  }
  return <div className={`pigent-composer${compact ? ' is-compact' : ''}`}>
    <textarea value={value} onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void submit() } }} placeholder="向 Pigent 提问或下达任务…" aria-label="Message Pigent" rows={compact ? 1 : 2} />
    <div className="pigent-composer-footer">
      <div className="pigent-composer-controls">
        <ModeSelector compact={compact} mode={mode} pendingMode={pendingMode} onChange={onMode} />
        <ModelSelector compact={compact} value={model} pending={pendingModel} onChange={onModel} disabled={running} />
      </div>
      <button className="pigent-send" type="button" onClick={() => void submit()} disabled={!value.trim() || busy} aria-label={running ? '发送后续消息' : '发送消息'}>{running ? <Square size={13} /> : <ArrowUp size={15} />}</button>
    </div>
  </div>
}
