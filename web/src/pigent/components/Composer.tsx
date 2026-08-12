import { ArrowUp, LoaderCircle, Square } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { PigentMode } from '../types'
import type { PigentModelChoice, PigentModelSelection } from '../models'
import { ModeSelector } from './ModeSelector'
import { ModelSelector } from './ModelSelector'

export function Composer({ onSend, onStop, onRefreshModels, running = false, stopping = false, compact = false, mode, pendingMode, onMode, model, modelChoices, pendingModel, onModel, disabled = false }: {
  onSend(content: string): Promise<void> | void
  onStop(): Promise<void> | void
  onRefreshModels?(): Promise<void> | void
  running?: boolean
  stopping?: boolean
  compact?: boolean
  mode: PigentMode
  pendingMode?: PigentMode | null
  onMode(mode: PigentMode): void
  model: PigentModelSelection
  modelChoices: readonly PigentModelChoice[]
  pendingModel?: PigentModelSelection | null
  onModel(model: PigentModelChoice): void
  disabled?: boolean
}) {
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textarea = useRef<HTMLTextAreaElement>(null)
  useEffect(() => { const node = textarea.current; if (!node) return; node.style.height = 'auto'; node.style.height = `${Math.min(180, Math.max(compact ? 32 : 48, node.scrollHeight))}px` }, [compact, value])
  const submit = async () => {
    const content = value.trim()
    if (!content || busy || disabled) return
    setBusy(true); setError(null)
    try { await onSend(content); setValue('') }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) }
    finally { setBusy(false) }
  }
  const stop = async () => { if (stopping || !running) return; setError(null); try { await onStop() } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) } }
  return <div className={`pigent-composer${compact ? ' is-compact' : ''}`} aria-busy={busy || stopping}>
    {error && <div className="pigent-composer-error" role="alert">{error}</div>}
    <textarea ref={textarea} value={value} disabled={disabled} onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void submit() } else if (event.key === 'Escape' && running && !event.nativeEvent.isComposing) { event.preventDefault(); void stop() } }} placeholder="向 Pigent 提问或下达任务…" aria-label="Message Pigent" rows={compact ? 1 : 2} />
    <div className="pigent-composer-footer"><div className="pigent-composer-controls"><ModeSelector compact={compact} mode={mode} pendingMode={pendingMode} onChange={onMode} /><ModelSelector compact={compact} value={model} choices={modelChoices} pending={pendingModel} onOpen={onRefreshModels} onChange={onModel} disabled={running || disabled} /></div>
      {running ? <button className="pigent-stop" type="button" onClick={() => void stop()} disabled={stopping} aria-label={stopping ? '正在停止' : '停止运行'}>{stopping ? <LoaderCircle className="spin" /> : <Square />}</button> : <button className="pigent-send" type="button" onClick={() => void submit()} disabled={!value.trim() || busy || disabled} aria-label="发送消息">{busy ? <LoaderCircle className="spin" /> : <ArrowUp />}</button>}
    </div>
  </div>
}
