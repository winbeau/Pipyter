import type { PigentModelChoice, PigentModelSelection } from '../models'
import { modelChoice } from '../models'

export function ModelSelector({ value, choices, pending, onChange, disabled = false, compact = false }: {
  value: PigentModelSelection
  choices: readonly PigentModelChoice[]
  pending?: PigentModelSelection | null
  onChange(model: PigentModelChoice): void
  disabled?: boolean
  compact?: boolean
}) {
  const selected = modelChoice(pending ?? value, choices)
  const options = selected && !choices.some((item) => item.provider === selected.provider && item.model === selected.model) ? [selected, ...choices] : choices
  return <select className={`pigent-model-selector${compact ? ' is-compact' : ''}${pending ? ' is-pending' : ''}`} aria-label="Pigent model" value={selected?.id ?? ''} disabled={disabled || options.length === 0} onChange={(event) => { const choice = options.find((item) => item.id === event.target.value); if (choice && choice.configured !== false) onChange(choice) }}>
    {options.length === 0 && <option value="">Configure model</option>}
    {options.map((item) => <option key={`${item.provider}:${item.model}`} value={item.id} disabled={item.configured === false}>{item.label}{item.configured === false ? ' · not configured' : ''}</option>)}
  </select>
}
