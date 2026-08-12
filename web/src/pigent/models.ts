export type PigentModelSelection = {
  provider: string
  model: string
}

export type PigentModelChoice = PigentModelSelection & {
  id: 'ds-v4-flash' | 'pro' | 'gpt-5.6-luna' | 'terra' | 'sol'
  label: string
}

export const PIGENT_MODEL_CHOICES: readonly PigentModelChoice[] = [
  { id: 'ds-v4-flash', label: 'ds-v4-flash', provider: 'deepseek', model: 'deepseek-v4-flash' },
  { id: 'pro', label: 'pro', provider: 'deepseek', model: 'deepseek-v4-pro' },
  { id: 'gpt-5.6-luna', label: 'gpt-5.6-luna', provider: 'openai', model: 'gpt-5.6-luna' },
  { id: 'terra', label: 'terra', provider: 'openai', model: 'gpt-5.6-terra' },
  { id: 'sol', label: 'sol', provider: 'openai', model: 'gpt-5.6-sol' },
]

export const DEFAULT_PIGENT_MODEL = PIGENT_MODEL_CHOICES[0]

export function modelChoice(value: PigentModelSelection | null | undefined): PigentModelChoice | null {
  if (!value) return null
  return PIGENT_MODEL_CHOICES.find((item) => item.provider === value.provider && item.model === value.model) ?? null
}

export function sameModel(left: PigentModelSelection | null | undefined, right: PigentModelSelection | null | undefined): boolean {
  return Boolean(left && right && left.provider === right.provider && left.model === right.model)
}
