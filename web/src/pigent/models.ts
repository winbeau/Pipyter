export type PigentModelSelection = {
  provider: string
  model: string
}

export type PigentModelChoice = PigentModelSelection & {
  id: string
  label: string
  configured?: boolean
}

export const DEFAULT_PIGENT_MODEL: PigentModelChoice = {
  id: 'unconfigured',
  label: 'Configure model',
  provider: '',
  model: '',
  configured: false,
}

export function modelChoice(
  value: PigentModelSelection | null | undefined,
  choices: readonly PigentModelChoice[] = [],
): PigentModelChoice | null {
  if (!value || !value.provider || !value.model) return null
  return choices.find((item) => item.provider === value.provider && item.model === value.model) ?? {
    id: `${value.provider}:${value.model}`,
    label: value.model,
    provider: value.provider,
    model: value.model,
  }
}

export function sameModel(left: PigentModelSelection | null | undefined, right: PigentModelSelection | null | undefined): boolean {
  return Boolean(left && right && left.provider === right.provider && left.model === right.model)
}
