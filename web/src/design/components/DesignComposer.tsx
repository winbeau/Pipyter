import { ArrowUp, Check, ChevronDown, LoaderCircle, Sparkles, Square } from 'lucide-react'
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import type { PigentModelChoice, PigentModelSelection } from '../../pigent/models'
import type { PigentMode } from '../../pigent/types'

const modes: Array<{ value: PigentMode; label: string; description: string }> = [
  { value: 'ask', label: 'Ask', description: '只读取并回答' },
  { value: 'plan', label: 'Plan', description: '生成计划，不执行修改' },
  { value: 'auto', label: 'Auto', description: '允许 Agent 执行工具' },
]

function Popover({ open, onClose, children, className }: { open: boolean; onClose(): void; children: ReactNode; className: string }) {
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent) => { if (!root.current?.parentElement?.contains(event.target as Node)) onClose() }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [onClose, open])
  useEffect(() => { if (open) queueMicrotask(() => root.current?.querySelector<HTMLButtonElement>('button.is-selected, button')?.focus()) }, [open])
  return open ? <div ref={root} className={className} role="menu">{children}</div> : null
}

export function DesignComposer({ models, model, pendingModel, mode, pendingMode, running, stopping, disabled, onRefreshModels, onModel, onMode, onSend, onStop }: {
  models: readonly PigentModelChoice[]
  model: PigentModelSelection
  pendingModel?: PigentModelSelection | null
  mode: PigentMode
  pendingMode?: PigentMode | null
  running: boolean
  stopping: boolean
  disabled: boolean
  onRefreshModels(): Promise<void> | void
  onModel(model: PigentModelChoice): Promise<void> | void
  onMode(mode: PigentMode): Promise<void> | void
  onSend(content: string): Promise<void> | void
  onStop(): Promise<void> | void
}) {
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [modeOpen, setModeOpen] = useState(false)
  const [modelOpen, setModelOpen] = useState(false)
  const modelMenuId = useId()
  const effectiveMode = pendingMode ?? mode
  const effectiveModel = pendingModel ?? model
  const selected = models.find((item) => item.provider === effectiveModel.provider && item.model === effectiveModel.model)
    ?? (effectiveModel.provider && effectiveModel.model ? { id: `${effectiveModel.provider}:${effectiveModel.model}`, label: effectiveModel.model, ...effectiveModel } : null)
  useEffect(() => {
    if (!modeOpen && !modelOpen) return
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault(); setModeOpen(false); setModelOpen(false)
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [modeOpen, modelOpen])
  const closeMenus = () => { setModeOpen(false); setModelOpen(false) }
  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') { event.preventDefault(); closeMenus(); return }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'))
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement)
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : event.key === 'ArrowDown' ? (current + 1 + buttons.length) % buttons.length : (current - 1 + buttons.length) % buttons.length
    buttons[next]?.focus()
  }
  const submit = async () => {
    const content = value.trim()
    if (!content || busy || disabled) return
    setBusy(true); setError(null)
    try { await onSend(content); setValue('') }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) }
    finally { setBusy(false) }
  }
  const stop = async () => {
    if (!running || stopping) return
    setError(null)
    try { await onStop() } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) }
  }
  return <div className="design-composer" aria-busy={busy || stopping}>
    {error && <div className="pigent-composer-error" role="alert">{error}</div>}
    <div className="design-composer-input">
      <textarea aria-label="Message Pigent" rows={3} value={value} disabled={disabled} onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => {
        if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void submit() }
        else if (event.key === 'Escape' && running && !event.nativeEvent.isComposing) { event.preventDefault(); void stop() }
      }} placeholder="向 Pigent 提问或下达任务…" />
      {running
        ? <button type="button" className="design-send" aria-label={stopping ? '正在停止' : '停止运行'} disabled={stopping} onClick={() => void stop()}>{stopping ? <LoaderCircle className="spin" /> : <Square />}</button>
        : <button type="button" className="design-send" aria-label="发送消息" disabled={!value.trim() || busy || disabled} onClick={() => void submit()}>{busy ? <LoaderCircle className="spin" /> : <ArrowUp />}</button>}
    </div>
    <div className="design-composer-footer">
      <div className="design-composer-left"><div className="design-composer-popover-root">
        <button type="button" role="combobox" className="design-composer-pill" aria-label="Pigent mode" aria-haspopup="menu" aria-expanded={modeOpen} disabled={Boolean(pendingMode)} onClick={() => { setModeOpen((open) => !open); setModelOpen(false) }}><span>{modes.find((item) => item.value === effectiveMode)?.label}</span><ChevronDown /></button>
        <Popover open={modeOpen} onClose={() => setModeOpen(false)} className="design-menu design-mode-menu"><div onKeyDown={onMenuKeyDown}>{modes.map((item) => <button type="button" key={item.value} className={item.value === effectiveMode ? 'is-selected' : ''} onClick={() => { setModeOpen(false); void onMode(item.value) }}><span><strong>{item.label}</strong><small>{item.description}</small></span>{item.value === effectiveMode && <Check />}</button>)}</div></Popover>
      </div></div>
      <div className="design-composer-right"><div className="design-composer-popover-root">
        <button type="button" className="design-model-trigger" aria-label="Pigent model" aria-haspopup="menu" aria-controls={modelMenuId} aria-expanded={modelOpen} disabled={running || disabled || models.length === 0} onClick={() => { const opening = !modelOpen; setModelOpen(opening); setModeOpen(false); if (opening) void onRefreshModels() }}><Sparkles /><span>{selected?.label ?? 'Configure model'}</span><ChevronDown /></button>
        <Popover open={modelOpen} onClose={() => setModelOpen(false)} className="design-menu design-model-menu"><div id={modelMenuId} onKeyDown={onMenuKeyDown}><div className="design-menu-label">Models</div>{models.map((item) => <button type="button" key={item.id} disabled={item.configured === false} className={item.provider === effectiveModel.provider && item.model === effectiveModel.model ? 'is-selected' : ''} onClick={() => { setModelOpen(false); void onModel(item) }}><span><strong>{item.label}</strong><small>{item.provider}</small></span>{item.provider === effectiveModel.provider && item.model === effectiveModel.model && <Check />}</button>)}</div></Popover>
      </div></div>
    </div>
  </div>
}
