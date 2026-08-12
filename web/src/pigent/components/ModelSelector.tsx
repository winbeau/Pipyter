import { Sparkles } from 'lucide-react'
import { useRef } from 'react'
import type { PigentModelChoice, PigentModelSelection } from '../models'
import { modelChoice } from '../models'
import { SelectPopover } from './SelectPopover'

export function ModelSelector({ value, choices, pending, onChange, onOpen, disabled = false, compact = false }: {
  value: PigentModelSelection
  choices: readonly PigentModelChoice[]
  pending?: PigentModelSelection | null
  onChange(model: PigentModelChoice): void
  onOpen?(): Promise<void> | void
  disabled?: boolean
  compact?: boolean
}) {
  const lastRefresh = useRef(0)
  const selected = modelChoice(pending ?? value, choices)
  const options = selected && !choices.some((item) => item.provider === selected.provider && item.model === selected.model) ? [selected, ...choices] : choices
  const refresh = () => {
    const now = Date.now()
    if (now - lastRefresh.current < 500) return
    lastRefresh.current = now
    void onOpen?.()
  }
  const popoverOptions = options.length ? options.map((item) => ({ value: item.id, label: `${item.label}${item.configured === false ? ' · not configured' : ''}`, disabled: item.configured === false })) : [{ value: '', label: 'Configure model', disabled: true }]
  return <SelectPopover ariaLabel="Pigent model" value={selected?.id ?? ''} options={popoverOptions} onChange={(id) => { const choice = options.find((item) => item.id === id); if (choice) onChange(choice) }} onOpen={refresh} disabled={disabled || options.length === 0} compact={compact} className={`pigent-model-selector${pending ? ' is-pending' : ''}`} leading={<Sparkles aria-hidden="true" />} />
}
