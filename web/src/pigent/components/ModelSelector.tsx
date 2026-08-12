import { PIGENT_MODEL_CHOICES, modelChoice, type PigentModelChoice, type PigentModelSelection } from '../models'

export function ModelSelector({ value, pending, onChange, disabled = false, compact = false }: {
  value: PigentModelSelection
  pending?: PigentModelSelection | null
  onChange(model: PigentModelChoice): void
  disabled?: boolean
  compact?: boolean
}) {
  const selected = modelChoice(pending ?? value) ?? PIGENT_MODEL_CHOICES[0]
  return <select
    className={`pigent-model-selector${compact ? ' is-compact' : ''}${pending ? ' is-pending' : ''}`}
    aria-label="Pigent model"
    value={selected.id}
    disabled={disabled}
    onChange={(event) => {
      const choice = PIGENT_MODEL_CHOICES.find((item) => item.id === event.target.value)
      if (choice) onChange(choice)
    }}
  >
    {PIGENT_MODEL_CHOICES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
  </select>
}
